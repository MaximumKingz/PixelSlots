class PixelSlots {
    constructor() {
        this.symbols = ['🍒', '🍋', '🍊', '💎', '7️⃣', '🎰'];
        this.symbolValues = {
            '🍒': 2,
            '🍋': 3,
            '🍊': 4,
            '💎': 10,
            '7️⃣': 20,
            '🎰': 50
        };
        this.balance = 1.0;
        this.bet = 0.001;
        this.jackpot = 10.0;
        this.isSpinning = false;
        this.autoPlayActive = false;
        this.webApp = window.Telegram.WebApp;
        
        this.initializeGame();
        this.setupTelegram();
    }

    setupTelegram() {
        this.webApp.expand();
        this.webApp.ready();

        // Set theme colors
        document.documentElement.style.setProperty('--tg-theme-bg-color', this.webApp.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', this.webApp.textColor);
        document.documentElement.style.setProperty('--tg-theme-button-color', this.webApp.buttonColor);
        document.documentElement.style.setProperty('--tg-theme-button-text-color', this.webApp.buttonTextColor);

        // Handle back button
        this.webApp.BackButton.onClick(() => {
            if (document.querySelector('.win-overlay:not(.hidden)')) {
                this.hideWinDisplay();
            }
        });
    }

    initializeGame() {
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

        // Set initial values
        this.updateBalance(this.balance);
        this.updateJackpot(this.jackpot);
        this.updateBetDisplay();

        // Add event listeners
        this.spinButton.addEventListener('click', () => this.spin());
        this.autoPlayButton.addEventListener('click', () => this.toggleAutoPlay());
        this.maxBetButton.addEventListener('click', () => this.setMaxBet());
        this.decreaseBetButton.addEventListener('click', () => this.adjustBet(-0.001));
        this.increaseBetButton.addEventListener('click', () => this.adjustBet(0.001));
        this.collectWinButton.addEventListener('click', () => this.hideWinDisplay());

        // Set initial symbols
        this.reels.forEach(reel => {
            reel.querySelector('.symbol').textContent = this.getRandomSymbol();
        });
    }

    getRandomSymbol() {
        return this.symbols[Math.floor(Math.random() * this.symbols.length)];
    }

    async spin() {
        if (this.isSpinning || this.balance < this.bet) {
            this.webApp.HapticFeedback.notificationOccurred('error');
            return;
        }

        this.webApp.HapticFeedback.notificationOccurred('success');
        this.isSpinning = true;
        this.spinButton.disabled = true;
        this.updateBalance(this.balance - this.bet);

        // Contribute to jackpot
        this.jackpot += this.bet * 0.1;
        this.updateJackpot(this.jackpot);

        // Generate final symbols
        const finalSymbols = this.reels.map(() => this.getRandomSymbol());

        // Start spinning animation
        this.reels.forEach(reel => {
            reel.classList.add('spinning');
        });

        // Play spin sound
        window.audioManager?.playSpinSound();

        // Stop reels one by one with different delays
        for (let i = 0; i < this.reels.length; i++) {
            await this.delay(i === 0 ? 1000 : 500); // First reel spins longer

            const reel = this.reels[i];
            reel.classList.remove('spinning');
            
            // Update visible symbol
            const symbol = reel.querySelector('.symbol');
            symbol.textContent = finalSymbols[i];

            // Play stop sound and haptic
            window.audioManager?.playStopSound();
            this.webApp.HapticFeedback.impactOccurred('rigid');
        }

        // Check for wins after a short delay
        await this.delay(300);
        this.checkWin(finalSymbols);

        this.isSpinning = false;
        this.spinButton.disabled = false;

        // Continue auto play if active
        if (this.autoPlayActive && this.balance >= this.bet) {
            setTimeout(() => this.spin(), 1000);
        }
    }

    checkWin(symbols) {
        // Remove previous win highlights
        this.reels.forEach(reel => {
            reel.classList.remove('win');
            reel.querySelector('.symbol').style.transform = 'scale(1)';
        });

        // Check for jackpot
        if (symbols.every(symbol => symbol === '🎰')) {
            this.highlightWinningSymbols(symbols);
            this.handleJackpotWin();
            return;
        }

        // Check for regular win
        if (symbols.every(symbol => symbol === symbols[0])) {
            this.highlightWinningSymbols(symbols);
            const multiplier = this.symbolValues[symbols[0]];
            const winAmount = this.bet * multiplier;
            this.handleWin(winAmount);
            return;
        }

        // Check for partial wins
        const matches = symbols.filter(symbol => symbol === symbols[0]).length;
        if (matches === 2) {
            this.highlightWinningSymbols(symbols);
            const multiplier = this.symbolValues[symbols[0]] / 2;
            const winAmount = this.bet * multiplier;
            this.handleWin(winAmount);
            return;
        }

        // Play lose sound
        window.audioManager?.playLoseSound();
    }

    highlightWinningSymbols(symbols) {
        symbols.forEach((symbol, index) => {
            if (symbol === symbols[0]) {
                const reel = this.reels[index];
                reel.classList.add('win');
                const symbolEl = reel.querySelector('.symbol');
                symbolEl.style.transform = 'scale(1.2)';
                symbolEl.style.transition = 'transform 0.3s ease';
            }
        });
    }

    handleJackpotWin() {
        const winAmount = this.jackpot;
        this.updateBalance(this.balance + winAmount);
        this.jackpot = 10.0;
        this.updateJackpot(this.jackpot);
        this.showWinDisplay(winAmount, true);
        window.audioManager?.playJackpotSound();
        this.webApp.HapticFeedback.notificationOccurred('success');
    }

    handleWin(amount) {
        this.updateBalance(this.balance + amount);
        this.showWinDisplay(amount, false);
        window.audioManager?.playWinSound(amount);
        this.webApp.HapticFeedback.notificationOccurred('success');
    }

    showWinDisplay(amount, isJackpot) {
        // Ensure clean state
        this.hideWinDisplay();
        
        // Set content
        this.winAmount.textContent = `${amount.toFixed(8)} BTC`;
        if (isJackpot) {
            this.winOverlay.querySelector('h2').textContent = '🎉 JACKPOT! 🎉';
        } else {
            this.winOverlay.querySelector('h2').textContent = '🎉 BIG WIN! 🎉';
        }

        // Show overlay with animation
        requestAnimationFrame(() => {
            this.winOverlay.classList.remove('hidden');
            this.webApp.BackButton.show();
            this.webApp.expand();
            
            // Haptic feedback
            this.webApp.HapticFeedback.notificationOccurred('success');
            
            // Auto-hide after 5 seconds if autoplay is active
            if (this.autoPlayActive) {
                setTimeout(() => this.hideWinDisplay(), 5000);
            }
        });
    }

    hideWinDisplay() {
        if (!this.winOverlay.classList.contains('hidden')) {
            this.winOverlay.classList.add('hidden');
            this.webApp.BackButton.hide();
            
            // Wait for animation to complete
            setTimeout(() => {
                if (this.winOverlay.classList.contains('hidden')) {
                    this.winOverlay.querySelector('h2').textContent = '🎉 BIG WIN! 🎉';
                    this.winAmount.textContent = '0.000 BTC';
                }
            }, 300);
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
        const maxPossibleBet = Math.floor(this.balance * 1000) / 1000;
        if (maxPossibleBet !== this.bet) {
            this.bet = maxPossibleBet;
            this.updateBetDisplay();
            this.webApp.HapticFeedback.notificationOccurred('success');
        }
    }

    adjustBet(amount) {
        const newBet = Math.max(0.001, Math.min(this.bet + amount, this.balance));
        if (newBet !== this.bet) {
            this.bet = newBet;
            this.updateBetDisplay();
            this.webApp.HapticFeedback.notificationOccurred('success');
        }
    }

    updateBetDisplay() {
        this.currentBetDisplay.textContent = `${this.bet.toFixed(3)} BTC`;
    }

    updateBalance(amount) {
        this.balance = amount;
        this.balanceDisplay.textContent = `${this.balance.toFixed(3)} BTC`;
    }

    updateJackpot(amount) {
        this.jackpot = amount;
        this.jackpotDisplay.textContent = `${this.jackpot.toFixed(3)} BTC`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PixelSlots();
});
