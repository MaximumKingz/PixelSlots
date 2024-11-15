const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true // Ensures each Telegram user is saved only once
    },
    username: String,
    balance: {
        type: Number,
        default: 10.00 // Initial bonus for new users
    },
    hasReceivedBonus: {
        type: Boolean,
        default: true // Marks that they've received their initial bonus
    },
    stats: {
        totalSpins: {
            type: Number,
            default: 0
        },
        totalWins: {
            type: Number,
            default: 0
        },
        totalLosses: {
            type: Number,
            default: 0
        },
        biggestWin: {
            type: Number,
            default: 0
        },
        totalWinAmount: {
            type: Number,
            default: 0
        },
        totalLossAmount: {
            type: Number,
            default: 0
        },
        jackpotsWon: {
            type: Number,
            default: 0
        }
    },
    lastSpin: Date,
    lastWin: Date,
    created: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
