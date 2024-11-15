class PixelSlots {
    constructor() {
        console.log('Starting game initialization...');

        // Initialize Telegram WebApp
        this.webApp = window.Telegram.WebApp;
        
        // Log Telegram initialization
        console.log('=== TELEGRAM INITIALIZATION ===');
        console.log('WebApp Version:', this.webApp.version);
        console.log('Platform:', this.webApp.platform);
        console.log('Init Data:', this.webApp.initData);
        console.log('Init Data Unsafe:', this.webApp.initDataUnsafe);
        
        // Verify Telegram user
        const user = this.webApp.initDataUnsafe?.user;
        if (!user || !user.id) {
            throw new Error('Please open in Telegram!');
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
        
        // Default values
        this.balance = 10.00; // Start with $10
        this.bet = 0.10;
        this.jackpot = 1000.00;
        this.isSpinning = false;
        this.autoPlayActive = false;

        // Initialize UI first
        this.initializeUI();

        // Load user data
        this.loadUserData().then(() => {
            console.log('Game ready to play!');
            // Enable spin button
            this.spinButton.disabled = false;
        }).catch(error => {
            console.error('Error loading user data:', error);
            // Disable spin button
            this.spinButton.disabled = true;
            alert(error.message);
        });
    }

    async loadUserData() {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe?.user;
            if (!user || !user.id) {
                throw new Error('Please open in Telegram!');
            }

            // Get user info
            const telegramId = user.id.toString();
            const username = user.username || user.first_name || '';
            
            console.log('=== LOADING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            console.log('Username:', username);
            
            // Get user data from Supabase
            let { data: userData, error } = await window.supabase
                .from('users')
                .select('*')
                .eq('telegram_id', telegramId)
                .single();

            // Create new user if doesn't exist
            if (error || !userData) {
                const newUser = {
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
                    last_spin: new Date().toISOString(),
                    last_win: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                console.log('Creating new user with data:', newUser);
                const { data, error: insertError } = await window.supabase
                    .from('users')
                    .insert([newUser])
                    .select()
                    .single();

                if (insertError) throw insertError;
                userData = data;
                console.log('Created new user');
            } else {
                console.log('Found existing user:', userData);
            }

            // Update balance and display
            this.balance = userData.balance;
            this.updateBalanceDisplay();
            this.updateBetDisplay();
            this.updateWinTable();
            this.updateJackpot(1000.00);

            // Set initial symbols
            this.reels.forEach(reel => {
                reel.querySelector('.symbol').textContent = this.getRandomSymbol();
            });

            console.log('Balance Updated:', this.balance);
            return userData;
        } catch (error) {
            console.error('Error loading user:', error);
            throw error; // Re-throw to handle in constructor
        }
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe?.user;
            if (!user || !user.id) {
                throw new Error('Please open in Telegram!');
            }

            // Get user info
            const telegramId = user.id.toString();
            
            console.log('=== SAVING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            console.log('Current Balance:', this.balance);
            
            // Get current data
            let { data: userData, error } = await window.supabase
                .from('users')
                .select('*')
                .eq('telegram_id', telegramId)
                .single();

            if (error) throw error;
            
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
                }
            } else {
                updates.total_losses = userData.total_losses + 1;
                updates.total_loss_amount = userData.total_loss_amount + winAmount;
            }

            // Save to Supabase
            console.log('Saving updates:', updates);
            const { data: updatedData, error: updateError } = await window.supabase
                .from('users')
                .update(updates)
                .eq('telegram_id', telegramId)
                .select()
                .single();

            if (updateError) throw updateError;
            console.log('Updated user data:', updatedData);

            return updatedData;
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        }
    }

    async spin() {
        if (this.isSpinning) return;
        if (this.balance < this.bet) {
            alert('Not enough balance!');
            return;
        }

        // Disable spin button
        this.spinButton.disabled = true;

        this.isSpinning = true;
        this.balance -= this.bet;
        this.updateBalanceDisplay();

        try {
            this.reels.forEach(reel => reel.classList.add('spinning'));
            this.webApp.HapticFeedback.impactOccurred('light');

            // Simulate spinning delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get random symbols
            const symbols = this.reels.map(() => this.getRandomSymbol());
            
            // Update reels
            this.reels.forEach((reel, i) => {
                reel.querySelector('.symbol').textContent = symbols[i];
                reel.classList.remove('spinning');
            });

            // Check for win
            await this.checkWin(symbols);
        } catch (error) {
            console.error('Spin error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.isSpinning = false;
            // Enable spin button if we have enough balance
            this.spinButton.disabled = this.balance < this.bet;

            if (this.autoPlayActive && this.balance >= this.bet) {
                setTimeout(() => this.spin(), 1000);
            }
        }
    }

    async checkWin(symbols) {
        // All symbols match
        if (symbols.every(s => s === symbols[0])) {
            const symbol = symbols[0];
            const multiplier = this.symbolValues[symbol];
            const winAmount = this.bet * multiplier;

            // Update balance
            this.balance += winAmount;
            this.updateBalanceDisplay();

            // Show win
            this.winAmount.textContent = this.formatMoney(winAmount);
            this.winOverlay.style.display = 'flex';

            // Save win
            await this.saveUserData(winAmount, true, symbol === this.jackpotSymbol);

            // Haptic feedback
            this.webApp.HapticFeedback.notificationOccurred('success');
        } else {
            // Save loss
            await this.saveUserData(this.bet, false, false);
        }
    }

    initializeUI() {
        console.log('Initializing UI...');

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

        // Disable spin button initially
        this.spinButton.disabled = true;

        // Add event listeners
        this.spinButton.addEventListener('click', () => this.spin());
        this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());
        this.maxBetButton.addEventListener('click', () => this.setMaxBet());
        this.decreaseBetButton.addEventListener('click', () => this.adjustBet(-0.10));
        this.increaseBetButton.addEventListener('click', () => this.adjustBet(0.10));
        this.collectWinButton.addEventListener('click', () => this.hideWinDisplay());

        // Update displays
        this.updateBalanceDisplay();
        this.updateBetDisplay();

        console.log('UI initialized');
    }

    getRandomSymbol() {
        const random = Math.random();
        if (random < 0.0001) { // 0.01% chance for jackpot
            return this.jackpotSymbol;
        }
        return this.regularSymbols[Math.floor(Math.random() * this.regularSymbols.length)];
    }

    updateBalanceDisplay() {
        if (this.balanceDisplay) {
            console.log('Updating balance display:', this.balance);
            this.balanceDisplay.textContent = this.formatMoney(this.balance);
            // Update spin button state
            this.spinButton.disabled = this.balance < this.bet;
        }
    }

    updateBetDisplay() {
        if (this.currentBetDisplay) {
            this.currentBetDisplay.textContent = this.formatMoney(this.bet);
        }
    }

    updateJackpot(amount) {
        if (this.jackpotDisplay) {
            this.jackpotDisplay.textContent = this.formatMoney(amount);
        }
    }

    updateWinTable() {
        const rows = document.querySelectorAll('.win-row');
        rows.forEach(row => {
            const symbols = row.querySelector('span:first-child')?.textContent;
            if (symbols) {
                const symbol = symbols[0]; // Get first symbol (they're all the same)
                const multiplier = this.symbolValues[symbol];
                if (multiplier) {
                    row.querySelector('span:last-child').textContent = 
                        symbol === this.jackpotSymbol ? 'JACKPOT' : `x${multiplier}`;
                }
            }
        });
    }

    toggleAutoPlay() {
        this.autoPlayActive = !this.autoPlayActive;
        this.autoPlayButton.classList.toggle('active', this.autoPlayActive);
        if (this.autoPlayActive && !this.isSpinning && this.balance >= this.bet) {
            this.spin();
        }
    }

    setMaxBet() {
        this.bet = Math.min(this.balance, 1.00);
        this.updateBetDisplay();
    }

    adjustBet(amount) {
        const newBet = Math.max(0.10, Math.min(this.balance, this.bet + amount));
        if (newBet !== this.bet) {
            this.bet = newBet;
            this.updateBetDisplay();
        }
    }

    hideWinDisplay() {
        this.winOverlay.style.display = 'none';
    }

    formatMoney(amount) {
        return '$' + amount.toFixed(2);
    }
}

// Initialize game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing game...');
    try {
        window.game = new PixelSlots();
    } catch (error) {
        console.error('Game initialization error:', error);
        alert(error.message);
    }
});
