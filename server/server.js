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

// Get user data
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        let user = await User.findOne({ telegramId });
        
        // Create new user if not exists
        if (!user) {
            user = await User.create({
                telegramId,
                username: req.query.username,
                balance: 10.00
            });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user balance and stats
app.post('/api/user/:telegramId/update', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const { balance, isWin, winAmount, isJackpot } = req.body;
        
        const updateData = {
            balance,
            lastUpdated: Date.now(),
            lastSpin: Date.now()
        };

        // Update stats
        const statsUpdate = {
            'stats.totalSpins': 1
        };

        if (isWin) {
            statsUpdate['stats.totalWins'] = 1;
            statsUpdate['stats.totalWinAmount'] = winAmount;
            updateData.lastWin = Date.now();

            if (isJackpot) {
                statsUpdate['stats.jackpotsWon'] = 1;
            }
        } else {
            statsUpdate['stats.totalLosses'] = 1;
            statsUpdate['stats.totalLossAmount'] = winAmount;
        }
        
        const user = await User.findOneAndUpdate(
            { telegramId },
            {
                $set: updateData,
                $inc: statsUpdate,
                $max: {
                    'stats.biggestWin': winAmount || 0
                }
            },
            { new: true }
        );
        
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Server error' });
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
            stats: user.stats,
            lastSpin: user.lastSpin,
            lastWin: user.lastWin,
            created: user.created
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
