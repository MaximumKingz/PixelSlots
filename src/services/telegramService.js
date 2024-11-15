const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

class TelegramService {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
        this.webAppUrl = 'https://t.me/PixelSlotsBot/game'; // We'll update this after deployment
    }

    async setupWebhook(url) {
        try {
            await this.bot.setWebHook(`${url}/api/telegram/webhook`);
            console.log('Telegram webhook set up successfully');
        } catch (error) {
            console.error('Failed to set up Telegram webhook:', error);
            throw error;
        }
    }

    async sendWelcomeMessage(chatId) {
        const welcomeMessage = `🎰 Welcome to Pixel Slots! 🎮

Play our crypto slot machine game with beautiful pixel art graphics!

Features:
• Multiple cryptocurrencies supported
• Instant deposits and withdrawals
• Progressive jackpots
• Daily rewards
• VIP program

Tap the button below to start playing! 🚀`;

        const gameButton = {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🎮 Play Now!',
                        web_app: { url: this.webAppUrl }
                    }
                ]]
            }
        };

        try {
            await this.bot.sendMessage(chatId, welcomeMessage, gameButton);
        } catch (error) {
            console.error('Failed to send welcome message:', error);
            throw error;
        }
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        await this.sendWelcomeMessage(chatId);
    }

    async handleCallback(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            switch (callbackQuery.data) {
                case 'play':
                    await this.bot.sendMessage(chatId, '🎮 Loading game...');
                    break;
                    
                case 'deposit':
                    await this.bot.sendMessage(chatId, '💰 Opening deposit menu...');
                    break;
                    
                case 'withdraw':
                    await this.bot.sendMessage(chatId, '💳 Opening withdrawal menu...');
                    break;
                    
                case 'help':
                    await this.bot.sendMessage(chatId, '❓ Opening help section...');
                    break;
            }
        } catch (error) {
            console.error('Failed to handle callback:', error);
            throw error;
        }
    }

    async notifyWin(userId, amount, currency) {
        try {
            const message = `🎉 Congratulations! You won ${amount} ${currency}! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send win notification:', error);
        }
    }

    async notifyJackpot(userId, amount, currency) {
        try {
            const message = `🏆 JACKPOT WINNER! 🏆\nIncredible! You've won ${amount} ${currency}! 🎰✨`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send jackpot notification:', error);
        }
    }

    async notifyDeposit(userId, amount, currency, txHash) {
        try {
            const message = `✅ Deposit Confirmed!\n\nAmount: ${amount} ${currency}\nTransaction: ${txHash}\n\nYour balance has been updated. Good luck! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send deposit notification:', error);
        }
    }

    async notifyWithdrawal(userId, amount, currency, txHash) {
        try {
            const message = `💸 Withdrawal Processed!\n\nAmount: ${amount} ${currency}\nTransaction: ${txHash}\n\nThank you for playing! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send withdrawal notification:', error);
        }
    }

    async sendDailyBonus(userId, amount, currency) {
        try {
            const message = `🎁 Daily Bonus!\n\nYou've received ${amount} ${currency}!\nCome back tomorrow for another bonus! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send daily bonus notification:', error);
        }
    }

    async notifyAchievement(userId, achievement) {
        try {
            const message = `🏅 Achievement Unlocked!\n\n${achievement.name}\n${achievement.description}\n\nReward: ${achievement.reward} 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send achievement notification:', error);
        }
    }

    async notifyVIPUpgrade(userId, newLevel) {
        try {
            const message = `⭐️ VIP Level Up!\n\nCongratulations! You're now VIP Level ${newLevel}!\n\nEnjoy new benefits and rewards! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send VIP upgrade notification:', error);
        }
    }

    async sendMaintenanceNotice(userId) {
        try {
            const message = `🛠 Maintenance Notice\n\nWe're performing some quick maintenance to improve your gaming experience.\nPlease try again in a few minutes! 🎰`;
            await this.bot.sendMessage(userId, message);
        } catch (error) {
            console.error('Failed to send maintenance notice:', error);
        }
    }

    async handleError(error, userId) {
        try {
            const message = `❌ Error\n\nSomething went wrong. Please try again later.\nIf the problem persists, contact support.`;
            await this.bot.sendMessage(userId, message);
        } catch (err) {
            console.error('Failed to send error message:', err);
        }
    }
}

module.exports = new TelegramService();
