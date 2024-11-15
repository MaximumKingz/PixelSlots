class CryptoUI {
    constructor() {
        this.elements = {
            depositButton: document.getElementById('deposit-button'),
            withdrawButton: document.getElementById('withdraw-button'),
            cryptoModal: document.getElementById('crypto-modal'),
            closeModal: document.getElementById('close-crypto-modal'),
            modalContent: document.getElementById('crypto-modal-content'),
            networkSelector: document.getElementById('network-selector'),
            qrCodeContainer: document.getElementById('qr-code-container'),
            addressDisplay: document.getElementById('address-display'),
            copyAddress: document.getElementById('copy-address'),
            withdrawalForm: document.getElementById('withdrawal-form'),
            withdrawalAmount: document.getElementById('withdrawal-amount'),
            withdrawalAddress: document.getElementById('withdrawal-address'),
            submitWithdrawal: document.getElementById('submit-withdrawal'),
            transactionsList: document.getElementById('transactions-list'),
            networkFees: document.getElementById('network-fees'),
            minimumWithdrawal: document.getElementById('minimum-withdrawal'),
            pendingTransactions: document.getElementById('pending-transactions')
        };

        this.state = {
            currentMode: 'deposit', // or 'withdraw'
            selectedNetwork: 'bitcoin',
            currentAddress: '',
            pendingTransactions: new Map(),
            depositTimeout: null
        };

        this.setupEventListeners();
        this.initializeQRCode();
    }

    setupEventListeners() {
        // Modal controls
        this.elements.depositButton.addEventListener('click', () => {
            this.showModal('deposit');
        });

        this.elements.withdrawButton.addEventListener('click', () => {
            this.showModal('withdraw');
        });

        this.elements.closeModal.addEventListener('click', () => {
            this.hideModal();
        });

        // Network selection
        this.elements.networkSelector.addEventListener('change', (e) => {
            this.state.selectedNetwork = e.target.value;
            if (this.state.currentMode === 'deposit') {
                this.generateNewAddress();
            } else {
                this.updateNetworkFees();
            }
        });

        // Copy address button
        this.elements.copyAddress.addEventListener('click', () => {
            this.copyAddressToClipboard();
        });

        // Withdrawal form
        this.elements.withdrawalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleWithdrawal();
        });

        // Amount input validation
        this.elements.withdrawalAmount.addEventListener('input', (e) => {
            this.validateWithdrawalAmount(e.target.value);
        });

        // Address input validation
        this.elements.withdrawalAddress.addEventListener('input', (e) => {
            this.validateAddress(e.target.value);
        });

        // Window focus event for updating status
        window.addEventListener('focus', () => {
            if (this.state.currentMode === 'deposit' && this.elements.cryptoModal.classList.contains('show')) {
                this.checkPendingTransactions();
            }
        });
    }

    initializeQRCode() {
        this.qrCode = new QRCode(this.elements.qrCodeContainer, {
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    showModal(mode) {
        this.state.currentMode = mode;
        this.elements.cryptoModal.classList.add('show');
        this.elements.modalContent.innerHTML = this.generateModalContent(mode);
        
        if (mode === 'deposit') {
            this.generateNewAddress();
        } else {
            this.updateNetworkFees();
        }
        
        this.updatePendingTransactions();
    }

    hideModal() {
        this.elements.cryptoModal.classList.remove('show');
        if (this.state.depositTimeout) {
            clearTimeout(this.state.depositTimeout);
            this.state.depositTimeout = null;
        }
    }

    generateModalContent(mode) {
        if (mode === 'deposit') {
            return `
                <div class="crypto-section">
                    <h2>Deposit Crypto</h2>
                    <div class="network-selection">
                        <label for="network-selector">Select Network:</label>
                        <select id="network-selector">
                            <option value="bitcoin">Bitcoin</option>
                            <option value="lightning">Lightning Network</option>
                        </select>
                    </div>
                    <div class="address-section">
                        <div id="qr-code-container"></div>
                        <div class="address-display">
                            <input type="text" id="address-display" readonly>
                            <button id="copy-address" class="pixel-button">Copy</button>
                        </div>
                        <p class="minimum-deposit">
                            Minimum deposit: <span id="minimum-deposit-amount">0.0001 BTC</span>
                        </p>
                        <div class="expiry-timer">
                            Time remaining: <span id="deposit-timer">15:00</span>
                        </div>
                    </div>
                </div>
                <div class="pending-section">
                    <h3>Pending Deposits</h3>
                    <div id="pending-transactions" class="transactions-list"></div>
                </div>
            `;
        } else {
            return `
                <div class="crypto-section">
                    <h2>Withdraw Crypto</h2>
                    <form id="withdrawal-form">
                        <div class="network-selection">
                            <label for="network-selector">Select Network:</label>
                            <select id="network-selector">
                                <option value="bitcoin">Bitcoin</option>
                                <option value="lightning">Lightning Network</option>
                            </select>
                        </div>
                        <div class="amount-input">
                            <label for="withdrawal-amount">Amount (BTC):</label>
                            <input type="number" id="withdrawal-amount" step="0.00000001" required>
                            <p class="minimum-withdrawal">
                                Minimum: <span id="minimum-withdrawal">0.0005 BTC</span>
                            </p>
                        </div>
                        <div class="address-input">
                            <label for="withdrawal-address">Address:</label>
                            <input type="text" id="withdrawal-address" required>
                        </div>
                        <div class="fee-display">
                            <p>Network Fee: <span id="network-fees">Loading...</span></p>
                            <p>You will receive: <span id="final-amount">0 BTC</span></p>
                        </div>
                        <button type="submit" id="submit-withdrawal" class="pixel-button">Withdraw</button>
                    </form>
                </div>
                <div class="pending-section">
                    <h3>Pending Withdrawals</h3>
                    <div id="pending-transactions" class="transactions-list"></div>
                </div>
            `;
        }
    }

    async generateNewAddress() {
        try {
            const response = await fetch('/api/crypto/deposit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    network: this.state.selectedNetwork
                })
            });

            const data = await response.json();
            if (data.success) {
                this.state.currentAddress = data.address;
                this.elements.addressDisplay.value = data.address;
                this.qrCode.makeCode(data.address);
                
                // Set expiry timer
                const expiryTime = new Date(Date.now() + data.expiresIn);
                this.startExpiryTimer(expiryTime);
                
                // Update minimum deposit
                this.elements.minimumDeposit.textContent = `${data.minimumDeposit} BTC`;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Failed to generate deposit address: ' + error.message);
        }
    }

    startExpiryTimer(expiryTime) {
        const updateTimer = () => {
            const now = new Date();
            const timeLeft = expiryTime - now;
            
            if (timeLeft <= 0) {
                clearInterval(this.state.depositTimeout);
                this.generateNewAddress();
                return;
            }
            
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            this.elements.depositTimer.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };
        
        if (this.state.depositTimeout) {
            clearInterval(this.state.depositTimeout);
        }
        
        updateTimer();
        this.state.depositTimeout = setInterval(updateTimer, 1000);
    }

    async updateNetworkFees() {
        try {
            const response = await fetch(`/api/crypto/fees/${this.state.selectedNetwork}`);
            const data = await response.json();
            
            if (data.success) {
                this.elements.networkFees.textContent = `${data.fee} BTC`;
                this.updateFinalAmount();
            }
        } catch (error) {
            this.showError('Failed to fetch network fees: ' + error.message);
        }
    }

    updateFinalAmount() {
        const amount = parseFloat(this.elements.withdrawalAmount.value) || 0;
        const fees = parseFloat(this.elements.networkFees.textContent) || 0;
        const final = Math.max(0, amount - fees);
        this.elements.finalAmount.textContent = `${final.toFixed(8)} BTC`;
    }

    async handleWithdrawal() {
        try {
            const amount = this.elements.withdrawalAmount.value;
            const address = this.elements.withdrawalAddress.value;
            
            if (!this.validateWithdrawalAmount(amount) || !this.validateAddress(address)) {
                return;
            }
            
            const response = await fetch('/api/crypto/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount,
                    address,
                    network: this.state.selectedNetwork
                })
            });

            const data = await response.json();
            if (data.success) {
                this.showSuccess('Withdrawal initiated successfully!');
                this.updatePendingTransactions();
                this.elements.withdrawalForm.reset();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Withdrawal failed: ' + error.message);
        }
    }

    validateWithdrawalAmount(amount) {
        const minWithdrawal = parseFloat(this.elements.minimumWithdrawal.textContent);
        if (isNaN(amount) || amount < minWithdrawal) {
            this.elements.withdrawalAmount.classList.add('error');
            return false;
        }
        this.elements.withdrawalAmount.classList.remove('error');
        return true;
    }

    validateAddress(address) {
        let isValid = false;
        if (this.state.selectedNetwork === 'bitcoin') {
            isValid = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{11,71}$/.test(address);
        } else {
            isValid = /^ln[a-z0-9]{1,1000}$/.test(address);
        }
        
        this.elements.withdrawalAddress.classList.toggle('error', !isValid);
        return isValid;
    }

    async copyAddressToClipboard() {
        try {
            await navigator.clipboard.writeText(this.state.currentAddress);
            this.showSuccess('Address copied to clipboard!');
        } catch (error) {
            this.showError('Failed to copy address: ' + error.message);
        }
    }

    async checkPendingTransactions() {
        try {
            const response = await fetch('/api/crypto/pending');
            const data = await response.json();
            
            if (data.success) {
                this.updateTransactionsList(data.transactions);
            }
        } catch (error) {
            console.error('Failed to fetch pending transactions:', error);
        }
    }

    updateTransactionsList(transactions) {
        const container = this.elements.pendingTransactions;
        container.innerHTML = '';
        
        if (transactions.length === 0) {
            container.innerHTML = '<p class="no-transactions">No pending transactions</p>';
            return;
        }
        
        transactions.forEach(tx => {
            const element = document.createElement('div');
            element.className = `transaction-item ${tx.type}`;
            element.innerHTML = `
                <div class="transaction-info">
                    <span class="amount">${tx.amount} BTC</span>
                    <span class="network">${tx.network}</span>
                    <span class="status">${tx.status}</span>
                </div>
                <div class="transaction-time">
                    ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `;
            container.appendChild(element);
        });
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize CryptoUI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.cryptoUI = new CryptoUI();
});
