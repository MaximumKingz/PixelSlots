class PixelSlots {
    constructor() {
        // Game configuration
        this.config = {
            reels: 3,
            rows: 3,
            minBet: 10,
            mediumBet: 100,
            maxBet: 1000,
            symbols: [
                { id: 'cherry', value: 2, probability: 0.2 },
                { id: 'lemon', value: 3, probability: 0.2 },
                { id: 'orange', value: 4, probability: 0.15 },
                { id: 'plum', value: 5, probability: 0.15 },
                { id: 'bell', value: 10, probability: 0.1 },
                { id: 'seven', value: 20, probability: 0.1 },
                { id: 'diamond', value: 50, probability: 0.07 },
                { id: 'bitcoin', value: 100, probability: 0.03 }
            ]
        };

        // Game state
        this.state = {
            currentBet: this.config.minBet,
            isSpinning: false,
            balance: 0,
            lastWin: 0,
            soundEnabled: true,
            settings: {
                volume: 50,
                animationSpeed: 'normal',
                highContrast: false
            }
        };

        // Socket connection
        this.socket = io();
        this.setupSocketListeners();

        // Initialize Telegram WebApp
        this.telegram = window.Telegram.WebApp;
        this.initializeTelegram();

        // DOM elements
        this.elements = {
            reels: Array.from({ length: this.config.reels }, (_, i) => 
                document.getElementById(`reel${i + 1}`)),
            spinButton: document.getElementById('spin-button'),
            betDisplay: document.getElementById('current-bet'),
            decreaseBet: document.getElementById('decrease-bet'),
            increaseBet: document.getElementById('increase-bet'),
            balanceDisplay: document.getElementById('token-balance'),
            winDisplay: document.getElementById('win-display'),
            winAmount: document.getElementById('win-amount'),
            menuButton: document.getElementById('menu-button'),
            menu: document.getElementById('menu'),
            closeMenu: document.getElementById('close-menu'),
            username: document.getElementById('username'),
            soundToggle: document.getElementById('sound-toggle'),
            jackpotAmount: document.getElementById('jackpot-amount'),
            settingsMenu: document.getElementById('settings-menu'),
            volumeSlider: document.getElementById('volume-slider'),
            animationSpeed: document.getElementById('animation-speed'),
            highContrast: document.getElementById('high-contrast'),
            closeSettings: document.getElementById('close-settings')
        };

        // Initialize event listeners
        this.initializeEventListeners();
        this.initializeSymbols();
        this.loadSettings();
    }

    loadSettings() {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('pixelSlots.settings');
        if (savedSettings) {
            this.state.settings = { ...this.state.settings, ...JSON.parse(savedSettings) };
        }

        // Apply settings
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('pixelSlots.settings', JSON.stringify(this.state.settings));
    }

    applySettings() {
        // Apply volume
        if (window.audioManager) {
            window.audioManager.setVolume(this.state.settings.volume / 100);
        }

        // Apply animation speed
        document.body.dataset.animationSpeed = this.state.settings.animationSpeed;

        // Apply high contrast mode
        document.body.classList.toggle('high-contrast', this.state.settings.highContrast);

        // Update UI
        this.elements.volumeSlider.value = this.state.settings.volume;
        this.elements.animationSpeed.value = this.state.settings.animationSpeed;
        this.elements.highContrast.checked = this.state.settings.highContrast;
    }

    initializeTelegram() {
        this.telegram.ready();
        if (this.telegram.initDataUnsafe?.user) {
            const { username, id } = this.telegram.initDataUnsafe.user;
            this.elements.username.textContent = username;
            this.socket.emit('user:init', { telegramId: id, username });
        }
    }

    setupSocketListeners() {
        this.socket.on('balance:update', (balance) => {
            this.updateBalance(balance);
        });

        this.socket.on('spin:result', (result) => {
            this.handleSpinResult(result);
        });

        this.socket.on('jackpot:update', (amount) => {
            this.updateJackpot(amount);
        });

        this.socket.on('achievements:unlocked', (achievements) => {
            this.showAchievements(achievements);
        });

        this.socket.on('error', (error) => {
            console.error('Server error:', error);
            this.showError(error);
        });
    }

    initializeEventListeners() {
        // Spin button
        this.elements.spinButton.addEventListener('click', () => this.spin());

        // Bet controls
        this.elements.decreaseBet.addEventListener('click', () => this.adjustBet('decrease'));
        this.elements.increaseBet.addEventListener('click', () => this.adjustBet('increase'));

        // Menu controls
        this.elements.menuButton.addEventListener('click', () => this.toggleMenu(true));
        this.elements.closeMenu.addEventListener('click', () => this.toggleMenu(false));

        // Sound toggle
        this.elements.soundToggle.addEventListener('click', () => this.toggleSound());

        // Settings controls
        document.getElementById('settings').addEventListener('click', () => this.showSettings());
        this.elements.closeSettings.addEventListener('click', () => this.hideSettings());
        
        // Settings inputs
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.state.settings.volume = parseInt(e.target.value);
            this.applySettings();
        });

        this.elements.volumeSlider.addEventListener('change', () => {
            this.saveSettings();
        });

        this.elements.animationSpeed.addEventListener('change', (e) => {
            this.state.settings.animationSpeed = e.target.value;
            this.applySettings();
            this.saveSettings();
        });

        this.elements.highContrast.addEventListener('change', (e) => {
            this.state.settings.highContrast = e.target.checked;
            this.applySettings();
            this.saveSettings();
        });

        // Menu buttons
        document.getElementById('deposit').addEventListener('click', () => this.handleDeposit());
        document.getElementById('withdraw').addEventListener('click', () => this.handleWithdraw());
        document.getElementById('achievements').addEventListener('click', () => this.showAchievements());
    }

    showError(message) {
        // Create error popup
        const errorPopup = document.createElement('div');
        errorPopup.className = 'error-popup';
        errorPopup.innerHTML = `
            <div class="error-content">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="pixel-button">OK</button>
            </div>
        `;

        // Add to body
        document.body.appendChild(errorPopup);

        // Remove on click
        errorPopup.querySelector('button').addEventListener('click', () => {
            errorPopup.remove();
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(errorPopup)) {
                errorPopup.remove();
            }
        }, 5000);
    }

    showSettings() {
        this.elements.settingsMenu.classList.remove('hidden');
        this.elements.menu.classList.add('hidden');
    }

    hideSettings() {
        this.elements.settingsMenu.classList.add('hidden');
    }

    initializeSymbols() {
        this.elements.reels.forEach(reel => {
            const grid = reel.querySelector('.symbol-grid');
            grid.innerHTML = '';
            
            // Add initial symbols
            for (let i = 0; i < this.config.rows; i++) {
                const symbol = this.generateRandomSymbol();
                const symbolElement = document.createElement('div');
                symbolElement.className = `symbol symbol-${symbol.id}`;
                grid.appendChild(symbolElement);
            }
        });
    }

    generateRandomSymbol() {
        const random = Math.random();
        let cumulativeProbability = 0;

        for (const symbol of this.config.symbols) {
            cumulativeProbability += symbol.probability;
            if (random <= cumulativeProbability) {
                return symbol;
            }
        }

        return this.config.symbols[0];
    }

    async spin() {
        if (this.state.isSpinning || this.state.balance < this.state.currentBet) {
            return;
        }

        this.state.isSpinning = true;
        this.elements.spinButton.disabled = true;

        // Play spin sound
        if (this.state.soundEnabled) {
            window.audioManager.playSpinSound();
        }

        // Emit spin request to server
        this.socket.emit('spin:request', {
            bet: this.state.currentBet
        });

        // Animate reels
        await this.animateReels();
    }

    async animateReels() {
        const spinDuration = 2000; // 2 seconds
        const spinClass = 'spinning';
        
        this.elements.reels.forEach((reel, index) => {
            reel.classList.add(spinClass);
            setTimeout(() => {
                reel.classList.remove(spinClass);
                reel.classList.add('stopping');
                setTimeout(() => {
                    reel.classList.remove('stopping');
                }, 300);
            }, spinDuration + (index * 200));
        });

        return new Promise(resolve => 
            setTimeout(resolve, spinDuration + (this.config.reels * 200))
        );
    }

    handleSpinResult(result) {
        this.state.isSpinning = false;
        this.elements.spinButton.disabled = false;

        // Stop spin sound
        if (this.state.soundEnabled) {
            window.audioManager.stopAll();
        }

        // Update symbols
        result.symbols.forEach((symbol, reelIndex) => {
            const reel = this.elements.reels[reelIndex];
            const grid = reel.querySelector('.symbol-grid');
            const symbolElement = grid.children[1]; // Middle position
            
            // Update symbol class
            symbolElement.className = `symbol symbol-${symbol}`;

            // Add winning animation if part of winning combination
            if (result.win > 0) {
                symbolElement.classList.add('winning');
            }
        });

        if (result.win > 0) {
            this.showWin(result.win);
            
            // Play win sound
            if (this.state.soundEnabled) {
                window.audioManager.playWinSound(result.win);
            }

            // Create particle effects
            const reelsRect = this.elements.reels[1].getBoundingClientRect();
            window.particleSystem.createCoinBurst(
                reelsRect.left + reelsRect.width / 2,
                reelsRect.top + reelsRect.height / 2
            );
        }

        this.updateBalance(result.newBalance);
        this.updateJackpot(result.jackpot);
    }

    showWin(amount) {
        this.elements.winAmount.textContent = `${amount} Tokens!`;
        this.elements.winDisplay.classList.remove('hidden');
        setTimeout(() => {
            this.elements.winDisplay.classList.add('hidden');
        }, 3000);
    }

    updateBalance(balance) {
        this.state.balance = balance;
        this.elements.balanceDisplay.textContent = `Tokens: ${balance}`;
        this.elements.balanceDisplay.classList.add('balance-update');
        setTimeout(() => {
            this.elements.balanceDisplay.classList.remove('balance-update');
        }, 500);
    }

    updateJackpot(amount) {
        this.elements.jackpotAmount.textContent = amount.toLocaleString();
    }

    adjustBet(action) {
        const bets = [this.config.minBet, this.config.mediumBet, this.config.maxBet];
        const currentIndex = bets.indexOf(this.state.currentBet);
        
        if (action === 'increase' && currentIndex < bets.length - 1) {
            this.state.currentBet = bets[currentIndex + 1];
        } else if (action === 'decrease' && currentIndex > 0) {
            this.state.currentBet = bets[currentIndex - 1];
        }
        
        this.elements.betDisplay.textContent = this.state.currentBet;

        // Play click sound
        if (this.state.soundEnabled) {
            window.audioManager.playClickSound();
        }
    }

    toggleMenu(show) {
        this.elements.menu.classList.toggle('hidden', !show);
        
        // Play click sound
        if (this.state.soundEnabled) {
            window.audioManager.playClickSound();
        }
    }

    toggleSound() {
        this.state.soundEnabled = !this.state.soundEnabled;
        this.elements.soundToggle.textContent = this.state.soundEnabled ? '🔊' : '🔇';
        
        if (this.state.soundEnabled) {
            window.audioManager.setVolume(0.5);
        } else {
            window.audioManager.setVolume(0);
        }
    }

    showAchievements(achievements) {
        if (!achievements || achievements.length === 0) return;

        const popup = document.getElementById('achievement-popup');
        const nameElement = document.getElementById('achievement-name');
        const rewardElement = document.getElementById('achievement-reward');

        achievements.forEach((achievement, index) => {
            setTimeout(() => {
                nameElement.textContent = achievement.name;
                rewardElement.textContent = `+${achievement.reward} Tokens`;
                popup.classList.remove('hidden');

                // Play achievement sound
                if (this.state.soundEnabled) {
                    window.audioManager.playAchievementSound();
                }

                setTimeout(() => {
                    popup.classList.add('hidden');
                }, 5000);
            }, index * 5500); // Show each achievement 5.5 seconds after the previous one
        });
    }

    // Crypto integration methods
    async handleDeposit() {
        this.socket.emit('crypto:generateAddress');
    }

    async handleWithdraw() {
        const amount = prompt('Enter amount to withdraw (minimum 1000 tokens):');
        if (amount && amount >= 1000) {
            this.socket.emit('crypto:withdraw', { amount });
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PixelSlots();
});
