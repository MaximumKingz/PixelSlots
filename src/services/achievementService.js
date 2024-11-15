const mongoose = require('mongoose');
const User = require('../models/user');

class AchievementService {
    constructor() {
        this.achievements = {
            // Beginner Achievements
            firstSpin: {
                id: 'firstSpin',
                name: 'First Spin',
                description: 'Complete your first spin',
                reward: 50,
                category: 'beginner',
                icon: '🎰'
            },
            firstWin: {
                id: 'firstWin',
                name: 'Lucky Start',
                description: 'Win your first game',
                reward: 100,
                category: 'beginner',
                icon: '🍀'
            },
            firstDeposit: {
                id: 'firstDeposit',
                name: 'Crypto Pioneer',
                description: 'Make your first deposit',
                reward: 200,
                category: 'beginner',
                icon: '💰'
            },

            // Milestone Achievements
            spins100: {
                id: 'spins100',
                name: 'Dedicated Player',
                description: 'Spin 100 times',
                reward: 500,
                category: 'milestone',
                icon: '🌟'
            },
            spins1000: {
                id: 'spins1000',
                name: 'Slot Veteran',
                description: 'Spin 1,000 times',
                reward: 2000,
                category: 'milestone',
                icon: '👑'
            },
            totalWins1000: {
                id: 'totalWins1000',
                name: 'Fortune Seeker',
                description: 'Win a total of 1,000 tokens',
                reward: 1000,
                category: 'milestone',
                icon: '💎'
            },

            // Jackpot Achievements
            firstJackpot: {
                id: 'firstJackpot',
                name: 'Jackpot Winner',
                description: 'Win your first jackpot',
                reward: 5000,
                category: 'jackpot',
                icon: '🏆'
            },
            threeJackpots: {
                id: 'threeJackpots',
                name: 'Jackpot Master',
                description: 'Win 3 jackpots',
                reward: 10000,
                category: 'jackpot',
                icon: '👑'
            },

            // Daily Achievements
            dailyLogin: {
                id: 'dailyLogin',
                name: 'Daily Player',
                description: 'Log in for consecutive days',
                reward: 100,
                category: 'daily',
                icon: '📅',
                streakBonus: (streak) => Math.min(streak * 50, 500)
            },
            dailySpins10: {
                id: 'dailySpins10',
                name: 'Daily Spinner',
                description: 'Spin 10 times in a day',
                reward: 200,
                category: 'daily',
                icon: '🎲'
            },

            // Special Achievements
            highRoller: {
                id: 'highRoller',
                name: 'High Roller',
                description: 'Place 10 maximum bets',
                reward: 5000,
                category: 'special',
                icon: '💸'
            },
            luckyStreak: {
                id: 'luckyStreak',
                name: 'Lucky Streak',
                description: 'Win 5 times in a row',
                reward: 1000,
                category: 'special',
                icon: '🔥'
            },
            cryptoWhale: {
                id: 'cryptoWhale',
                name: 'Crypto Whale',
                description: 'Deposit over 1 BTC worth of tokens',
                reward: 10000,
                category: 'special',
                icon: '🐋'
            }
        };

        // Achievement check functions
        this.checkFunctions = {
            firstSpin: (stats) => stats.totalSpins === 1,
            firstWin: (stats) => stats.totalWins === 1,
            firstDeposit: (stats) => stats.deposits.length === 1,
            spins100: (stats) => stats.totalSpins >= 100,
            spins1000: (stats) => stats.totalSpins >= 1000,
            totalWins1000: (stats) => stats.totalWinAmount >= 1000,
            firstJackpot: (stats) => stats.jackpotWins === 1,
            threeJackpots: (stats) => stats.jackpotWins >= 3,
            dailyLogin: (stats) => stats.loginStreak > 0,
            dailySpins10: (stats) => stats.dailySpins >= 10,
            highRoller: (stats) => stats.maxBets >= 10,
            luckyStreak: (stats) => stats.currentWinStreak >= 5,
            cryptoWhale: (stats) => stats.totalDepositValue >= 100000000 // 1 BTC in satoshis
        };
    }

    async checkAchievements(userId, context = {}) {
        const user = await User.findById(userId);
        if (!user) return [];

        const unlockedAchievements = [];
        const stats = user.stats;

        // Update stats based on context
        if (context.spin) {
            stats.totalSpins++;
            stats.dailySpins++;
            if (context.win) {
                stats.totalWins++;
                stats.totalWinAmount += context.winAmount;
                stats.currentWinStreak++;
                if (context.jackpot) {
                    stats.jackpotWins++;
                }
            } else {
                stats.currentWinStreak = 0;
            }
            if (context.betAmount === 1000) { // max bet
                stats.maxBets++;
            }
        }

        if (context.deposit) {
            stats.deposits.push({
                amount: context.depositAmount,
                timestamp: new Date()
            });
            stats.totalDepositValue += context.depositAmount;
        }

        // Check for new achievements
        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            if (!user.achievements.includes(achievementId) && 
                this.checkFunctions[achievementId](stats)) {
                unlockedAchievements.push(achievement);
                user.achievements.push(achievementId);
                
                // Add reward
                let reward = achievement.reward;
                if (achievement.streakBonus) {
                    reward += achievement.streakBonus(stats.loginStreak);
                }
                user.balance += reward;
            }
        }

        // Save updated user data
        await user.save();

        return unlockedAchievements;
    }

    async getDailyReward(userId) {
        const user = await User.findById(userId);
        if (!user) return null;

        const now = new Date();
        const lastLogin = user.lastLogin || new Date(0);

        // Reset streak if more than 48 hours have passed
        if (now - lastLogin > 48 * 60 * 60 * 1000) {
            user.stats.loginStreak = 0;
        }

        // Check if eligible for daily reward
        if (now - lastLogin < 24 * 60 * 60 * 1000) {
            return null;
        }

        // Update login streak and last login
        user.stats.loginStreak++;
        user.lastLogin = now;

        // Calculate reward
        const baseReward = 100;
        const streakBonus = Math.min(user.stats.loginStreak * 50, 500);
        const totalReward = baseReward + streakBonus;

        // Add reward to balance
        user.balance += totalReward;
        await user.save();

        return {
            reward: totalReward,
            streak: user.stats.loginStreak,
            nextReward: baseReward + Math.min((user.stats.loginStreak + 1) * 50, 500)
        };
    }

    async getAchievementProgress(userId) {
        const user = await User.findById(userId);
        if (!user) return null;

        const progress = {};
        const stats = user.stats;

        // Calculate progress for each achievement
        for (const [achievementId, achievement] of Object.entries(this.achievements)) {
            const isUnlocked = user.achievements.includes(achievementId);
            let progressValue = 0;

            switch (achievementId) {
                case 'spins100':
                    progressValue = Math.min(stats.totalSpins / 100, 1);
                    break;
                case 'spins1000':
                    progressValue = Math.min(stats.totalSpins / 1000, 1);
                    break;
                case 'totalWins1000':
                    progressValue = Math.min(stats.totalWinAmount / 1000, 1);
                    break;
                case 'threeJackpots':
                    progressValue = Math.min(stats.jackpotWins / 3, 1);
                    break;
                case 'dailySpins10':
                    progressValue = Math.min(stats.dailySpins / 10, 1);
                    break;
                case 'highRoller':
                    progressValue = Math.min(stats.maxBets / 10, 1);
                    break;
                case 'luckyStreak':
                    progressValue = Math.min(stats.currentWinStreak / 5, 1);
                    break;
                case 'cryptoWhale':
                    progressValue = Math.min(stats.totalDepositValue / 100000000, 1);
                    break;
                default:
                    progressValue = isUnlocked ? 1 : 0;
            }

            progress[achievementId] = {
                ...achievement,
                isUnlocked,
                progress: progressValue
            };
        }

        return progress;
    }
}

module.exports = new AchievementService();
