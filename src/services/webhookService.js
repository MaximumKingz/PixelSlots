const crypto = require('crypto');
const cryptoService = require('./cryptoService');
const User = require('../models/user');
const EventEmitter = require('events');

class WebhookService extends EventEmitter {
    constructor() {
        super();
        this.config = {
            merchantId: process.env.CRYPTOMUS_MERCHANT_ID,
            paymentKey: process.env.CRYPTOMUS_PAYMENT_KEY,
            webhookKey: process.env.CRYPTOMUS_WEBHOOK_KEY,
            allowedIps: process.env.CRYPTOMUS_ALLOWED_IPS?.split(',') || [],
            retryAttempts: 3,
            retryDelay: 5000, // 5 seconds
            maxProcessingTime: 30000 // 30 seconds
        };

        // Track processing transactions to prevent duplicates
        this.processingTransactions = new Map();
    }

    validateSignature(payload, signature) {
        if (!payload || !signature) {
            return false;
        }

        try {
            const calculatedSignature = crypto
                .createHash('md5')
                .update(Buffer.from(JSON.stringify(payload)).toString('base64') + this.config.webhookKey)
                .digest('hex');

            return calculatedSignature === signature;
        } catch (error) {
            console.error('Signature validation error:', error);
            return false;
        }
    }

    validateIp(ip) {
        if (!this.config.allowedIps.length) {
            return true; // No IP restriction if not configured
        }
        return this.config.allowedIps.includes(ip);
    }

    async handleWebhook(payload, signature, ip) {
        try {
            // Basic validation
            if (!this.validateSignature(payload, signature)) {
                throw new Error('Invalid signature');
            }

            if (!this.validateIp(ip)) {
                throw new Error('Unauthorized IP address');
            }

            // Check if transaction is already being processed
            const txId = payload.uuid;
            if (this.processingTransactions.has(txId)) {
                const existingProcess = this.processingTransactions.get(txId);
                if (Date.now() - existingProcess.startTime < this.config.maxProcessingTime) {
                    throw new Error('Transaction is already being processed');
                }
            }

            // Mark transaction as processing
            this.processingTransactions.set(txId, {
                startTime: Date.now(),
                attempts: 0
            });

            // Process the webhook with retry mechanism
            return await this.processWebhookWithRetry(payload);
        } catch (error) {
            console.error('Webhook handling error:', error);
            this.emit('webhook:error', {
                error: error.message,
                payload
            });
            throw error;
        }
    }

    async processWebhookWithRetry(payload, attempt = 1) {
        const txId = payload.uuid;
        
        try {
            const result = await this.processWebhook(payload);
            this.processingTransactions.delete(txId);
            return result;
        } catch (error) {
            const processInfo = this.processingTransactions.get(txId);
            processInfo.attempts = attempt;

            if (attempt < this.config.retryAttempts) {
                console.log(`Retrying webhook processing (attempt ${attempt + 1}/${this.config.retryAttempts})`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                return this.processWebhookWithRetry(payload, attempt + 1);
            }

            this.processingTransactions.delete(txId);
            throw error;
        }
    }

    async processWebhook(payload) {
        const { type, status, uuid, order_id, amount, currency, network, address } = payload;

        // Validate required fields
        if (!type || !status || !uuid || !order_id) {
            throw new Error('Missing required fields in webhook payload');
        }

        // Handle different webhook types
        switch (type) {
            case 'payment':
                return this.handlePayment(payload);
            case 'withdrawal':
                return this.handleWithdrawal(payload);
            case 'refund':
                return this.handleRefund(payload);
            default:
                throw new Error(`Unsupported webhook type: ${type}`);
        }
    }

    async handlePayment(payload) {
        const { status, uuid, order_id, amount, currency, network, address } = payload;

        try {
            // Extract user ID from order_id (format: deposit_userId_timestamp)
            const userId = order_id.split('_')[1];
            if (!userId) {
                throw new Error('Invalid order ID format');
            }

            // Find user
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update transaction status
            const transaction = {
                txId: uuid,
                type: 'deposit',
                status,
                amount: parseFloat(amount),
                currency,
                network,
                address,
                timestamp: new Date()
            };

            // Handle different payment statuses
            switch (status) {
                case 'paid':
                    await this.handleSuccessfulPayment(user, transaction);
                    break;
                case 'pending':
                    await this.handlePendingPayment(user, transaction);
                    break;
                case 'expired':
                    await this.handleExpiredPayment(user, transaction);
                    break;
                case 'failed':
                    await this.handleFailedPayment(user, transaction);
                    break;
                default:
                    throw new Error(`Unsupported payment status: ${status}`);
            }

            this.emit('payment:processed', {
                userId: user._id,
                transaction
            });

            return { success: true };
        } catch (error) {
            console.error('Payment handling error:', error);
            this.emit('payment:error', {
                error: error.message,
                payload
            });
            throw error;
        }
    }

    async handleSuccessfulPayment(user, transaction) {
        // Calculate token amount
        const tokenAmount = Math.floor(transaction.amount * cryptoService.config.conversionRate);

        // Add tokens to user's balance
        await user.addTokens(tokenAmount, {
            deposit: true,
            amount: transaction.amount
        });

        // Update user's deposit history
        user.wallet.depositHistory.push({
            amount: transaction.amount,
            network: transaction.network,
            address: transaction.address,
            txid: transaction.txId,
            status: 'completed',
            timestamp: transaction.timestamp
        });

        // Update user stats
        user.stats.totalDeposited += tokenAmount;
        user.stats.deposits.push({
            amount: tokenAmount,
            btcAmount: transaction.amount,
            network: transaction.network,
            timestamp: transaction.timestamp
        });

        await user.save();

        // Emit success event
        this.emit('payment:success', {
            userId: user._id,
            tokenAmount,
            transaction
        });
    }

    async handlePendingPayment(user, transaction) {
        // Update user's pending deposits
        const pendingDeposit = {
            amount: transaction.amount,
            network: transaction.network,
            address: transaction.address,
            txid: transaction.txId,
            status: 'pending',
            timestamp: transaction.timestamp
        };

        user.wallet.depositHistory.push(pendingDeposit);
        await user.save();

        // Emit pending event
        this.emit('payment:pending', {
            userId: user._id,
            transaction
        });
    }

    async handleExpiredPayment(user, transaction) {
        // Update expired deposit in history
        const depositIndex = user.wallet.depositHistory.findIndex(
            d => d.txid === transaction.txId
        );

        if (depositIndex !== -1) {
            user.wallet.depositHistory[depositIndex].status = 'expired';
            await user.save();
        }

        // Emit expired event
        this.emit('payment:expired', {
            userId: user._id,
            transaction
        });
    }

    async handleFailedPayment(user, transaction) {
        // Update failed deposit in history
        const depositIndex = user.wallet.depositHistory.findIndex(
            d => d.txid === transaction.txId
        );

        if (depositIndex !== -1) {
            user.wallet.depositHistory[depositIndex].status = 'failed';
            await user.save();
        }

        // Emit failed event
        this.emit('payment:failed', {
            userId: user._id,
            transaction
        });
    }

    async handleWithdrawal(payload) {
        const { status, uuid, order_id, amount, currency, network, address } = payload;

        try {
            // Extract user ID from order_id (format: withdrawal_userId_timestamp)
            const userId = order_id.split('_')[1];
            if (!userId) {
                throw new Error('Invalid order ID format');
            }

            // Find user
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update transaction status
            const transaction = {
                txId: uuid,
                type: 'withdrawal',
                status,
                amount: parseFloat(amount),
                currency,
                network,
                address,
                timestamp: new Date()
            };

            // Handle different withdrawal statuses
            switch (status) {
                case 'completed':
                    await this.handleSuccessfulWithdrawal(user, transaction);
                    break;
                case 'pending':
                    await this.handlePendingWithdrawal(user, transaction);
                    break;
                case 'failed':
                    await this.handleFailedWithdrawal(user, transaction);
                    break;
                default:
                    throw new Error(`Unsupported withdrawal status: ${status}`);
            }

            this.emit('withdrawal:processed', {
                userId: user._id,
                transaction
            });

            return { success: true };
        } catch (error) {
            console.error('Withdrawal handling error:', error);
            this.emit('withdrawal:error', {
                error: error.message,
                payload
            });
            throw error;
        }
    }

    async handleSuccessfulWithdrawal(user, transaction) {
        // Update withdrawal history
        const withdrawalIndex = user.wallet.withdrawalHistory.findIndex(
            w => w.txid === transaction.txId
        );

        if (withdrawalIndex !== -1) {
            user.wallet.withdrawalHistory[withdrawalIndex].status = 'completed';
            await user.save();
        }

        // Emit success event
        this.emit('withdrawal:success', {
            userId: user._id,
            transaction
        });
    }

    async handlePendingWithdrawal(user, transaction) {
        // Update pending withdrawal in history
        const withdrawalIndex = user.wallet.withdrawalHistory.findIndex(
            w => w.txid === transaction.txId
        );

        if (withdrawalIndex === -1) {
            user.wallet.withdrawalHistory.push({
                amount: transaction.amount,
                network: transaction.network,
                address: transaction.address,
                txid: transaction.txId,
                status: 'pending',
                timestamp: transaction.timestamp
            });
            await user.save();
        }

        // Emit pending event
        this.emit('withdrawal:pending', {
            userId: user._id,
            transaction
        });
    }

    async handleFailedWithdrawal(user, transaction) {
        // Find the withdrawal in history
        const withdrawalIndex = user.wallet.withdrawalHistory.findIndex(
            w => w.txid === transaction.txId
        );

        if (withdrawalIndex !== -1) {
            const withdrawal = user.wallet.withdrawalHistory[withdrawalIndex];
            
            // Refund tokens to user's balance
            const tokenAmount = Math.floor(withdrawal.amount * cryptoService.config.conversionRate);
            await user.addTokens(tokenAmount, {
                refund: true,
                amount: withdrawal.amount
            });

            // Update withdrawal status
            withdrawal.status = 'failed';
            await user.save();
        }

        // Emit failed event
        this.emit('withdrawal:failed', {
            userId: user._id,
            transaction
        });
    }

    async handleRefund(payload) {
        const { status, uuid, order_id, amount, currency, network, address } = payload;

        try {
            // Extract user ID from order_id
            const userId = order_id.split('_')[1];
            if (!userId) {
                throw new Error('Invalid order ID format');
            }

            // Find user
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Process refund
            if (status === 'completed') {
                const tokenAmount = Math.floor(parseFloat(amount) * cryptoService.config.conversionRate);
                
                // Add refunded tokens back to user's balance
                await user.addTokens(tokenAmount, {
                    refund: true,
                    amount: parseFloat(amount)
                });

                // Update transaction history
                const transaction = {
                    txId: uuid,
                    type: 'refund',
                    status: 'completed',
                    amount: parseFloat(amount),
                    currency,
                    network,
                    address,
                    timestamp: new Date()
                };

                // Add refund to history
                user.wallet.depositHistory.push({
                    ...transaction,
                    status: 'refunded'
                });

                await user.save();

                // Emit refund event
                this.emit('refund:completed', {
                    userId: user._id,
                    tokenAmount,
                    transaction
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Refund handling error:', error);
            this.emit('refund:error', {
                error: error.message,
                payload
            });
            throw error;
        }
    }
}

module.exports = new WebhookService();
