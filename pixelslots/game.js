class PixelSlots {
    constructor() {
        // Regular symbols (more common)
        this.regularSymbols = ['🍒', '🍋', '🍊', '💎', '7️⃣'];
        // Jackpot symbol (very rare)
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
        this.webApp = window.Telegram.WebApp;
        
        console.log('Initializing game...');
        console.log('Telegram WebApp:', this.webApp);
        console.log('Telegram User:', this.webApp.initDataUnsafe?.user);

        this.setupTelegram();
        this.initializeGame();
    }

    async loadUserData() {
        try {
            if (!this.webApp.initDataUnsafe?.user?.id) {
                console.error('No Telegram user ID found');
                alert('Please open this game in Telegram!');
                return null;
            }

            const username = this.webApp.initDataUnsafe.user.username || '';
            const telegramId = this.webApp.initDataUnsafe.user.id;
            
            console.log('Loading data for user:', {
                telegramId,
                username
            });
            
            const response = await fetch(
                `api.php?telegram_id=${telegramId}&username=${username}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const userData = await response.json();
            console.log('API Response:', userData);
            
            if (userData.error) {
                console.error('API Error:', userData.error);
                alert('Error loading user data: ' + userData.error);
                return null;
            }
            
            if (userData && typeof userData.balance === 'number') {
                await this.updateBalance(userData.balance);
                console.log('Updated balance to:', userData.balance);
            } else {
                console.error('Invalid user data received:', userData);
                alert('Invalid user data received');
                return null;
            }

            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            alert('Error: ' + error.message);
            return null;
        }
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        try {
            if (!this.webApp.initDataUnsafe?.user?.id) {
                console.error('No Telegram user ID found');
                return;
            }

            const telegramId = this.webApp.initDataUnsafe.user.id;
            console.log('Saving data for user:', {
                telegramId,
                balance: this.balance,
                isWin,
                winAmount,
                isJackpot
            });

            const response = await fetch(
                `api.php?telegram_id=${telegramId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        balance: this.balance,
                        isWin,
                        winAmount,
                        isJackpot
                    })
                }
            );

            const userData = await response.json();
            console.log('API Save Response:', userData);
            
            if (userData.error) {
                console.error('API Save Error:', userData.error);
                alert('Error saving data: ' + userData.error);
                return null;
            }

            return userData;
        } catch (error) {
            console.error('Error saving user data:', error);
            alert('Error: ' + error.message);
            await this.loadUserData();
        }
    }

    setupTelegram() {
        this.webApp.ready();
        this.webApp.expand();

        // Set theme
        document.documentElement.style.setProperty(
            '--tg-theme-bg-color',
            this.webApp.themeParams.bg_color || '#1c1c1c'
        );
        document.documentElement.style.setProperty(
            '--tg-theme-text-color',
            this.webApp.themeParams.text_color || '#ffffff'
        );
        document.documentElement.style.setProperty(
            '--tg-theme-button-color',
            this.webApp.themeParams.button_color || '#3390ec'
        );
        document.documentElement.style.setProperty(
            '--tg-theme-button-text-color',
            this.webApp.themeParams.button_text_color || '#ffffff'
        );

        // Handle viewport height changes
        this.webApp.onEvent('viewportChanged', () => {
            document.documentElement.style.setProperty(
                '--tg-viewport-height',
                `${this.webApp.viewportHeight}px`
            );
        });

        // Log Telegram user info
        console.log('Telegram User:', this.webApp.initDataUnsafe?.user);
    }

    async initializeGame() {
        // Initialize UI elements
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

        // Load user data first
        await this.loadUserData();

        // Set initial values
        this.updateBetDisplay();
        this.updateWinTable();
        this.updateJackpot(1000.00);

        // Add event listeners
        this.spinButton.addEventListener('click', () => this.spin());
        this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());
        this.maxBetButton.addEventListener('click', () => this.setMaxBet());
        this.decreaseBetButton.addEventListener('click', () => this.adjustBet(-0.10));
        this.increaseBetButton.addEventListener('click', () => this.adjustBet(0.10));
        this.collectWinButton.addEventListener('click', () => this.hideWinDisplay());

        // Set initial symbols
        this.reels.forEach(reel => {
            reel.querySelector('.symbol').textContent = this.getRandomSymbol();
        });
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
        if (this.isSpinning || this.balance < this.bet) {
            this.webApp.HapticFeedback.notificationOccurred('error');
            alert('Insufficient balance or already spinning!');
            return;
        }

        this.isSpinning = true;
        this.spinButton.disabled = true;
        await this.updateBalance(this.balance - this.bet);

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
            this.spinButton.disabled = false;

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
