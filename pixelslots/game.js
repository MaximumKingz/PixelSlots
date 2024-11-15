class PixelSlots {
    constructor(userData) {
        window.log('Starting game initialization with user data:', userData);

        // Initialize Telegram WebApp
        this.webApp = window.Telegram.WebApp;
        if (!this.webApp) {
            throw new Error('Please open in Telegram!');
        }
        
        // Log Telegram initialization
        window.log('=== TELEGRAM INITIALIZATION ===');
        window.log('WebApp Version:', this.webApp.version);
        window.log('Platform:', this.webApp.platform);
        window.log('Init Data:', this.webApp.initData);
        window.log('Init Data Unsafe:', this.webApp.initDataUnsafe);
        
        // Verify Telegram user
        const user = this.webApp.initDataUnsafe?.user;
        if (!user || !user.id) {
            throw new Error('Please open in Telegram!');
        }

        // Log user data
        window.log('=== TELEGRAM USER ===');
        window.log('User ID:', user.id);
        window.log('Username:', user.username);
        window.log('First Name:', user.first_name);
        window.log('Last Name:', user.last_name);

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
        
        // Set user data
        this.userData = userData;
        this.balance = userData.balance;
        this.bet = 0.10;
        this.jackpot = 1000.00;
        this.isSpinning = false;
        this.autoPlayActive = false;
        this.savingData = false;

        // Initialize UI first
        this.initializeUI();

        // Update displays
        this.updateBalanceDisplay();
        this.updateBetDisplay();
        this.updateWinTable();
        this.updateJackpot(1000.00);

        // Set initial symbols
        this.reels.forEach(reel => {
            reel.querySelector('.symbol').textContent = this.getRandomSymbol();
        });

        // Enable spin button
        this.spinButton.disabled = false;
        this.spinButton.textContent = 'SPIN!';

        window.log('Game initialized with balance:', this.balance);
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                // Get Telegram user
                const user = this.webApp.initDataUnsafe?.user;
                if (!user || !user.id) {
                    throw new Error('Please open in Telegram!');
                }

                // Get user info
                const telegramId = user.id.toString();
                
                window.log('=== SAVING USER DATA ===');
                window.log('Telegram ID:', telegramId);
                window.log('Current Balance:', this.balance);
                window.log('Retry Count:', retryCount);
                
                // Get current data
                let { data: userData, error } = await window.supabase
                    .from('users')
                    .select('*')
                    .eq('telegram_id', telegramId)
                    .single();

                if (error) throw error;
                if (!userData) throw new Error('User not found!');
                
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
                window.log('Saving updates:', updates);
                const { data: updatedData, error: updateError } = await window.supabase
                    .from('users')
                    .update(updates)
                    .eq('telegram_id', telegramId)
                    .select()
                    .single();

                if (updateError) throw updateError;
                window.log('Updated user data:', updatedData);

                return updatedData;
            } catch (error) {
                window.log('Error saving user (attempt ' + (retryCount + 1) + ' of ' + maxRetries + '):', error);
                retryCount++;
                
                if (retryCount === maxRetries) {
                    // On final retry, show error to user
                    this.webApp.HapticFeedback.notificationOccurred('error');
                    alert('Failed to save game progress. Please check your connection.');
                    throw error;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }

    async spin() {
        // Prevent multiple spins
        if (this.isSpinning || this.savingData) return;
        if (this.balance < this.bet) {
            alert('Not enough balance!');
            return;
        }

        // Disable spin button
        this.spinButton.disabled = true;
        this.spinButton.textContent = 'SPINNING...';

        this.isSpinning = true;
        this.savingData = false;
        
        try {
            // Deduct bet
            const previousBalance = this.balance;
            this.balance -= this.bet;
            this.updateBalanceDisplay();

            // Start spinning animation
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
            this.savingData = true;
            await this.checkWin(symbols);
        } catch (error) {
            window.log('Spin error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.isSpinning = false;
            this.savingData = false;
            
            // Enable spin button if we have enough balance
            this.spinButton.disabled = this.balance < this.bet;
            this.spinButton.textContent = 'SPIN!';

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
        window.log('Initializing UI...');

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
        this.spinButton.textContent = 'LOADING...';

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

        window.log('UI initialized');
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
            window.log('Updating balance display:', this.balance);
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
