class PixelSlots {
    constructor() {
        // Initialize Telegram WebApp
        this.webApp = window.Telegram.WebApp;
        
        // Log Telegram initialization
        console.log('=== TELEGRAM INITIALIZATION ===');
        console.log('WebApp Version:', this.webApp.version);
        console.log('Platform:', this.webApp.platform);
        
        // Verify Telegram user
        const user = this.webApp.initDataUnsafe?.user;
        if (!user || !user.id) {
            console.error('No Telegram user found:', user);
            alert('Please open this game in Telegram!');
            return;
        }

        // Log user data
        console.log('=== TELEGRAM USER ===');
        console.log('User ID:', user.id);
        console.log('Username:', user.username);
        console.log('First Name:', user.first_name);
        console.log('Last Name:', user.last_name);

        // Game configuration
        this.regularSymbols = ['🍒', '🍋', '🍊', '💎', '7️⃣'];
        this.jackpotSymbol = '🎰';
        this.symbolValues = {
            '🍒': 2,
            '🍋': 3,
            '🍊': 4,
            '💎': 10,
            '7️⃣': 20,
            '🎰': 10000
        };
        
        this.balance = 0;
        this.bet = 0.10;
        this.jackpot = 1000.00;
        this.isSpinning = false;
        this.autoPlayActive = false;
        
        // Firebase database
        this.database = firebase.database();
        this.analytics = firebase.analytics();
        this.userRef = null;

        // Track game load
        this.analytics.logEvent('game_loaded', {
            telegram_id: user.id,
            username: user.username
        });

        // Initialize game
        this.initializeGame();
    }

    async loadUserData() {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe?.user;
            if (!user || !user.id) {
                throw new Error('No Telegram user found!');
            }

            // Get user info
            const telegramId = user.id.toString();
            const username = user.username || user.first_name || '';
            
            console.log('=== LOADING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            console.log('Username:', username);
            
            // Get Firebase reference
            this.userRef = this.database.ref('users/' + telegramId);
            
            // Get user data
            const snapshot = await this.userRef.once('value');
            let userData = snapshot.val();
            
            // Create new user if doesn't exist
            if (!userData) {
                userData = {
                    telegram_id: telegramId,
                    username: username,
                    balance: 10.00,
                    total_spins: 0,
                    total_wins: 0,
                    total_losses: 0,
                    biggest_win: 0,
                    total_win_amount: 0,
                    total_loss_amount: 0,
                    jackpots_won: 0,
                    last_spin: null,
                    last_win: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                await this.userRef.set(userData);
                console.log('Created new user:', userData);

                // Track new user
                this.analytics.logEvent('new_user_created', {
                    telegram_id: telegramId,
                    username: username
                });
            } else {
                console.log('Found existing user:', userData);
            }

            // Update balance
            this.balance = userData.balance;
            this.updateBalanceDisplay();
            console.log('Balance Updated:', this.balance);

            return userData;
        } catch (error) {
            console.error('Error loading user:', error);
            alert('Error: ' + error.message);
            return null;
        }
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe?.user;
            if (!user || !user.id) {
                throw new Error('No Telegram user found!');
            }

            // Get user info
            const telegramId = user.id.toString();
            
            console.log('=== SAVING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            
            // Get current data
            const snapshot = await this.userRef.once('value');
            const userData = snapshot.val();
            
            // Update user data
            const updates = {
                balance: this.balance,
                total_spins: userData.total_spins + 1,
                updated_at: new Date().toISOString(),
                last_spin: new Date().toISOString()
            };

            if (isWin) {
                updates.total_wins = userData.total_wins + 1;
                updates.total_win_amount = userData.total_win_amount + winAmount;
                updates.biggest_win = Math.max(userData.biggest_win, winAmount);
                updates.last_win = new Date().toISOString();

                if (isJackpot) {
                    updates.jackpots_won = userData.jackpots_won + 1;
                    
                    // Track jackpot win
                    this.analytics.logEvent('jackpot_won', {
                        telegram_id: telegramId,
                        amount: winAmount
                    });
                }

                // Track win
                this.analytics.logEvent('game_win', {
                    telegram_id: telegramId,
                    amount: winAmount,
                    is_jackpot: isJackpot
                });
            } else {
                updates.total_losses = userData.total_losses + 1;
                updates.total_loss_amount = userData.total_loss_amount + winAmount;

                // Track loss
                this.analytics.logEvent('game_loss', {
                    telegram_id: telegramId,
                    amount: winAmount
                });
            }

            // Save to Firebase
            await this.userRef.update(updates);
            console.log('Updated user data:', updates);

            // Get updated data
            const newSnapshot = await this.userRef.once('value');
            const newUserData = newSnapshot.val();
            console.log('New user data:', newUserData);

            return newUserData;
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Error: ' + error.message);
            return null;
        }
    }

    async initializeGame() {
        try {
            // Initialize UI
            this.initializeUI();
            
            // Load user data
            const userData = await this.loadUserData();
            if (!userData) {
                throw new Error('Failed to load user data');
            }

            // Initialize game state
            this.updateBetDisplay();
            this.updateWinTable();
            this.updateJackpot(1000.00);

            // Set initial symbols
            this.reels.forEach(reel => {
                reel.querySelector('.symbol').textContent = this.getRandomSymbol();
            });

            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Game initialization failed:', error);
            alert('Error: ' + error.message);
        }
    }

    initializeUI() {
        // Get UI elements
        this.reels = Array.from(document.querySelectorAll('.reel'));
        this.spinButton = document.getElementById('spin-button');
        this.autoPlayButton = document.getElementById('auto-play');
        this.maxBetButton = document.getElementById('max-bet');
        this.decreaseBetButton = document.getElementById('decrease-bet');
        this.increaseBetButton = document.getElementById('increase-bet');
        this.currentBetDisplay = document.getElementById('current-bet');
        this.balanceDisplay = document.getElementById('balance');
        this.jackpotDisplay = document.getElementById('jackpot');
        this.winOverlay = document.getElementById('win-overlay');
        this.winAmount = document.getElementById('win-amount');
        this.collectWinButton = document.getElementById('collect-win');

        // Add event listeners
        this.spinButton.addEventListener('click', () => this.spin());
        this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());
        this.maxBetButton.addEventListener('click', () => this.setMaxBet());
        this.decreaseBetButton.addEventListener('click', () => this.adjustBet(-0.10));
        this.increaseBetButton.addEventListener('click', () => this.adjustBet(0.10));
        this.collectWinButton.addEventListener('click', () => this.hideWinDisplay());
    }

    updateBalanceDisplay() {
        if (this.balanceDisplay) {
            this.balanceDisplay.textContent = this.formatMoney(this.balance);
        }
    }

    getRandomSymbol() {
        // 0.01% chance for jackpot symbol (1 in 10,000)
        if (Math.random() < 0.0001) {
            return this.jackpotSymbol;
        }
        return this.regularSymbols[Math.floor(Math.random() * this.regularSymbols.length)];
    }

    updateBetDisplay() {
        this.currentBetDisplay.textContent = this.formatMoney(this.bet);
    }

    updateWinTable() {
        const winAmounts = document.querySelectorAll('.win-amount:not(.jackpot)');
        winAmounts.forEach(amount => {
            const multiplier = parseInt(amount.textContent.replace('x', ''));
            amount.textContent = `${this.formatMoney(this.bet * multiplier)}`;
        });
    }

    updateJackpot(amount) {
        this.jackpot = amount;
        this.jackpotDisplay.textContent = this.formatMoney(amount);
    }

    async updateBalance(amount, winAmount = 0, isWin = false, isJackpot = false) {
        console.log('Updating balance:', {
            oldBalance: this.balance,
            newBalance: amount,
            winAmount,
            isWin,
            isJackpot
        });
        
        this.balance = amount;
        this.balanceDisplay.textContent = this.formatMoney(this.balance);
        await this.saveUserData(winAmount, isWin, isJackpot);
    }

    formatMoney(amount) {
        return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    adjustBet(amount) {
        const newBet = Math.max(0.10, Math.min(this.balance, this.bet + amount));
        if (newBet !== this.bet) {
            this.bet = newBet;
            this.updateBetDisplay();
            this.updateWinTable();
        }
    }

    setMaxBet() {
        this.bet = Math.floor(this.balance * 100) / 100;
        this.updateBetDisplay();
        this.updateWinTable();
    }

    toggleAutoPlay() {
        this.autoPlayActive = !this.autoPlayActive;
        this.autoPlayButton.classList.toggle('active');
        if (this.autoPlayActive && !this.isSpinning && this.balance >= this.bet) {
            this.spin();
        }
    }

    showWinDisplay(amount, isJackpot) {
        this.hideWinDisplay();
        this.winAmount.textContent = this.formatMoney(amount);
        this.winOverlay.classList.remove('hidden');
        if (isJackpot) {
            this.webApp.HapticFeedback.notificationOccurred('success');
            this.webApp.HapticFeedback.notificationOccurred('success');
            this.webApp.HapticFeedback.notificationOccurred('success');
        } else {
            this.webApp.HapticFeedback.notificationOccurred('success');
        }
    }

    hideWinDisplay() {
        this.winOverlay.classList.add('hidden');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkWin(symbols) {
        const isWin = symbols.every(s => s === symbols[0]);
        
        if (isWin) {
            const symbol = symbols[0];
            const multiplier = this.symbolValues[symbol];
            const winAmount = this.bet * multiplier;
            const isJackpot = symbol === this.jackpotSymbol;
            
            await this.updateBalance(this.balance + winAmount, winAmount, true, isJackpot);
            this.showWinDisplay(winAmount, isJackpot);
        } else {
            await this.saveUserData(this.bet, false, false);
        }
    }

    async spin() {
        if (this.isSpinning) return;
        if (this.balance < this.bet) {
            alert('Not enough balance!');
            return;
        }

        this.isSpinning = true;
        this.balance -= this.bet;
        this.updateBalanceDisplay();

        // Track spin
        this.analytics.logEvent('game_spin', {
            telegram_id: this.webApp.initDataUnsafe?.user?.id,
            bet_amount: this.bet
        });

        try {
            this.reels.forEach(reel => reel.classList.add('spinning'));
            this.webApp.HapticFeedback.impactOccurred('light');

            const finalSymbols = Array(3).fill(null).map(() => this.getRandomSymbol());

            for (let i = 0; i < this.reels.length; i++) {
                await this.delay(i === 0 ? 800 : 300);
                
                const reel = this.reels[i];
                reel.classList.remove('spinning');
                const symbol = reel.querySelector('.symbol');
                if (symbol) {
                    symbol.textContent = finalSymbols[i];
                }

                this.webApp.HapticFeedback.impactOccurred('rigid');
            }

            await this.delay(200);
            await this.checkWin(finalSymbols);
        } catch (error) {
            console.error('Spin error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.isSpinning = false;

            if (this.autoPlayActive && this.balance >= this.bet) {
                setTimeout(() => this.spin(), 1000);
            }
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PixelSlots();
});
