const gameService = require('./gameService');
const cryptoService = require('./cryptoService');
const User = require('../models/user');

class SocketHandler {
    constructor(io) {
        this.io = io;
        this.userSessions = new Map();
    }

    initialize() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            // Handle user initialization
            socket.on('user:init', async (data) => {
                try {
                    await this.handleUserInit(socket, data);
                } catch (error) {
                    socket.emit('error', error.message);
                }
            });

            // Handle spin requests
            socket.on('spin:request', async (data) => {
                try {
                    await this.handleSpin(socket, data);
                } catch (error) {
                    socket.emit('error', error.message);
                }
            });

            // Handle crypto operations
            socket.on('crypto:generateAddress', async () => {
                try {
                    await this.handleGenerateAddress(socket);
                } catch (error) {
                    socket.emit('error', error.message);
                }
            });

            socket.on('crypto:withdraw', async (data) => {
                try {
                    await this.handleWithdrawal(socket, data);
                } catch (error) {
                    socket.emit('error', error.message);
                }
            });

            socket.on('crypto:setWithdrawalAddress', async (data) => {
                try {
                    await this.handleSetWithdrawalAddress(socket, data);
                } catch (error) {
                    socket.emit('error', error.message);
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    async handleUserInit(socket, { telegramId, username }) {
        let user = await User.findOne({ telegramId });

        if (!user) {
            user = new User({
                telegramId,
                username,
                tokens: 0 // Start with 0 tokens, user needs to deposit
            });
            await user.save();
        }

        // Update login streak
        await user.updateLoginStreak();

        // Store user session
        this.userSessions.set(socket.id, user._id);

        // Send initial data to client
        socket.emit('balance:update', user.tokens);
        socket.emit('jackpot:update', await gameService.getJackpot());
    }

    async handleSpin(socket, { bet }) {
        const userId = this.userSessions.get(socket.id);
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const result = await gameService.spin(userId, bet);
        socket.emit('spin:result', result);

        // Check for achievements
        const newAchievements = await gameService.checkAchievements(userId);
        if (newAchievements.length > 0) {
            socket.emit('achievements:unlocked', newAchievements);
        }

        // Broadcast jackpot update to all clients
        this.io.emit('jackpot:update', result.jackpot);
    }

    async handleGenerateAddress(socket) {
        const userId = this.userSessions.get(socket.id);
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const address = await cryptoService.generateDepositAddress(userId);
        socket.emit('crypto:address', { address });
    }

    async handleWithdrawal(socket, { amount }) {
        const userId = this.userSessions.get(socket.id);
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const result = await cryptoService.initiateWithdrawal(userId, amount);
        socket.emit('crypto:withdrawalStatus', result);
    }

    async handleSetWithdrawalAddress(socket, { address }) {
        const userId = this.userSessions.get(socket.id);
        if (!userId) {
            throw new Error('User not authenticated');
        }

        await cryptoService.setWithdrawalAddress(userId, address);
        socket.emit('crypto:addressSet', { success: true });
    }

    handleDisconnect(socket) {
        console.log('Client disconnected:', socket.id);
        this.userSessions.delete(socket.id);
    }
}

module.exports = (io) => new SocketHandler(io);
