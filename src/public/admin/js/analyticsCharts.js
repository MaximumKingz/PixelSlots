class ChartManager {
    constructor() {
        Chart.defaults.font.family = "'Press Start 2P', cursive";
        Chart.defaults.font.size = 10;
        Chart.defaults.color = '#ffffff';
        Chart.defaults.plugins.tooltip.backgroundColor = '#2a2a2a';
        Chart.defaults.plugins.tooltip.borderColor = '#4a4a4a';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.titleFont.family = "'Press Start 2P', cursive";
        Chart.defaults.plugins.tooltip.bodyFont.family = "'Press Start 2P', cursive";
        Chart.defaults.plugins.tooltip.footerFont.family = "'Press Start 2P', cursive";
        Chart.defaults.plugins.tooltip.padding = 8;

        this.charts = {
            financial: this.createFinancialChart(),
            userActivity: this.createUserActivityChart(),
            gamePerformance: this.createGamePerformanceChart(),
            featureTriggers: this.createFeatureTriggersChart(),
            jackpot: this.createJackpotChart(),
            behavior: this.createBehaviorChart(),
            risk: this.createRiskChart(),
            retention: this.createRetentionChart()
        };
    }

    createFinancialChart() {
        const ctx = document.getElementById('financial-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Volume',
                        data: [],
                        borderColor: '#44FF44',
                        tension: 0.4
                    },
                    {
                        label: 'Profit',
                        data: [],
                        borderColor: '#FFD700',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += this.formatCurrency(context.parsed.y);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createUserActivityChart() {
        const ctx = document.getElementById('user-activity-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Active Users',
                        data: [],
                        backgroundColor: '#44FF44'
                    },
                    {
                        label: 'New Users',
                        data: [],
                        backgroundColor: '#FFD700'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createGamePerformanceChart() {
        const ctx = document.getElementById('game-performance-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#44FF44',
                        '#FFD700',
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
                        position: 'right'
                    }
                }
            }
        });
    }

    createFeatureTriggersChart() {
        const ctx = document.getElementById('feature-triggers-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Trigger Rate',
                    data: [],
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.2)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: '#3a3a3a'
                        },
                        angleLines: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createJackpotChart() {
        const ctx = document.getElementById('jackpot-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Jackpot Hits',
                    data: [],
                    backgroundColor: '#FFD700'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createBehaviorChart() {
        const ctx = document.getElementById('behavior-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Betting Patterns',
                    data: [],
                    backgroundColor: 'rgba(255, 215, 0, 0.5)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return [
                                    `Bet Size: ${this.formatCurrency(context.raw.x)}`,
                                    `Frequency: ${context.raw.y}`,
                                    `Volume: ${this.formatCurrency(context.raw.r)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Bet Size'
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createRiskChart() {
        const ctx = document.getElementById('risk-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Risk Score',
                    data: [],
                    backgroundColor: (context) => {
                        const value = context.raw.y;
                        if (value > 0.8) return '#FF4444';
                        if (value > 0.5) return '#FFAA00';
                        return '#44FF44';
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        title: {
                            display: true,
                            text: 'Risk Score'
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Volume'
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    createRetentionChart() {
        const ctx = document.getElementById('retention-chart').getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Day 1',
                        data: [],
                        borderColor: '#44FF44'
                    },
                    {
                        label: 'Day 7',
                        data: [],
                        borderColor: '#FFD700'
                    },
                    {
                        label: 'Day 30',
                        data: [],
                        borderColor: '#FF4444'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    x: {
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }

    updateChart(chartName, data) {
        const chart = this.charts[chartName];
        if (!chart) return;

        if (data.labels) {
            chart.data.labels = data.labels;
        }
        if (data.datasets) {
            chart.data.datasets = data.datasets;
        }
        chart.update();
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

    destroy() {
        Object.values(this.charts).forEach(chart => chart.destroy());
    }
}

// Initialize chart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
});
