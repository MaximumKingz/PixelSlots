class DashboardManager {
    constructor() {
        this.socket = io('/admin');
        this.charts = new ChartManager();
        this.transactions = new TransactionManager();
        this.alerts = new AlertManager();
        this.prices = new PriceManager();
        
        this.elements = {
            totalVolume: document.getElementById('total-volume'),
            activeUsers: document.getElementById('active-users'),
            pendingTx: document.getElementById('pending-tx'),
            networkStats: document.getElementById('network-stats'),
            toast: document.getElementById('toast')
        };

        this.setupSocketListeners();
        this.setupRefreshInterval();
    }

    setupSocketListeners() {
        // Transaction events
        this.socket.on('transaction:new', (data) => {
            this.transactions.addTransaction(data);
            this.updateStats();
            this.showToast(`New ${data.type}: ${data.amount} ${data.currency}`, 'info');
        });

        this.socket.on('transaction:update', (data) => {
            this.transactions.updateTransaction(data);
            this.updateStats();
        });

        // Alert events
        this.socket.on('alert:new', (data) => {
            this.alerts.addAlert(data);
            this.showToast(data.title, 'error');
        });

        this.socket.on('alert:resolved', (data) => {
            this.alerts.removeAlert(data.id);
        });

        // Price updates
        this.socket.on('prices:updated', (data) => {
            this.prices.updatePrices(data);
        });

        // Network stats
        this.socket.on('network:stats', (data) => {
            this.updateNetworkStats(data);
        });

        // User activity
        this.socket.on('users:active', (count) => {
            this.elements.activeUsers.textContent = count;
        });

        // Error events
        this.socket.on('error', (error) => {
            this.showToast(error.message, 'error');
        });
    }

    setupRefreshInterval() {
        // Refresh data every minute
        setInterval(() => {
            this.refreshData();
        }, 60000);

        // Initial data load
        this.refreshData();
    }

    async refreshData() {
        try {
            // Fetch latest stats
            const stats = await this.fetchStats();
            this.updateDashboard(stats);

            // Update charts
            this.charts.updateCharts(stats);

            // Refresh transaction list
            this.transactions.refreshTransactions();

            // Update network stats
            this.updateNetworkStats(stats.networkStats);
        } catch (error) {
            console.error('Data refresh error:', error);
            this.showToast('Failed to refresh dashboard data', 'error');
        }
    }

    async fetchStats() {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) {
            throw new Error('Failed to fetch stats');
        }
        return await response.json();
    }

    updateDashboard(stats) {
        // Update header stats
        this.elements.totalVolume.textContent = this.formatVolume(stats.volume);
        this.elements.pendingTx.textContent = stats.pendingTransactions;

        // Update network stats grid
        this.updateNetworkStats(stats.networkStats);

        // Update charts
        this.charts.updateVolumeChart(stats.hourlyVolume);
        this.charts.updateFailureChart(stats.failureRates);
    }

    updateNetworkStats(stats) {
        this.elements.networkStats.innerHTML = '';
        
        Object.entries(stats).forEach(([network, data]) => {
            const element = document.createElement('div');
            element.className = 'network-stat';
            element.innerHTML = `
                <div class="name">${network}</div>
                <div class="value">
                    <div class="success">${data.successful}</div>
                    <div class="failed">${data.failed}</div>
                    <div class="volume">${this.formatVolume(data.volume)}</div>
                </div>
            `;
            this.elements.networkStats.appendChild(element);
        });
    }

    formatVolume(volume, currency = 'BTC') {
        return `${volume.toFixed(8)} ${currency}`;
    }

    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Settings
    setTheme(theme) {
        document.body.className = theme;
    }

    setAnimationSpeed(speed) {
        document.body.setAttribute('data-animation-speed', speed);
    }
}

class ChartManager {
    constructor() {
        this.volumeChart = this.createVolumeChart();
        this.failureChart = this.createFailureChart();
    }

    createVolumeChart() {
        const ctx = document.getElementById('volume-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                datasets: [
                    {
                        label: 'Deposits',
                        data: [],
                        borderColor: '#44FF44',
                        tension: 0.4
                    },
                    {
                        label: 'Withdrawals',
                        data: [],
                        borderColor: '#FF4444',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: "'Press Start 2P', cursive",
                                size: 10
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                family: "'Press Start 2P', cursive",
                                size: 10
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                family: "'Press Start 2P', cursive",
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }

    createFailureChart() {
        const ctx = document.getElementById('failure-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#44FF44',
                        '#FF4444',
                        '#FFAA00'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                family: "'Press Start 2P', cursive",
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }

    updateVolumeChart(data) {
        const deposits = new Array(24).fill(0);
        const withdrawals = new Array(24).fill(0);

        Object.entries(data).forEach(([hour, volumes]) => {
            deposits[hour] = volumes.deposits;
            withdrawals[hour] = volumes.withdrawals;
        });

        this.volumeChart.data.datasets[0].data = deposits;
        this.volumeChart.data.datasets[1].data = withdrawals;
        this.volumeChart.update();
    }

    updateFailureChart(data) {
        const labels = Object.keys(data);
        const values = Object.values(data);

        this.failureChart.data.labels = labels;
        this.failureChart.data.datasets[0].data = values;
        this.failureChart.update();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardManager();
});
