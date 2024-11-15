class TransactionManager {
    constructor() {
        this.transactions = new Map();
        this.filters = {
            type: 'all',
            currency: 'all',
            status: 'all'
        };

        this.elements = {
            list: document.getElementById('transactions'),
            typeFilter: document.getElementById('tx-type-filter'),
            currencyFilter: document.getElementById('currency-filter'),
            statusFilter: document.getElementById('status-filter'),
            modal: document.getElementById('tx-modal'),
            modalContent: document.getElementById('tx-details'),
            retryButton: document.getElementById('retry-tx'),
            cancelButton: document.getElementById('cancel-tx')
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter changes
        this.elements.typeFilter.addEventListener('change', () => {
            this.filters.type = this.elements.typeFilter.value;
            this.renderTransactions();
        });

        this.elements.currencyFilter.addEventListener('change', () => {
            this.filters.currency = this.elements.currencyFilter.value;
            this.renderTransactions();
        });

        this.elements.statusFilter.addEventListener('change', () => {
            this.filters.status = this.elements.statusFilter.value;
            this.renderTransactions();
        });

        // Modal controls
        const closeButtons = document.querySelectorAll('.modal .close');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.hideModal();
            });
        });

        // Transaction actions
        this.elements.retryButton.addEventListener('click', () => {
            this.retryTransaction();
        });

        this.elements.cancelButton.addEventListener('click', () => {
            this.cancelTransaction();
        });

        // Close modal on outside click
        window.addEventListener('click', (event) => {
            if (event.target === this.elements.modal) {
                this.hideModal();
            }
        });
    }

    async refreshTransactions() {
        try {
            const response = await fetch('/api/admin/transactions');
            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }

            const data = await response.json();
            this.transactions.clear();
            data.forEach(tx => {
                this.transactions.set(tx.txId, tx);
            });

            this.renderTransactions();
        } catch (error) {
            console.error('Transaction refresh error:', error);
            window.dashboard.showToast('Failed to refresh transactions', 'error');
        }
    }

    addTransaction(transaction) {
        this.transactions.set(transaction.txId, transaction);
        this.renderTransactions();
    }

    updateTransaction(transaction) {
        if (this.transactions.has(transaction.txId)) {
            this.transactions.set(transaction.txId, {
                ...this.transactions.get(transaction.txId),
                ...transaction
            });
            this.renderTransactions();

            // Update modal if open
            if (this.currentTxId === transaction.txId) {
                this.showTransactionDetails(transaction.txId);
            }
        }
    }

    removeTransaction(txId) {
        this.transactions.delete(txId);
        this.renderTransactions();
    }

    renderTransactions() {
        const filteredTransactions = Array.from(this.transactions.values())
            .filter(tx => {
                return (this.filters.type === 'all' || tx.type === this.filters.type) &&
                       (this.filters.currency === 'all' || tx.currency === this.filters.currency) &&
                       (this.filters.status === 'all' || tx.status === this.filters.status);
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        this.elements.list.innerHTML = '';

        filteredTransactions.forEach(tx => {
            const element = document.createElement('div');
            element.className = 'transaction-item';
            element.innerHTML = `
                <div class="transaction-info">
                    <span class="type">${tx.type}</span>
                    <span class="amount">${tx.amount} ${tx.currency}</span>
                    <span class="network">${tx.network}</span>
                    <span class="status ${tx.status}">${tx.status}</span>
                </div>
                <div class="transaction-time">
                    ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `;

            element.addEventListener('click', () => {
                this.showTransactionDetails(tx.txId);
            });

            this.elements.list.appendChild(element);
        });
    }

    showTransactionDetails(txId) {
        const transaction = this.transactions.get(txId);
        if (!transaction) return;

        this.currentTxId = txId;
        this.elements.modalContent.innerHTML = `
            <div class="details-grid">
                <div class="detail">
                    <span class="label">Transaction ID</span>
                    <span class="value">${transaction.txId}</span>
                </div>
                <div class="detail">
                    <span class="label">Type</span>
                    <span class="value">${transaction.type}</span>
                </div>
                <div class="detail">
                    <span class="label">Amount</span>
                    <span class="value">${transaction.amount} ${transaction.currency}</span>
                </div>
                <div class="detail">
                    <span class="label">Network</span>
                    <span class="value">${transaction.network}</span>
                </div>
                <div class="detail">
                    <span class="label">Status</span>
                    <span class="value ${transaction.status}">${transaction.status}</span>
                </div>
                <div class="detail">
                    <span class="label">Created</span>
                    <span class="value">${new Date(transaction.timestamp).toLocaleString()}</span>
                </div>
                ${transaction.error ? `
                    <div class="detail error">
                        <span class="label">Error</span>
                        <span class="value">${transaction.error}</span>
                    </div>
                ` : ''}
            </div>
        `;

        // Show/hide action buttons based on status
        this.elements.retryButton.style.display = 
            transaction.status === 'failed' ? 'block' : 'none';
        this.elements.cancelButton.style.display = 
            transaction.status === 'pending' ? 'block' : 'none';

        this.elements.modal.classList.add('show');
    }

    hideModal() {
        this.elements.modal.classList.remove('show');
        this.currentTxId = null;
    }

    async retryTransaction() {
        if (!this.currentTxId) return;

        try {
            const response = await fetch(`/api/admin/transactions/${this.currentTxId}/retry`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to retry transaction');
            }

            window.dashboard.showToast('Transaction retry initiated', 'success');
            this.hideModal();
        } catch (error) {
            console.error('Transaction retry error:', error);
            window.dashboard.showToast('Failed to retry transaction', 'error');
        }
    }

    async cancelTransaction() {
        if (!this.currentTxId) return;

        try {
            const response = await fetch(`/api/admin/transactions/${this.currentTxId}/cancel`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to cancel transaction');
            }

            window.dashboard.showToast('Transaction cancelled', 'success');
            this.hideModal();
        } catch (error) {
            console.error('Transaction cancellation error:', error);
            window.dashboard.showToast('Failed to cancel transaction', 'error');
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}
