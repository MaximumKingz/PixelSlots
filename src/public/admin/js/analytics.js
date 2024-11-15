class Analytics {
    constructor() {
        this.socket = io();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Date range controls
        document.getElementById('start-date').addEventListener('change', () => this.refreshData());
        document.getElementById('end-date').addEventListener('change', () => this.refreshData());
        document.getElementById('currency-select').addEventListener('change', () => this.refreshData());

        // Modal controls
        document.querySelector('.modal .close').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Card click handlers
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => this.showDetailedView(card.querySelector('h3').textContent));
        });
    }

    setupSocketListeners() {
        // Real-time updates
        this.socket.on('financial_update', (data) => this.updateFinancialData(data));
        this.socket.on('user_activity_update', (data) => this.updateUserActivityData(data));
        this.socket.on('game_update', (data) => this.updateGameData(data));
        this.socket.on('jackpot_update', (data) => this.updateJackpotData(data));
        this.socket.on('risk_alert', (data) => this.handleRiskAlert(data));
    }

    async loadInitialData() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            document.getElementById('start-date').value = this.formatDate(startDate);
            document.getElementById('end-date').value = this.formatDate(endDate);

            await this.refreshData();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load analytics data', 'error');
        }
    }

    async refreshData() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const currency = document.getElementById('currency-select').value;

        try {
            const [
                financial,
                performance,
                features,
                jackpots,
                behavior,
                risk
            ] = await Promise.all([
                this.fetchData('/api/analytics/financial', { currency, startDate, endDate }),
                this.fetchData('/api/analytics/performance', { startDate, endDate }),
                this.fetchData('/api/analytics/features', { startDate, endDate }),
                this.fetchData('/api/analytics/jackpots', { startDate, endDate }),
                this.fetchData('/api/analytics/behavior', { startDate, endDate }),
                this.fetchData('/api/analytics/risk', { startDate, endDate })
            ]);

            this.updateDashboard({
                financial,
                performance,
                features,
                jackpots,
                behavior,
                risk
            });
        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showToast('Failed to refresh analytics data', 'error');
        }
    }

    async fetchData(endpoint, params) {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${endpoint}?${queryString}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        return response.json();
    }

    updateDashboard(data) {
        this.updateFinancialData(data.financial);
        this.updateUserActivityData(data.performance);
        this.updateGameData(data.features);
        this.updateJackpotData(data.jackpots);
        this.updateBehaviorData(data.behavior);
        this.updateRiskData(data.risk);
    }

    updateFinancialData(data) {
        // Update chart
        window.chartManager.updateChart('financial', {
            labels: data.hourlyVolume.map(item => item.hour),
            datasets: [
                {
                    label: 'Volume',
                    data: data.hourlyVolume.map(item => item.deposits + item.withdrawals)
                },
                {
                    label: 'Profit',
                    data: data.profit.map(item => item.total_profit)
                }
            ]
        });

        // Update stats
        document.getElementById('total-volume').textContent = this.formatCurrency(data.volume[0].total_deposits + data.volume[0].total_withdrawals);
        document.getElementById('net-profit').textContent = this.formatCurrency(data.profit[0].total_profit);
        document.getElementById('rtp-rate').textContent = this.formatPercentage((data.profit[0].total_payout / data.profit[0].total_wagered) * 100);
    }

    updateUserActivityData(data) {
        // Update chart
        window.chartManager.updateChart('userActivity', {
            labels: data.metrics.map(item => item.date),
            datasets: [
                {
                    label: 'Active Users',
                    data: data.metrics.map(item => item.daily_active_users)
                },
                {
                    label: 'New Users',
                    data: data.retention.map(item => item.new_users)
                }
            ]
        });

        // Update stats
        const latestMetrics = data.metrics[0];
        document.getElementById('active-users').textContent = this.formatNumber(latestMetrics.daily_active_users);
        document.getElementById('new-users').textContent = this.formatNumber(data.retention[0].new_users);
    }

    updateGameData(data) {
        // Update chart
        window.chartManager.updateChart('gamePerformance', {
            labels: data.features.map(item => item.feature_name),
            datasets: [{
                data: data.features.map(item => item.trigger_count)
            }]
        });

        // Update feature list
        const featureList = document.getElementById('feature-list');
        featureList.innerHTML = data.features.map(feature => `
            <div class="feature-item">
                <span>${feature.feature_name}</span>
                <span>${this.formatNumber(feature.trigger_count)}</span>
            </div>
        `).join('');
    }

    updateJackpotData(data) {
        // Update chart
        window.chartManager.updateChart('jackpot', {
            labels: data.stats.map(item => item.date),
            datasets: [{
                data: data.stats.map(item => item.hits)
            }]
        });

        // Update winners list
        const winnersList = document.getElementById('jackpot-winners');
        winnersList.innerHTML = data.topWinners.map(winner => `
            <div class="winner-item">
                <span>${winner.user_id}</span>
                <span>${this.formatCurrency(winner.total_won)}</span>
            </div>
        `).join('');
    }

    updateBehaviorData(data) {
        // Update chart
        window.chartManager.updateChart('behavior', {
            datasets: [{
                data: data.betPatterns.map(pattern => ({
                    x: pattern.avg_bet,
                    y: pattern.total_bets,
                    r: pattern.bet_variance
                }))
            }]
        });

        // Update patterns list
        const patternsList = document.getElementById('behavior-patterns');
        patternsList.innerHTML = data.sessionPatterns.map(pattern => `
            <div class="pattern-item">
                <span>${pattern.session_type}</span>
                <span>${this.formatNumber(pattern.session_count)}</span>
            </div>
        `).join('');
    }

    updateRiskData(data) {
        // Update chart
        window.chartManager.updateChart('risk', {
            datasets: [{
                data: data.highRiskUsers.map(user => ({
                    x: user.total_wagered,
                    y: user.risk_score
                }))
            }]
        });

        // Update alerts list
        const alertsList = document.getElementById('risk-alerts');
        alertsList.innerHTML = data.unusualPatterns.map(pattern => `
            <div class="alert-item ${this.getRiskLevel(pattern.pattern_count)}">
                <span>${pattern.user_id}</span>
                <span>${this.formatNumber(pattern.pattern_count)}</span>
            </div>
        `).join('');
    }

    handleRiskAlert(data) {
        this.showToast(`Risk Alert: ${data.message}`, 'error');
        // Update risk data if needed
        this.refreshData();
    }

    showDetailedView(title) {
        const modal = document.getElementById('detail-modal');
        document.getElementById('modal-title').textContent = title;
        modal.classList.add('show');
        this.loadDetailedData(title);
    }

    async loadDetailedData(type) {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const currency = document.getElementById('currency-select').value;

        try {
            const data = await this.fetchData(`/api/analytics/${type.toLowerCase()}`, {
                startDate,
                endDate,
                currency
            });

            this.updateDetailedView(type, data);
        } catch (error) {
            console.error('Failed to load detailed data:', error);
            this.showToast('Failed to load detailed view', 'error');
        }
    }

    updateDetailedView(type, data) {
        // Update detail chart based on type
        const chartData = this.getDetailChartData(type, data);
        window.chartManager.updateChart('detail-chart', chartData);

        // Update stats
        const stats = this.getDetailStats(type, data);
        document.getElementById('detail-stats').innerHTML = stats.map(stat => `
            <div class="stat">
                <span class="label">${stat.label}</span>
                <span class="value">${stat.value}</span>
            </div>
        `).join('');

        // Update table
        const table = this.getDetailTable(type, data);
        document.getElementById('detail-table').innerHTML = table;
    }

    closeModal() {
        document.getElementById('detail-modal').classList.remove('show');
    }

    getDetailChartData(type, data) {
        // Return appropriate chart data based on type
        switch (type.toLowerCase()) {
            case 'financial overview':
                return {
                    labels: data.hourlyVolume.map(item => item.hour),
                    datasets: [
                        {
                            label: 'Volume',
                            data: data.hourlyVolume.map(item => item.deposits + item.withdrawals)
                        }
                    ]
                };
            // Add cases for other types
            default:
                return {
                    labels: [],
                    datasets: []
                };
        }
    }

    getDetailStats(type, data) {
        // Return appropriate stats based on type
        switch (type.toLowerCase()) {
            case 'financial overview':
                return [
                    { label: 'Total Volume', value: this.formatCurrency(data.volume.total_volume) },
                    { label: 'Net Profit', value: this.formatCurrency(data.profit.total_profit) }
                ];
            // Add cases for other types
            default:
                return [];
        }
    }

    getDetailTable(type, data) {
        // Return appropriate table HTML based on type
        switch (type.toLowerCase()) {
            case 'financial overview':
                return `
                    <tr>
                        <th>Date</th>
                        <th>Volume</th>
                        <th>Profit</th>
                    </tr>
                    ${data.hourlyVolume.map(item => `
                        <tr>
                            <td>${item.hour}</td>
                            <td>${this.formatCurrency(item.deposits + item.withdrawals)}</td>
                            <td>${this.formatCurrency(item.profit)}</td>
                        </tr>
                    `).join('')}
                `;
            // Add cases for other types
            default:
                return '';
        }
    }

    getRiskLevel(count) {
        if (count > 1000) return 'high';
        if (count > 500) return 'medium';
        return 'low';
    }

    formatCurrency(value, currency = 'BTC') {
        return `${value.toFixed(8)} ${currency}`;
    }

    formatPercentage(value) {
        return `${value.toFixed(2)}%`;
    }

    formatNumber(value) {
        return value.toLocaleString();
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = 'toast', 3000);
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new Analytics();
});
