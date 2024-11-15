const axios = require('axios');
const User = require('../models/user');
const EventEmitter = require('events');

class CryptoService extends EventEmitter {
    constructor() {
        super();
        this.config = {
            apiUrl: 'https://api.cryptomus.com/v1',
            merchantId: process.env.CRYPTOMUS_MERCHANT_ID,
            apiKey: process.env.CRYPTOMUS_API_KEY,
            currencies: {
                BTC: {
                    name: 'Bitcoin',
                    symbol: 'BTC',
                    networks: ['bitcoin', 'lightning'],
                    conversionRate: 1000000,
                    minimumDeposit: 0.0001,
                    minimumWithdrawal: 0.0005,
                    icon: '₿'
                },
                ETH: {
                    name: 'Ethereum',
                    symbol: 'ETH',
                    networks: ['ethereum', 'arbitrum', 'optimism'],
                    conversionRate: 10000,
                    minimumDeposit: 0.01,
                    minimumWithdrawal: 0.05,
                    icon: 'Ξ'
                },
                USDT: {
                    name: 'Tether',
                    symbol: 'USDT',
                    networks: ['ethereum', 'tron', 'bsc'],
                    conversionRate: 1,
                    minimumDeposit: 10,
                    minimumWithdrawal: 20,
                    icon: '₮'
                },
                USDC: {
                    name: 'USD Coin',
                    symbol: 'USDC',
                    networks: ['ethereum', 'polygon', 'solana'],
                    conversionRate: 1,
                    minimumDeposit: 10,
                    minimumWithdrawal: 20,
                    icon: '$'
                },
                MATIC: {
                    name: 'Polygon',
                    symbol: 'MATIC',
                    networks: ['polygon', 'ethereum'],
                    conversionRate: 1,
                    minimumDeposit: 10,
                    minimumWithdrawal: 20,
                    icon: '⬡'
                }
            },
            fees: {
                regular: {
                    BTC: 0.01,
                    ETH: 0.01,
                    USDT: 0.01,
                    USDC: 0.01,
                    MATIC: 0.01
                },
                vip: {
                    BTC: 0.005,
                    ETH: 0.005,
                    USDT: 0.005,
                    USDC: 0.005,
                    MATIC: 0.005
                }
            },
            depositTimeout: 24 * 60 * 60 * 1000, // 24 hours
            maxPendingDeposits: 3
        };

        this.pendingTransactions = new Map();
        this.setupTransactionCleaner();
        this.setupPriceUpdater();
    }

    setupPriceUpdater() {
        this.prices = new Map();
        this.updatePrices();
        // Update prices every 5 minutes
        setInterval(() => this.updatePrices(), 5 * 60 * 1000);
    }

    async updatePrices() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: 'bitcoin,ethereum,tether,usd-coin,matic-network',
                    vs_currencies: 'usd'
                }
            });

            const data = response.data;
            this.prices.set('BTC', data['bitcoin'].usd);
            this.prices.set('ETH', data['ethereum'].usd);
            this.prices.set('USDT', data['tether'].usd);
            this.prices.set('USDC', data['usd-coin'].usd);
            this.prices.set('MATIC', data['matic-network'].usd);

            this.emit('prices:updated', Object.fromEntries(this.prices));
        } catch (error) {
            console.error('Price update error:', error);
        }
    }

    getTokenAmount(amount, currency) {
        const price = this.prices.get(currency) || 0;
        const conversionRate = this.config.currencies[currency].conversionRate;
        return Math.floor(amount * price * conversionRate);
    }

    getCryptoAmount(tokens, currency) {
        const price = this.prices.get(currency) || 0;
        const conversionRate = this.config.currencies[currency].conversionRate;
        return tokens / (price * conversionRate);
    }

    validateCurrency(currency) {
        return this.config.currencies.hasOwnProperty(currency);
    }

    validateNetwork(currency, network) {
        return this.config.currencies[currency].networks.includes(network);
    }

    async generateDepositAddress(userId, currency = 'BTC', network = 'bitcoin') {
        try {
            if (!this.validateCurrency(currency)) {
                throw new Error('Invalid currency');
            }

            if (!this.validateNetwork(currency, network)) {
                throw new Error('Invalid network for this currency');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check pending deposits limit
            const pendingDeposits = Array.from(this.pendingTransactions.values())
                .filter(tx => tx.userId === userId && tx.type === 'deposit');
            if (pendingDeposits.length >= this.config.maxPendingDeposits) {
                throw new Error('Maximum pending deposits reached');
            }

            const currencyConfig = this.config.currencies[currency];
            const payload = {
                currency,
                network,
                order_id: `deposit_${userId}_${Date.now()}`,
                url_callback: `${process.env.API_URL}/webhook/crypto`,
                is_payment_multiple: false,
                lifetime: this.config.depositTimeout / 1000,
                minimum_amount: currencyConfig.minimumDeposit
            };

            const response = await axios.post(
                `${this.config.apiUrl}/payment`,
                payload,
                { headers: this.getHeaders(payload) }
            );

            if (response.data.status === 'success') {
                const address = response.data.result.address;
                
                // Store pending transaction
                this.pendingTransactions.set(response.data.result.uuid, {
                    type: 'deposit',
                    userId,
                    currency,
                    address,
                    network,
                    timestamp: Date.now(),
                    status: 'pending'
                });

                // Update user's deposit address
                const addressKey = `${currency.toLowerCase()}Address`;
                user.wallet[addressKey] = address;
                await user.save();

                this.emit('deposit:created', {
                    userId,
                    currency,
                    address,
                    network,
                    txId: response.data.result.uuid
                });

                return {
                    address,
                    qrCode: response.data.result.qr_code,
                    expiresIn: this.config.depositTimeout,
                    minimumDeposit: currencyConfig.minimumDeposit,
                    currency,
                    network
                };
            }

            throw new Error('Failed to generate deposit address');
        } catch (error) {
            console.error('Deposit address generation error:', error);
            this.emit('error', {
                type: 'deposit_address_generation',
                error: error.message,
                userId,
                currency,
                network
            });
            throw error;
        }
    }

    async initiateWithdrawal(userId, amount, currency = 'BTC', network = 'bitcoin') {
        try {
            if (!this.validateCurrency(currency)) {
                throw new Error('Invalid currency');
            }

            if (!this.validateNetwork(currency, network)) {
                throw new Error('Invalid network for this currency');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const currencyConfig = this.config.currencies[currency];

            // Validate withdrawal request
            if (amount < currencyConfig.minimumWithdrawal) {
                throw new Error(`Minimum withdrawal is ${currencyConfig.minimumWithdrawal} ${currency}`);
            }

            const tokenAmount = this.getTokenAmount(amount, currency);
            if (user.tokens < tokenAmount) {
                throw new Error('Insufficient tokens');
            }

            const addressKey = `${currency.toLowerCase()}WithdrawalAddress`;
            const withdrawalAddress = user.wallet[addressKey];

            if (!withdrawalAddress) {
                throw new Error(`No ${currency} withdrawal address set for ${network} network`);
            }

            // Calculate fees
            const feeRate = user.vip ? this.config.fees.vip[currency] : this.config.fees.regular[currency];
            const fee = amount * feeRate;
            const netAmount = amount - fee;

            const payload = {
                currency,
                network,
                amount: netAmount.toFixed(8),
                address: withdrawalAddress,
                order_id: `withdrawal_${userId}_${Date.now()}`,
                is_subtract_fee_from_amount: true
            };

            const response = await axios.post(
                `${this.config.apiUrl}/withdrawal`,
                payload,
                { headers: this.getHeaders(payload) }
            );

            if (response.data.status === 'success') {
                // Store pending transaction
                this.pendingTransactions.set(response.data.result.uuid, {
                    type: 'withdrawal',
                    userId,
                    currency,
                    amount: netAmount,
                    network,
                    timestamp: Date.now(),
                    status: 'pending'
                });

                // Update user balance and stats
                await user.removeTokens(tokenAmount);
                user.stats.totalWithdrawn += tokenAmount;
                await user.save();

                // Emit withdrawal initiated event
                this.emit('withdrawal:initiated', {
                    userId,
                    amount: netAmount,
                    tokenAmount,
                    fee,
                    currency,
                    network,
                    txId: response.data.result.uuid
                });

                return {
                    status: 'success',
                    amount: netAmount,
                    fee,
                    currency,
                    network,
                    txid: response.data.result.uuid
                };
            }

            throw new Error('Withdrawal request failed');
        } catch (error) {
            console.error('Withdrawal error:', error);
            this.emit('error', {
                type: 'withdrawal_initiation',
                error: error.message,
                userId,
                amount,
                currency,
                network
            });
            throw error;
        }
    }

    async setWithdrawalAddress(userId, address, currency = 'BTC', network = 'bitcoin') {
        try {
            if (!this.validateCurrency(currency)) {
                throw new Error('Invalid currency');
            }

            if (!this.validateNetwork(currency, network)) {
                throw new Error('Invalid network for this currency');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Validate address based on currency and network
            if (!this.validateAddress(address, currency, network)) {
                throw new Error(`Invalid ${currency} address for ${network} network`);
            }

            // Set withdrawal address
            const addressKey = `${currency.toLowerCase()}WithdrawalAddress`;
            user.wallet[addressKey] = address;
            await user.save();

            this.emit('withdrawal_address:updated', {
                userId,
                currency,
                address,
                network
            });

            return true;
        } catch (error) {
            console.error('Set withdrawal address error:', error);
            this.emit('error', {
                type: 'withdrawal_address_update',
                error: error.message,
                userId,
                address,
                currency,
                network
            });
            throw error;
        }
    }

    validateAddress(address, currency, network) {
        const patterns = {
            BTC: {
                bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{11,71}$/,
                lightning: /^ln[a-z0-9]{1,1000}$/
            },
            ETH: {
                ethereum: /^0x[a-fA-F0-9]{40}$/,
                arbitrum: /^0x[a-fA-F0-9]{40}$/,
                optimism: /^0x[a-fA-F0-9]{40}$/
            },
            USDT: {
                ethereum: /^0x[a-fA-F0-9]{40}$/,
                tron: /^T[A-Za-z1-9]{33}$/,
                bsc: /^0x[a-fA-F0-9]{40}$/
            },
            USDC: {
                ethereum: /^0x[a-fA-F0-9]{40}$/,
                polygon: /^0x[a-fA-F0-9]{40}$/,
                solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
            },
            MATIC: {
                polygon: /^0x[a-fA-F0-9]{40}$/,
                ethereum: /^0x[a-fA-F0-9]{40}$/
            }
        };

        return patterns[currency]?.[network]?.test(address) || false;
    }

    async processDeposit(payload) {
        try {
            const { amount, address, status, uuid: txId, currency, network } = payload;
            
            if (status !== 'paid') {
                this.updateTransactionStatus(txId, status);
                return;
            }

            // Find user by address based on network
            const query = network === 'lightning' 
                ? { [`wallet.${currency.toLowerCase()}Address`]: address }
                : { [`wallet.${currency.toLowerCase()}Address`]: address };
            const user = await User.findOne(query);
            
            if (!user) {
                throw new Error('User not found for deposit address');
            }

            // Validate minimum deposit
            const tokenAmount = this.getTokenAmount(amount, currency);
            const currencyConfig = this.config.currencies[currency];
            if (tokenAmount < currencyConfig.minimumDeposit) {
                throw new Error('Deposit amount below minimum');
            }

            // Process the deposit
            await user.addTokens(tokenAmount, { deposit: true, amount });
            
            // Update transaction status
            this.updateTransactionStatus(txId, 'completed');

            // Update user stats
            user.stats.totalDeposited += tokenAmount;
            user.stats.deposits.push({
                amount: tokenAmount,
                cryptoAmount: amount,
                currency,
                network,
                timestamp: new Date()
            });
            await user.save();

            // Emit deposit success event
            this.emit('deposit:success', {
                userId: user._id,
                tokenAmount,
                cryptoAmount: amount,
                currency,
                network,
                txId
            });

            return {
                userId: user._id,
                tokenAmount,
                cryptoAmount: amount,
                currency,
                network
            };
        } catch (error) {
            console.error('Deposit processing error:', error);
            this.emit('error', {
                type: 'deposit_processing',
                error: error.message,
                payload
            });
            throw error;
        }
    }

    async getTransactionStatus(txId) {
        try {
            const pendingTx = this.pendingTransactions.get(txId);
            if (!pendingTx) {
                throw new Error('Transaction not found');
            }

            const response = await axios.get(
                `${this.config.apiUrl}/payment/status/${txId}`,
                { headers: this.getHeaders() }
            );

            const status = response.data.result.status;
            this.updateTransactionStatus(txId, status);

            return {
                status,
                timestamp: pendingTx.timestamp,
                type: pendingTx.type,
                currency: pendingTx.currency,
                network: pendingTx.network
            };
        } catch (error) {
            console.error('Transaction status check error:', error);
            this.emit('error', {
                type: 'transaction_status_check',
                error: error.message,
                txId
            });
            throw error;
        }
    }

    updateTransactionStatus(txId, status) {
        const tx = this.pendingTransactions.get(txId);
        if (tx) {
            tx.status = status;
            if (['completed', 'failed', 'expired'].includes(status)) {
                this.pendingTransactions.delete(txId);
            }
            this.emit('transaction:status_update', { txId, status });
        }
    }

    async getPendingTransactions(userId) {
        return Array.from(this.pendingTransactions.entries())
            .filter(([_, tx]) => tx.userId === userId)
            .map(([txId, tx]) => ({
                txId,
                ...tx
            }));
    }

    getNetworkFees(network = 'bitcoin') {
        return axios.get(
            `${this.config.apiUrl}/network-fees/${network}`,
            { headers: this.getHeaders() }
        ).then(response => response.data.result)
        .catch(error => {
            console.error('Network fees check error:', error);
            throw error;
        });
    }

    getHeaders(payload = '') {
        return {
            'merchant': this.config.merchantId,
            'sign': this.generateSign(payload),
            'Content-Type': 'application/json'
        };
    }

    generateSign(payload = '') {
        const crypto = require('crypto');
        const sign = crypto
            .createHash('md5')
            .update(Buffer.from(JSON.stringify(payload)).toString('base64') + this.config.apiKey)
            .digest('hex');
        return sign;
    }

    setupTransactionCleaner() {
        // Clean up expired pending transactions every hour
        setInterval(() => {
            const now = Date.now();
            for (const [txId, tx] of this.pendingTransactions) {
                if (now - tx.timestamp > this.config.depositTimeout) {
                    this.pendingTransactions.delete(txId);
                    this.emit('transaction:expired', txId);
                }
            }
        }, 60 * 60 * 1000);
    }
}

module.exports = new CryptoService();
