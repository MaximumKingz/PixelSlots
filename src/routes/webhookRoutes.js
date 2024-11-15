const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhookService');
const socketService = require('../services/socketService');

// Middleware to parse Cryptomus signature
const parseSignature = (req, res, next) => {
    const signature = req.headers['signature'];
    if (!signature) {
        return res.status(400).json({
            success: false,
            error: 'Missing signature header'
        });
    }
    req.signature = signature;
    next();
};

// Middleware to get client IP
const getClientIp = (req, res, next) => {
    req.clientIp = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress;
    next();
};

// Main webhook handler
router.post('/crypto', parseSignature, getClientIp, async (req, res) => {
    try {
        const result = await webhookService.handleWebhook(
            req.body,
            req.signature,
            req.clientIp
        );

        // Send immediate response to Cryptomus
        res.json({ success: true });

        // Handle socket notifications after response
        try {
            const { type, status, order_id } = req.body;
            const userId = order_id.split('_')[1];

            if (userId) {
                const notification = createNotification(type, status, req.body);
                socketService.sendToUser(userId, 'transaction:update', notification);
            }
        } catch (error) {
            console.error('Socket notification error:', error);
        }
    } catch (error) {
        console.error('Webhook handling error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Create user-friendly notification
function createNotification(type, status, payload) {
    const baseNotification = {
        type,
        status,
        amount: payload.amount,
        currency: payload.currency,
        network: payload.network,
        timestamp: new Date()
    };

    switch (type) {
        case 'payment':
            return createPaymentNotification(status, baseNotification);
        case 'withdrawal':
            return createWithdrawalNotification(status, baseNotification);
        case 'refund':
            return createRefundNotification(status, baseNotification);
        default:
            return baseNotification;
    }
}

function createPaymentNotification(status, notification) {
    switch (status) {
        case 'paid':
            notification.title = 'Deposit Successful';
            notification.message = `Your deposit of ${notification.amount} ${notification.currency} has been confirmed`;
            notification.icon = '✅';
            break;
        case 'pending':
            notification.title = 'Deposit Pending';
            notification.message = `Your deposit of ${notification.amount} ${notification.currency} is being processed`;
            notification.icon = '⏳';
            break;
        case 'expired':
            notification.title = 'Deposit Expired';
            notification.message = `Your deposit request has expired. Please try again`;
            notification.icon = '⚠️';
            break;
        case 'failed':
            notification.title = 'Deposit Failed';
            notification.message = `Your deposit of ${notification.amount} ${notification.currency} has failed`;
            notification.icon = '❌';
            break;
    }
    return notification;
}

function createWithdrawalNotification(status, notification) {
    switch (status) {
        case 'completed':
            notification.title = 'Withdrawal Successful';
            notification.message = `Your withdrawal of ${notification.amount} ${notification.currency} has been sent`;
            notification.icon = '✅';
            break;
        case 'pending':
            notification.title = 'Withdrawal Processing';
            notification.message = `Your withdrawal of ${notification.amount} ${notification.currency} is being processed`;
            notification.icon = '⏳';
            break;
        case 'failed':
            notification.title = 'Withdrawal Failed';
            notification.message = `Your withdrawal of ${notification.amount} ${notification.currency} has failed. Tokens have been refunded`;
            notification.icon = '❌';
            break;
    }
    return notification;
}

function createRefundNotification(status, notification) {
    if (status === 'completed') {
        notification.title = 'Refund Completed';
        notification.message = `Your refund of ${notification.amount} ${notification.currency} has been processed`;
        notification.icon = '💰';
    }
    return notification;
}

// Set up webhook event handlers
webhookService.on('payment:success', async (data) => {
    try {
        const { userId, tokenAmount, transaction } = data;
        
        // Send achievement check event
        socketService.sendToUser(userId, 'check:achievements', {
            type: 'deposit',
            amount: tokenAmount
        });

        // Update user's balance in real-time
        socketService.sendToUser(userId, 'balance:update', {
            balance: tokenAmount,
            type: 'deposit'
        });

        // Log successful payment
        console.log(`Successful payment for user ${userId}: ${tokenAmount} tokens`);
    } catch (error) {
        console.error('Payment success handler error:', error);
    }
});

webhookService.on('withdrawal:success', async (data) => {
    try {
        const { userId, transaction } = data;
        
        // Send achievement check event
        socketService.sendToUser(userId, 'check:achievements', {
            type: 'withdrawal',
            amount: transaction.amount
        });

        console.log(`Successful withdrawal for user ${userId}: ${transaction.amount} ${transaction.currency}`);
    } catch (error) {
        console.error('Withdrawal success handler error:', error);
    }
});

webhookService.on('webhook:error', async (data) => {
    console.error('Webhook error:', data.error);
    // Could add additional error handling here (e.g., alerting, monitoring)
});

module.exports = router;
