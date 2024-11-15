const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    tokens: {
        type: Number,
        default: 0
    },
    vip: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    consecutiveLogins: {
        type: Number,
        default: 1
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
        biggestWin: {
            type: Number,
            default: 0
        },
        totalDeposited: {
            type: Number,
            default: 0
        },
        totalWithdrawn: {
            type: Number,
            default: 0
        },
        totalWinAmount: {
            type: Number,
            default: 0
        },
        jackpotWins: {
            type: Number,
            default: 0
        },
        dailySpins: {
            type: Number,
            default: 0
        },
        maxBets: {
            type: Number,
            default: 0
        },
        currentWinStreak: {
            type: Number,
            default: 0
        },
        highestWinStreak: {
            type: Number,
            default: 0
        },
        totalDepositValue: {
            type: Number,
            default: 0
        },
        deposits: [{
            amount: Number,
            timestamp: Date
        }],
        lastDailyReset: {
            type: Date,
            default: Date.now
        }
    },
    achievements: {
        unlocked: [{
            type: String,  
            unlockedAt: {
                type: Date,
                default: Date.now
            }
        }],
        progress: {
            type: Map,
            of: Number,
            default: () => new Map()
        }
    },
    wallet: {
        depositAddress: String,
        withdrawalAddress: String,
        lightningAddress: String,
        lightningWithdrawalAddress: String,
        lastWithdrawal: Date,
        withdrawalHistory: [{
            amount: Number,
            network: String,
            address: String,
            txid: String,
            status: String,
            timestamp: Date
        }],
        depositHistory: [{
            amount: Number,
            network: String,
            address: String,
            txid: String,
            status: String,
            timestamp: Date
        }]
    }
}, {
    timestamps: true
});

userSchema.methods.checkAndResetDailyStats = async function() {
    const now = new Date();
    const lastReset = this.stats.lastDailyReset;
    const resetNeeded = !lastReset || 
        now.getUTCDate() !== lastReset.getUTCDate() ||
        now.getUTCMonth() !== lastReset.getUTCMonth() ||
        now.getUTCFullYear() !== lastReset.getUTCFullYear();

    if (resetNeeded) {
        this.stats.dailySpins = 0;
        this.stats.lastDailyReset = now;
        await this.save();
    }
};

userSchema.methods.updateLoginStreak = async function() {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);
    
    if (this.lastLogin < twoDaysAgo) {
        this.consecutiveLogins = 1;
    } else if (this.lastLogin < oneDayAgo) {
        this.consecutiveLogins += 1;
    }
    
    this.lastLogin = now;
    await this.save();
    
    return {
        streak: this.consecutiveLogins,
        isNewDay: this.lastLogin < oneDayAgo
    };
};

userSchema.methods.addTokens = async function(amount, context = {}) {
    this.tokens += amount;
    
    if (context.win) {
        this.stats.totalWinAmount += amount;
        if (amount > this.stats.biggestWin) {
            this.stats.biggestWin = amount;
        }
    }
    
    await this.save();
    return this.tokens;
};

userSchema.methods.removeTokens = async function(amount) {
    if (this.tokens < amount) {
        throw new Error('Insufficient tokens');
    }
    this.tokens -= amount;
    await this.save();
    return this.tokens;
};

userSchema.methods.updateWinStreak = async function(isWin) {
    if (isWin) {
        this.stats.currentWinStreak++;
        if (this.stats.currentWinStreak > this.stats.highestWinStreak) {
            this.stats.highestWinStreak = this.stats.currentWinStreak;
        }
    } else {
        this.stats.currentWinStreak = 0;
    }
    await this.save();
};

userSchema.methods.recordSpin = async function(betAmount, winAmount, isJackpot) {
    await this.checkAndResetDailyStats();
    
    this.stats.totalSpins++;
    this.stats.dailySpins++;
    
    if (betAmount === 1000) { 
        this.stats.maxBets++;
    }
    
    if (winAmount > 0) {
        this.stats.totalWins++;
        await this.updateWinStreak(true);
        
        if (isJackpot) {
            this.stats.jackpotWins++;
        }
    } else {
        await this.updateWinStreak(false);
    }
    
    await this.save();
};

userSchema.methods.getAchievementProgress = function(achievementId) {
    return this.achievements.progress.get(achievementId) || 0;
};

userSchema.methods.updateAchievementProgress = async function(achievementId, progress) {
    this.achievements.progress.set(achievementId, progress);
    await this.save();
};

userSchema.methods.hasAchievement = function(achievementId) {
    return this.achievements.unlocked.some(a => a === achievementId);
};

userSchema.methods.unlockAchievement = async function(achievementId) {
    if (!this.hasAchievement(achievementId)) {
        this.achievements.unlocked.push({
            achievementId,
            unlockedAt: new Date()
        });
        await this.save();
        return true;
    }
    return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
