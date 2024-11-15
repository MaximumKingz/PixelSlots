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
        this.reels = Array(3).fill(null);
        this.spinDuration = 2000;
        this.webApp = window.Telegram.WebApp;

        this.initializeGame();
    }

    initializeGame() {
        // Initialize UI elements
        this.reelElements = Array.from(document.querySelectorAll('.reel'));
        this.spinButton = document.getElementById('spin-button');
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
        this.decreaseBetButton.addEventListener('click', () => this.adjustBet(-0.001));
        this.increaseBetButton.addEventListener('click', () => this.adjustBet(0.001));
        this.collectWinButton.addEventListener('click', () => this.hideWinDisplay());

        // Initialize Telegram WebApp
        this.webApp.ready();
        this.webApp.expand();

        // Set initial symbols
        this.reelElements.forEach((reel, index) => {
            this.reels[index] = this.getRandomSymbol();
            reel.textContent = this.reels[index];
        });
    }

    getRandomSymbol() {
        return this.symbols[Math.floor(Math.random() * this.symbols.length)];
    }

    async spin() {
        if (this.isSpinning || this.balance < this.bet) return;

        this.isSpinning = true;
        this.spinButton.disabled = true;
        this.updateBalance(this.balance - this.bet);

        // Contribute to jackpot
        this.jackpot += this.bet * 0.1;
        this.updateJackpot(this.jackpot);

        // Start spinning animation
        this.reelElements.forEach(reel => reel.classList.add('spinning'));

        // Generate new symbols
        const newSymbols = this.reels.map(() => this.getRandomSymbol());

        // Stop reels one by one
        for (let i = 0; i < this.reelElements.length; i++) {
            await this.delay(this.spinDuration / 3);
            this.reelElements[i].classList.remove('spinning');
            this.reels[i] = newSymbols[i];
            this.reelElements[i].textContent = this.reels[i];
            this.playStopSound();
        }

        // Check for wins
        this.checkWin(newSymbols);

        this.isSpinning = false;
        this.spinButton.disabled = false;
    }

    checkWin(symbols) {
        // Check for jackpot (all symbols match and are 🎰)
        if (symbols.every(symbol => symbol === '🎰')) {
            this.handleJackpotWin();
            return;
        }

        // Check for regular win (all symbols match)
        if (symbols.every(symbol => symbol === symbols[0])) {
            const multiplier = this.symbolValues[symbols[0]];
            const winAmount = this.bet * multiplier;
            this.handleWin(winAmount);
            return;
        }

        // Check for partial wins (two matching symbols)
        const matches = symbols.filter(symbol => symbol === symbols[0]).length;
        if (matches === 2) {
            const multiplier = this.symbolValues[symbols[0]] / 2;
            const winAmount = this.bet * multiplier;
            this.handleWin(winAmount);
            return;
        }

        this.playLoseSound();
    }

    handleJackpotWin() {
        const winAmount = this.jackpot;
        this.updateBalance(this.balance + winAmount);
        this.jackpot = 10.0; // Reset jackpot
        this.updateJackpot(this.jackpot);
        this.showWinDisplay(winAmount, true);
        this.playJackpotSound();
        this.createParticleEffect();
    }

    handleWin(amount) {
        this.updateBalance(this.balance + amount);
        this.showWinDisplay(amount, false);
        this.playWinSound();
        this.createParticleEffect();
    }

    showWinDisplay(amount, isJackpot) {
        this.winAmount.textContent = `${amount.toFixed(8)} BTC`;
        this.winOverlay.classList.remove('hidden');
        if (isJackpot) {
            this.winOverlay.querySelector('h2').textContent = '🎉 JACKPOT! 🎉';
        }
    }

    hideWinDisplay() {
        this.winOverlay.classList.add('hidden');
    }

    adjustBet(amount) {
        const newBet = Math.max(0.001, Math.min(this.bet + amount, this.balance));
        if (newBet !== this.bet) {
            this.bet = newBet;
            this.updateBetDisplay();
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

    createParticleEffect() {
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.textContent = ['💰', '⭐', '✨'][Math.floor(Math.random() * 3)];
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 100 + Math.random() * 100;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity;
            const rotate = Math.random() * 360;

            particle.style.setProperty('--dx', `${dx}px`);
            particle.style.setProperty('--dy', `${dy}px`);
            particle.style.setProperty('--rotate', `${rotate}deg`);

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    }

    playSpinSound() {
        // Implement sound effects
    }

    playStopSound() {
        // Implement sound effects
    }

    playWinSound() {
        // Implement sound effects
    }

    playJackpotSound() {
        // Implement sound effects
    }

    playLoseSound() {
        // Implement sound effects
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PixelSlots();
});
