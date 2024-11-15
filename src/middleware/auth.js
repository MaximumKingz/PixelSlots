const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = {
    // Admin verification middleware
    verifyAdmin: async (req, res, next) => {
        try {
            // Check for auth token
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No token provided'
                });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Unauthorized access'
                });
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            console.error('Admin verification error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    },

    // User authentication middleware
    verifyUser: async (req, res, next) => {
        try {
            // Check for auth token
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No token provided'
                });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(403).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Update last active timestamp
            user.lastActive = new Date();
            await user.save();

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            console.error('User verification error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    },

    // Generate authentication token
    generateToken: (userId) => {
        return jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    },

    // Verify Telegram authentication
    verifyTelegram: async (req, res, next) => {
        try {
            const { initData } = req.body;
            if (!initData) {
                return res.status(401).json({
                    success: false,
                    error: 'No Telegram data provided'
                });
            }

            // Verify Telegram data
            const data = new URLSearchParams(initData);
            const hash = data.get('hash');
            data.delete('hash');
            data.sort();

            const dataString = Array.from(data.entries())
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');

            const secretKey = crypto
                .createHmac('sha256', 'WebAppData')
                .update(process.env.TELEGRAM_BOT_TOKEN)
                .digest();

            const generatedHash = crypto
                .createHmac('sha256', secretKey)
                .update(dataString)
                .digest('hex');

            if (generatedHash !== hash) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid Telegram authentication'
                });
            }

            // Get user data
            const userData = JSON.parse(data.get('user'));
            
            // Find or create user
            let user = await User.findOne({ telegramId: userData.id });
            if (!user) {
                user = await User.create({
                    telegramId: userData.id,
                    username: userData.username,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    tokens: 0,
                    wallet: {
                        depositHistory: [],
                        withdrawalHistory: []
                    },
                    stats: {
                        totalDeposited: 0,
                        totalWithdrawn: 0,
                        totalWagered: 0,
                        totalWon: 0,
                        gamesPlayed: 0,
                        biggestWin: 0,
                        deposits: [],
                        withdrawals: []
                    },
                    achievements: [],
                    lastActive: new Date()
                });
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            console.error('Telegram verification error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid Telegram authentication'
            });
        }
    },

    // Rate limiting middleware
    rateLimit: (limit, window) => {
        const requests = new Map();

        return (req, res, next) => {
            const ip = req.ip;
            const now = Date.now();
            const windowStart = now - window;

            // Clean up old requests
            requests.forEach((timestamps, key) => {
                requests.set(key, timestamps.filter(time => time > windowStart));
            });

            // Get request timestamps for this IP
            const timestamps = requests.get(ip) || [];
            
            // Check rate limit
            if (timestamps.length >= limit) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests'
                });
            }

            // Add new request timestamp
            timestamps.push(now);
            requests.set(ip, timestamps);

            next();
        };
    },

    // Socket authentication middleware
    verifySocket: async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);

            if (!user) {
                return next(new Error('User not found'));
            }

            // Attach user to socket
            socket.user = user;
            next();
        } catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Invalid token'));
        }
    }
};

module.exports = auth;
