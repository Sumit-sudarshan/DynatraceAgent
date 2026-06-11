/* ============================================================
   FinSentinel — Analytics Page JavaScript (Fixed)
   - Contexts grabbed INSIDE initCharts (not at module top-level)
   - initCharts always called even on fetch failure (fallback data)
   - Live chart update every 5s via WS data
   - Category chart updated dynamically from real data
   ============================================================ */

// === STATE ===
let transactions = [];
let trendChart, categoryChart, modelChart;
let chartsInitialized = false;
let analyticsData = null; // real data from /api/analytics
let currentTimeWindow = 24; // hours

// === DOM ===
const connectionIndicator = document.getElementById('connection-indicator');
const sidebar  = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

const statTotal     = document.getElementById('stat-total');
const statFraudRate = document.getElementById('stat-fraud-rate');
const statSaved     = document.getElementById('stat-saved');
const statApiCost   = document.getElementById('stat-api-cost');

// === SIDEBAR ===
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// === TIME FILTERS ===
document.querySelectorAll('.time-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const hours = parseInt(e.target.dataset.hours || 24);
        currentTimeWindow = hours;
        updateTrendChart();
    });
});

// === FETCH DATA ===
async function fetchAnalytics() {
    const baseUrl = window.location.protocol === 'file:'
        ? 'http://localhost:8000'
        : window.location.origin;

    try {
        const [txRes, analyticsRes] = await Promise.all([
            fetch(`${baseUrl}/api/transactions`),
            fetch(`${baseUrl}/api/analytics`)
        ]);
        if (txRes.ok) {
            const data = await txRes.json();
            transactions = data.map(item => ({
                amount:        item.transaction?.amount         || 0,
                decision:      item.result?.decision            || 'APPROVE',
                fraudCategory: item.result?.fraud_category     || 'none',
                tier:          item.result?.routing_tier        || 'standard',
                timestamp:     item.transaction?.timestamp     || Date.now() / 1000
            }));
        }
        if (analyticsRes.ok) {
            analyticsData = await analyticsRes.json();
        }
    } catch (err) {
        console.warn('Analytics fetch failed, using available data:', err);
    }

    calculateStats();
    initCharts();
}


// === CALCULATE AGGREGATES ===
function calculateStats() {
    if (!transactions.length) return;

    const total = transactions.length;
    let blocked = 0, saved = 0, apiCost = 0;

    transactions.forEach(tx => {
        const d = tx.decision.toUpperCase();
        if (d === 'BLOCK' || d === 'FLAG') {
            blocked++;
            saved += tx.amount;
        }
        apiCost += tx.tier === 'premium' ? 0.005 : tx.tier === 'economy' ? 0.0005 : 0.001;
    });

    const fraudRate = ((blocked / total) * 100).toFixed(1);

    if (statTotal)     statTotal.textContent     = total.toLocaleString();
    if (statFraudRate) statFraudRate.textContent = `${fraudRate}%`;
    if (statSaved)     statSaved.textContent     = `$${saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (statApiCost)   statApiCost.textContent   = `$${apiCost.toFixed(3)}`;
}

// === INIT CHARTS — contexts grabbed here so DOM is guaranteed ready ===
function initCharts() {
    if (chartsInitialized) return;

    const trendEl    = document.getElementById('trend-chart');
    const categoryEl = document.getElementById('category-chart');
    const modelEl    = document.getElementById('model-chart');

    if (!trendEl || !categoryEl || !modelEl) {
        console.error('Chart canvases not found in DOM');
        return;
    }

    chartsInitialized = true;

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // ---- 1. Stacked Bar: Volume & Action Trends ----
    const now = new Date();
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
        const h = (now.getHours() - 23 + i + 24) % 24;
        return `${h}:00`;
    });

    // Build approval / block counts per hour from real data filtered by time window
    const approveByHour = new Array(24).fill(0);
    const blockByHour   = new Array(24).fill(0);
    const cutoffTs = (Date.now() / 1000) - (currentTimeWindow * 3600);

    transactions.filter(tx => tx.timestamp >= cutoffTs).forEach(tx => {
        const txHour = new Date(tx.timestamp * 1000).getHours();
        const slotIdx = hourLabels.findIndex(l => parseInt(l) === txHour);
        if (slotIdx === -1) return;
        if (tx.decision.toUpperCase() === 'APPROVE') approveByHour[slotIdx]++;
        else blockByHour[slotIdx]++;
    });

    const dataApprove = approveByHour;
    const dataBlock   = blockByHour;

    trendChart = new Chart(trendEl.getContext('2d'), {
        type: 'bar',
        data: {
            labels: hourLabels,
            datasets: [
                {
                    label: 'Approved',
                    data: dataApprove,
                    backgroundColor: 'rgba(52, 211, 153, 0.75)',
                    borderRadius: 3,
                    stack: 'a'
                },
                {
                    label: 'Blocked / Flagged',
                    data: dataBlock,
                    backgroundColor: 'rgba(239, 68, 68, 0.75)',
                    borderRadius: 3,
                    stack: 'a'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'rect', font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(55, 65, 81, 0.8)',
                    borderWidth: 1,
                    padding: 10,
                    titleFont: { size: 12 },
                    bodyFont: { family: "'JetBrains Mono'", size: 11 }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#4b5563', font: { size: 9 }, maxTicksLimit: 12 }
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    border: { display: false },
                    ticks: { color: '#4b5563', font: { size: 9 } }
                }
            }
        }
    });

    // ---- 2. Doughnut: Fraud by Category ----
    const catCounts = {};
    transactions.forEach(tx => {
        const d = tx.decision.toUpperCase();
        if ((d === 'BLOCK' || d === 'FLAG') && tx.fraudCategory && tx.fraudCategory !== 'none') {
            const label = tx.fraudCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            catCounts[label] = (catCounts[label] || 0) + 1;
        }
    });

    if (Object.keys(catCounts).length === 0) {
        catCounts['No Fraud Detected'] = 1;
    }

    const catColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#22d3ee'];

    categoryChart = new Chart(categoryEl.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(catCounts),
            datasets: [{
                data: Object.values(catCounts),
                backgroundColor: catColors.slice(0, Object.keys(catCounts).length),
                borderColor: 'rgba(3, 7, 18, 0.8)',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true,
                        font: { size: 10, family: "'Inter'" },
                        color: '#9ca3af',
                        padding: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(55, 65, 81, 0.8)',
                    borderWidth: 1,
                    padding: 8,
                    bodyFont: { family: "'JetBrains Mono'", size: 11 }
                }
            }
        }
    });

    // ---- 3. Scatter: Cost vs Latency — REAL data from /api/analytics ----
    const scatterByTier = analyticsData?.scatter_by_tier || {};
    const economyPts  = scatterByTier.economy  || [];
    const standardPts = scatterByTier.standard || [];
    const premiumPts  = scatterByTier.premium  || [];

    modelChart = new Chart(modelEl.getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Economy (Flash)',
                    data: economyPts,
                    backgroundColor: 'rgba(34, 211, 238, 0.55)',
                    borderColor: '#22d3ee',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Standard',
                    data: standardPts,
                    backgroundColor: 'rgba(59, 130, 246, 0.55)',
                    borderColor: '#3b82f6',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Premium (Pro)',
                    data: premiumPts,
                    backgroundColor: 'rgba(168, 85, 247, 0.55)',
                    borderColor: '#a855f7',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(55, 65, 81, 0.8)',
                    borderWidth: 1,
                    padding: 8,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.raw.x.toFixed(0)}ms | $${ctx.raw.y.toFixed(4)}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Latency (ms)', color: '#6b7280', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#4b5563', font: { size: 9 } }
                },
                y: {
                    title: { display: true, text: 'Cost per call ($)', color: '#6b7280', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    border: { display: false },
                    ticks: { color: '#4b5563', font: { size: 9, family: "'JetBrains Mono'" }, callback: v => '$' + v.toFixed(4) }
                }
            }
        }
    });
}

// === UPDATE TREND CHART WITH CURRENT TIME WINDOW ===
function updateTrendChart() {
    if (!trendChart) return;
    const approveByHour = new Array(24).fill(0);
    const blockByHour   = new Array(24).fill(0);
    const cutoffTs = (Date.now() / 1000) - (currentTimeWindow * 3600);
    transactions.filter(tx => tx.timestamp >= cutoffTs).forEach(tx => {
        const txHour = new Date(tx.timestamp * 1000).getHours();
        const slotIdx = txHour % 24;
        if (tx.decision.toUpperCase() === 'APPROVE') approveByHour[slotIdx]++;
        else blockByHour[slotIdx]++;
    });
    trendChart.data.datasets[0].data = approveByHour;
    trendChart.data.datasets[1].data = blockByHour;
    trendChart.update('active');
}

// === WEBSOCKET ===
function connectWS() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/transactions`;
    const url = window.location.protocol === 'file:' ? 'ws://localhost:8000/ws/transactions' : wsUrl;
    const ws = new WebSocket(url);

    ws.onopen = () => {
        connectionIndicator.classList.remove('indicator-dot--disconnected');
        connectionIndicator.classList.add('indicator-dot--connected');
        document.getElementById('connection-label').textContent = 'LIVE STREAM';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            
            if (data.transaction && data.result) {
                transactions.push({
                    amount:        data.transaction.amount,
                    decision:      data.result.decision,
                    fraudCategory: data.result.fraud_category || 'none',
                    tier:          data.result.routing_tier || 'standard',
                    timestamp:     data.transaction.timestamp || Date.now() / 1000
                });
                if (transactions.length > 1000) transactions.shift();
                calculateStats();
            }
        } catch (e) { /* ignore parse errors */ }
    };

    ws.onclose = () => {
        connectionIndicator.classList.remove('indicator-dot--connected');
        connectionIndicator.classList.add('indicator-dot--disconnected');
        document.getElementById('connection-label').textContent = 'LIVE STREAM';
        setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();
}

// === INIT ===
fetchAnalytics();
connectWS();
