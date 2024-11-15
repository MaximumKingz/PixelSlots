require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.TELEGRAM_WEBHOOK_URL;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
    process.exit(1);
}

if (!url) {
    console.error('TELEGRAM_WEBHOOK_URL is not set in environment variables');
    process.exit(1);
}

const bot = new TelegramBot(token);

async function setupWebhook() {
    try {
        // Delete any existing webhook
        await bot.deleteWebHook();
        console.log('Deleted existing webhook');

        // Set the new webhook
        const result = await bot.setWebHook(`${url}/api/telegram/webhook`);
        
        if (result) {
            console.log(`Successfully set webhook to: ${url}/api/telegram/webhook`);
            
            // Get webhook info
            const info = await bot.getWebHookInfo();
            console.log('Webhook Info:', info);
        } else {
            console.error('Failed to set webhook');
        }
    } catch (error) {
        console.error('Error setting up webhook:', error);
    } finally {
        process.exit();
    }
}

setupWebhook();
