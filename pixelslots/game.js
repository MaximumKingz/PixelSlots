class PixelSlots {
    constructor() {
        // Wait for Telegram WebApp to be ready
        if (!window.Telegram || !window.Telegram.WebApp) {
            console.error('Telegram WebApp not found! Please open in Telegram.');
            alert('Please open this game in Telegram!');
            return;
        }

        // Initialize Telegram WebApp
        this.webApp = window.Telegram.WebApp;
        this.webApp.ready();
        this.webApp.expand();

        // Wait for initData to be available
        if (!this.webApp.initDataUnsafe || !this.webApp.initDataUnsafe.user) {
            console.error('No Telegram user data!');
            alert('Please open this game in Telegram!');
            return;
        }

        // Log Telegram data
        const user = this.webApp.initDataUnsafe.user;
        console.log('=== TELEGRAM USER DATA ===');
        console.log('ID:', user.id);
        console.log('Username:', user.username);
        console.log('First Name:', user.first_name);
        console.log('Last Name:', user.last_name);
        console.log('Language:', user.language_code);

        // Game setup
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
        
        // API URL
        this.apiUrl = 'https://maximumkingz.de/pixelslots/api.php';
        console.log('API URL:', this.apiUrl);

        // Initialize game
        this.initializeGame();
    }

    async loadUserData() {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe.user;
            if (!user || !user.id) {
                throw new Error('No Telegram user data!');
            }

            // Get user info
            const telegramId = user.id.toString();
            const username = user.username || '';
            
            console.log('=== LOADING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            console.log('Username:', username);
            
            // Make API request
            const url = `${this.apiUrl}?telegram_id=${telegramId}&username=${username}`;
            console.log('API Request URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('API Response:', responseText);

            // Parse response
            const userData = JSON.parse(responseText);
            console.log('User Data:', userData);

            if (!userData || typeof userData.balance !== 'number') {
                throw new Error('Invalid user data received');
            }

            // Update balance
            this.balance = userData.balance;
            this.updateBalanceDisplay();
            console.log('Balance updated:', this.balance);

            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            alert(error.message);
            return null;
        }
    }

    async saveUserData(winAmount = 0, isWin = false, isJackpot = false) {
        try {
            // Get Telegram user
            const user = this.webApp.initDataUnsafe.user;
            if (!user || !user.id) {
                throw new Error('No Telegram user data!');
            }

            // Get user info
            const telegramId = user.id.toString();
            
            console.log('=== SAVING USER DATA ===');
            console.log('Telegram ID:', telegramId);
            
            // Prepare data
            const data = {
                balance: this.balance,
                isWin,
                winAmount,
                isJackpot
            };
            console.log('Save Data:', data);

            // Make API request
            const url = `${this.apiUrl}?telegram_id=${telegramId}`;
            console.log('API Request URL:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('API Response:', responseText);

            // Parse response
            const userData = JSON.parse(responseText);
            console.log('Updated User Data:', userData);

            return userData;
        } catch (error) {
            console.error('Error saving user data:', error);
            alert(error.message);
            return null;
        }
    }

    async initializeGame() {
        try {
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

            // Load user data
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

            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Error initializing game:', error);
            alert('Error initializing game: ' + error.message);
        }
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
