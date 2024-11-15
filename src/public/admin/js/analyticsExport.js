class AnalyticsExport {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('export-data').addEventListener('click', () => this.exportAllData());
        document.getElementById('export-details').addEventListener('click', () => this.exportDetailedView());
    }

    async exportAllData() {
        try {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            const currency = document.getElementById('currency-select').value;

            const data = await this.gatherAllData(startDate, endDate, currency);
            this.downloadExcel(data, 'pixel_slots_analytics');
            this.showToast('Analytics data exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export analytics data', 'error');
        }
    }

    async exportDetailedView() {
        try {
            const modalTitle = document.getElementById('modal-title').textContent;
            const data = await this.gatherDetailedData();
            this.downloadExcel(data, `pixel_slots_${modalTitle.toLowerCase()}_details`);
            this.showToast('Detailed data exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export detailed data', 'error');
        }
    }

    async gatherAllData(startDate, endDate, currency) {
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

        return {
            'Financial Overview': this.formatFinancialData(financial),
            'Performance Metrics': this.formatPerformanceData(performance),
            'Feature Analysis': this.formatFeatureData(features),
            'Jackpot Statistics': this.formatJackpotData(jackpots),
            'User Behavior': this.formatBehaviorData(behavior),
            'Risk Analysis': this.formatRiskData(risk)
        };
    }

    async gatherDetailedData() {
        const modalTitle = document.getElementById('modal-title').textContent.toLowerCase();
        const tableData = this.getTableData();
        const chartData = this.getChartData();

        return {
            'Summary': this.formatSummaryData(modalTitle),
            'Detailed Data': tableData,
            'Chart Data': chartData
        };
    }

    async fetchData(endpoint, params) {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${endpoint}?${queryString}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        return response.json();
    }

    formatFinancialData(data) {
        return data.volume.map(item => ({
            Date: item.date,
            'Total Volume': item.total_volume,
            'Net Profit': item.net_profit,
            'Deposit Count': item.deposit_count,
            'Withdrawal Count': item.withdrawal_count,
            'RTP Rate': item.rtp_rate
        }));
    }

    formatPerformanceData(data) {
        return data.metrics.map(item => ({
            Date: item.date,
            'Daily Active Users': item.daily_active_users,
            'Total Games': item.total_games,
            'Total Wagered': item.total_wagered,
            'Total Won': item.total_won,
            'Average Session Time': item.avg_session_time
        }));
    }

    formatFeatureData(data) {
        return data.features.map(item => ({
            'Feature Name': item.feature_name,
            'Trigger Count': item.trigger_count,
            'Average Multiplier': item.avg_multiplier,
            'Total Payout': item.total_payout
        }));
    }

    formatJackpotData(data) {
        return data.stats.map(item => ({
            Date: item.date,
            'Jackpot Type': item.jackpot_type,
            'Hits': item.hits,
            'Total Amount': item.total_amount,
            'Average Amount': item.avg_amount,
            'Max Amount': item.max_amount
        }));
    }

    formatBehaviorData(data) {
        return data.betPatterns.map(item => ({
            'User ID': item.user_id,
            'Total Bets': item.total_bets,
            'Average Bet': item.avg_bet,
            'Min Bet': item.min_bet,
            'Max Bet': item.max_bet,
            'Bet Variance': item.bet_variance
        }));
    }

    formatRiskData(data) {
        return data.highRiskUsers.map(item => ({
            'User ID': item.user_id,
            'Risk Score': item.risk_score,
            'Total Games': item.total_games,
            'Total Wagered': item.total_wagered,
            'Win Rate': item.win_rate,
            'Volatility': item.bet_volatility
        }));
    }

    formatSummaryData(type) {
        const stats = document.getElementById('detail-stats');
        const summary = [];
        
        stats.querySelectorAll('.stat').forEach(stat => {
            summary.push({
                Metric: stat.querySelector('.label').textContent,
                Value: stat.querySelector('.value').textContent
            });
        });

        return summary;
    }

    getTableData() {
        const table = document.getElementById('detail-table');
        const data = [];
        const headers = [];

        // Get headers
        table.querySelectorAll('th').forEach(th => headers.push(th.textContent));

        // Get rows
        table.querySelectorAll('tr').forEach((tr, index) => {
            if (index === 0) return; // Skip header row
            const row = {};
            tr.querySelectorAll('td').forEach((td, i) => {
                row[headers[i]] = td.textContent;
            });
            data.push(row);
        });

        return data;
    }

    getChartData() {
        const chart = Chart.getChart('detail-chart');
        if (!chart) return [];

        return chart.data.datasets.map(dataset => ({
            Label: dataset.label,
            Data: dataset.data
        }));
    }

    downloadExcel(data, filename) {
        const wb = XLSX.utils.book_new();
        
        // Add each sheet
        Object.entries(data).forEach(([sheetName, sheetData]) => {
            const ws = XLSX.utils.json_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // Save file
        XLSX.writeFile(wb, `${filename}_${this.formatDate(new Date())}.xlsx`);
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

// Initialize export manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsExport = new AnalyticsExport();
});
