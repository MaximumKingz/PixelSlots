const User = require('../models/user');
const cryptoService = require('./cryptoService');

class GameService {
    constructor() {
        this.config = {
            symbols: [
                { id: 'cherry', value: 2, probability: 0.2 },
                { id: 'lemon', value: 3, probability: 0.2 },
                { id: 'orange', value: 4, probability: 0.15 },
                { id: 'plum', value: 5, probability: 0.15 },
                { id: 'bell', value: 10, probability: 0.1 },
                { id: 'seven', value: 20, probability: 0.1 },
                { id: 'diamond', value: 50, probability: 0.07 },
                { id: 'bitcoin', value: 100, probability: 0.03 }
            ],
            jackpotContributionRate: 0.02,
            baseJackpot: 10000
        };

        this.jackpot = this.config.baseJackpot;
    }

    generateSymbol() {
        const random = Math.random();
        let cumulativeProbability = 0;

        for (const symbol of this.config.symbols) {
            cumulativeProbability += symbol.probability;
            if (random <= cumulativeProbability) {
                return symbol.id;
            }
        }

        return this.config.symbols[0].id; // Fallback to first symbol
    }

    calculateWin(symbols, bet) {
        let winAmount = 0;
        const symbolCounts = {};

        // Count symbols
        symbols.forEach(symbol => {
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        });

        // Check for wins
        Object.entries(symbolCounts).forEach(([symbol, count]) => {
            if (count >= 3) {
                const symbolConfig = this.config.symbols.find(s => s.id === symbol);
                winAmount = symbolConfig.value * bet;

                // Check for jackpot (all bitcoins)
                if (symbol === 'bitcoin' && count === symbols.length) {
                    winAmount = this.jackpot;
                    this.jackpot = this.config.baseJackpot;
                }
            }
        });

        return winAmount;
    }

    async spin(userId, bet) {
        try {
            const user = await User.findById(userId);
            if (!user || user.tokens < bet) {
                throw new Error('Insufficient tokens');
            }

            // Generate symbols
            const symbols = Array(3).fill(null).map(() => this.generateSymbol());

            // Calculate win
            const winAmount = this.calculateWin(symbols, bet);

            // Update jackpot
            this.jackpot += bet * this.config.jackpotContributionRate;

            // Update user balance
            await user.removeTokens(bet);
            if (winAmount > 0) {
                await user.addTokens(winAmount);
            }

            // Update user stats
            user.stats.totalSpins += 1;
            if (winAmount > 0) {
                user.stats.totalWins += 1;
                user.stats.biggestWin = Math.max(user.stats.biggestWin, winAmount);
            }
            await user.save();

            return {
                symbols,
                win: winAmount,
                newBalance: user.tokens,
                jackpot: this.jackpot
            };
        } catch (error) {
            console.error('Spin error:', error);
            throw error;
        }
    }

    async getJackpot() {
        return this.jackpot;
    }

    // Achievement checks
    async checkAchievements(userId) {
        try {
            const user = await User.findById(userId);
            const achievements = [];

            // Spin count achievements
            if (user.stats.totalSpins >= 100 && !this.hasAchievement(user, 'SPINS_100')) {
                achievements.push({
                    name: 'SPINS_100',
                    reward: 1000
                });
            }

            // Big win achievements
            if (user.stats.biggestWin >= 10000 && !this.hasAchievement(user, 'BIG_WINNER')) {
                achievements.push({
                    name: 'BIG_WINNER',
                    reward: 2000
                });
            }

            // Grant achievements
            for (const achievement of achievements) {
                user.achievements.push({
                    name: achievement.name,
                    unlockedAt: new Date(),
                    reward: achievement.reward
                });
                await user.addTokens(achievement.reward);
            }

            if (achievements.length > 0) {
                await user.save();
            }

            return achievements;
        } catch (error) {
            console.error('Achievement check error:', error);
            throw error;
        }
    }

    hasAchievement(user, achievementName) {
        return user.achievements.some(a => a.name === achievementName);
    }
}

module.exports = new GameService();
