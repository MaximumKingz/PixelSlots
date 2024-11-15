require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();

// Allow requests from GitHub Pages
app.use(cors({
    origin: ['https://maximumkingz.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Basic health check
app.get('/', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Get or create user data
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        console.log('Looking for user:', telegramId);

        // First, try to find existing user
        let user = await User.findOne({ telegramId });
        
        if (user) {
            console.log('Found existing user:', user);
            return res.json(user);
        }

        // If no user exists, create a new one with $10 bonus
        console.log('Creating new user with $10 bonus');
        user = new User({
            telegramId,
            username: req.query.username || '',
            balance: 10.00,
            hasReceivedBonus: true,
            created: Date.now(),
            lastUpdated: Date.now(),
            stats: {
                totalSpins: 0,
                totalWins: 0,
                totalLosses: 0,
                biggestWin: 0,
                totalWinAmount: 0,
                totalLossAmount: 0,
                jackpotsWon: 0
            }
        });

        // Save the new user
        await user.save();
        console.log('New user created successfully:', user);
        
        res.json(user);
    } catch (error) {
        console.error('Error in user creation/retrieval:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

// Update user balance and stats
app.post('/api/user/:telegramId/update', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const { balance, isWin, winAmount, isJackpot } = req.body;

        console.log('Updating user:', telegramId, 'with balance:', balance);
        
        // Find user first
        const user = await User.findOne({ telegramId });
        if (!user) {
            console.error('User not found:', telegramId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare update data
        const updateData = {
            balance,
            lastUpdated: Date.now(),
            lastSpin: Date.now()
        };

        if (isWin) {
            updateData.lastWin = Date.now();
            await User.updateOne(
                { telegramId },
                {
                    $set: updateData,
                    $inc: {
                        'stats.totalSpins': 1,
                        'stats.totalWins': 1,
                        'stats.totalWinAmount': winAmount,
                        'stats.jackpotsWon': isJackpot ? 1 : 0
                    },
                    $max: {
                        'stats.biggestWin': winAmount
                    }
                }
            );
        } else {
            await User.updateOne(
                { telegramId },
                {
                    $set: updateData,
                    $inc: {
                        'stats.totalSpins': 1,
                        'stats.totalLosses': 1,
                        'stats.totalLossAmount': winAmount
                    }
                }
            );
        }

        // Get updated user data
        const updatedUser = await User.findOne({ telegramId });
        console.log('User updated successfully:', updatedUser);
        
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

// Get user statistics
app.get('/api/user/:telegramId/stats', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            telegramId: user.telegramId,
            username: user.username,
            balance: user.balance,
            stats: user.stats,
            lastSpin: user.lastSpin,
            lastWin: user.lastWin,
            created: user.created,
            hasReceivedBonus: user.hasReceivedBonus
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ 
            error: 'Server error',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
