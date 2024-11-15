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
        
        this.balance = 10.00;
        this.bet = 0.10;
        this.jackpot = 1000.00;
        this.isSpinning = false;
        this.autoPlayActive = false;
        this.webApp = window.Telegram.WebApp;
        
        // Use production server URL when deployed
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api'
            : 'https://pixel-slots.herokuapp.com/api';

        this.initializeGame();
        this.setupTelegram();
    }

    async loadUserData() {
        try {
            const username = this.webApp.initDataUnsafe.user.username;
            const response = await fetch(
                `${this.apiBaseUrl}/user/${this.webApp.initDataUnsafe.user.id}?username=${username}`
            );
            const userData = await response.json();
            this.updateBalance(userData.balance);
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            return null;
        }
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        try {
            await fetch(`${this.apiBaseUrl}/user/${this.webApp.initDataUnsafe.user.id}/update`, {
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
            });
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    formatMoney(amount) {
        return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
        this.winAmounts = document.querySelectorAll('.win-amount:not(.jackpot)');

        // Load user data
        await this.loadUserData();

        // Set initial values
        this.updateJackpot(1000.00);
        this.updateBetDisplay();
        this.updateWinTable();

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
        
        // Otherwise, return a random regular symbol
        return this.regularSymbols[Math.floor(Math.random() * this.regularSymbols.length)];
    }

    async spin() {
        if (this.isSpinning || this.balance < this.bet) {
            this.webApp.HapticFeedback.notificationOccurred('error');
            return;
        }

        this.isSpinning = true;
        this.spinButton.disabled = true;
        this.updateBalance(this.balance - this.bet);

        try {
            // Start spinning animation
            this.reels.forEach(reel => reel.classList.add('spinning'));
            window.audioManager?.playSpinSound();

            // Generate final symbols with jackpot probability
            const finalSymbols = Array(3).fill(null).map(() => this.getRandomSymbol());

            // Stop reels one by one
            for (let i = 0; i < this.reels.length; i++) {
                await this.delay(i === 0 ? 800 : 300);
                
                const reel = this.reels[i];
                reel.classList.remove('spinning');
                const symbol = reel.querySelector('.symbol');
                if (symbol) {
                    symbol.textContent = finalSymbols[i];
                }

                window.audioManager?.playStopSound();
                this.webApp.HapticFeedback.impactOccurred('rigid');
            }

            // Check for wins
            await this.delay(200);
            await this.checkWin(finalSymbols);
        } catch (error) {
            console.error('Spin error:', error);
        } finally {
            this.isSpinning = false;
            this.spinButton.disabled = false;

            // Continue auto play if active
            if (this.autoPlayActive && this.balance >= this.bet) {
                setTimeout(() => this.spin(), 1000);
            }
        }
    }

    async checkWin(symbols) {
        // Check if all symbols are the same
        const isWin = symbols.every(s => s === symbols[0]);
        
        if (isWin) {
            const symbol = symbols[0];
            const multiplier = this.symbolValues[symbol];
            const winAmount = this.bet * multiplier;
            const isJackpot = symbol === this.jackpotSymbol;

            // Update balance and save with win data
            await this.updateBalance(this.balance + winAmount, winAmount, true, isJackpot);

            // Show win notification
            this.showWinDisplay(winAmount, isJackpot);
            window.audioManager?.playWinSound(winAmount);
            this.webApp.HapticFeedback.notificationOccurred('success');
        } else {
            // Save spin data without win
            await this.saveUserData(this.bet, false, false);
        }
    }

    async updateBalance(amount, winAmount = 0, isWin = false, isJackpot = false) {
        this.balance = amount;
        this.balanceDisplay.textContent = this.formatMoney(this.balance);
        await this.saveUserData(winAmount, isWin, isJackpot);
    }

    showWinDisplay(amount, isJackpot) {
        // Hide any existing overlay first
        this.hideWinDisplay();
        
        // Set content
        this.winAmount.textContent = this.formatMoney(amount);
        this.winOverlay.querySelector('h2').textContent = isJackpot ? '🎉 JACKPOT! 🎉' : '🎉 BIG WIN! 🎉';
        
        // Show overlay
        this.winOverlay.classList.remove('hidden');
        this.webApp.BackButton.show();
        this.webApp.HapticFeedback.notificationOccurred('success');

        // Auto-hide after 5 seconds if autoplay is active
        if (this.autoPlayActive) {
            setTimeout(() => this.hideWinDisplay(), 5000);
        }
    }

    hideWinDisplay() {
        if (!this.winOverlay.classList.contains('hidden')) {
            this.winOverlay.classList.add('hidden');
            this.webApp.BackButton.hide();
        }
    }

    toggleAutoPlay() {
        this.autoPlayActive = !this.autoPlayActive;
        this.autoPlayButton.classList.toggle('active');
        if (this.autoPlayActive && !this.isSpinning && this.balance >= this.bet) {
            this.spin();
        }
    }

    setMaxBet() {
        const maxPossibleBet = Math.floor(this.balance * 100) / 100;
        if (maxPossibleBet !== this.bet) {
            this.bet = maxPossibleBet;
            this.updateBetDisplay();
            this.updateWinTable();
            this.webApp.HapticFeedback.notificationOccurred('success');
        }
    }

    adjustBet(amount) {
        const newBet = Math.max(0.10, Math.min(this.bet + amount, this.balance));
        if (newBet !== this.bet) {
            this.bet = newBet;
            this.updateBetDisplay();
            this.updateWinTable();
            this.webApp.HapticFeedback.notificationOccurred('success');
        }
    }

    updateBetDisplay() {
        this.currentBetDisplay.textContent = this.formatMoney(this.bet);
    }

    updateWinTable() {
        const winAmounts = document.querySelectorAll('.win-amount:not(.jackpot)');
        const multipliers = [20, 10, 4, 3, 2];
        
        winAmounts.forEach((element, index) => {
            if (index < multipliers.length) {
                const winAmount = this.bet * multipliers[index];
                element.textContent = this.formatMoney(winAmount);
            }
        });
    }

    updateJackpot(amount) {
        this.jackpot = amount;
        this.jackpotDisplay.textContent = this.formatMoney(this.jackpot);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setupTelegram() {
        this.webApp.expand();
        this.webApp.ready();

        // Set theme colors
        document.documentElement.style.setProperty('--tg-theme-bg-color', this.webApp.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', this.webApp.textColor);
        document.documentElement.style.setProperty('--tg-theme-button-color', this.webApp.buttonColor);
        document.documentElement.style.setProperty('--tg-theme-button-text-color', this.webApp.buttonTextColor);
        document.documentElement.style.setProperty('--tg-viewport-height', `${this.webApp.viewportHeight}px`);

        // Handle back button
        this.webApp.BackButton.onClick(() => {
            if (document.querySelector('.win-overlay:not(.hidden)')) {
                this.hideWinDisplay();
            }
        });

        // Handle viewport height changes
        this.webApp.onEvent('viewportChanged', () => {
            document.documentElement.style.setProperty('--tg-viewport-height', `${this.webApp.viewportHeight}px`);
        });
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PixelSlots();
});
