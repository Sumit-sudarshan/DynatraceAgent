// === DOM ELEMENTS ===
const connectionIndicator = document.getElementById('connection-indicator');
const feedContainer = document.getElementById('feed-container');
const detailContainer = document.getElementById('detail-container');

const hourlyBurnEl = document.getElementById('hourly-burn');
const budgetPctEl = document.getElementById('budget-pct');
const budgetProgressEl = document.getElementById('budget-progress');

const fpRateEl = document.getElementById('fp-rate');
const fpProgressEl = document.getElementById('fp-progress');
const routingTierEl = document.getElementById('routing-tier');
const mcpAlertEl = document.getElementById('mcp-alert');

// KPI elements
const kpiTotalEl = document.getElementById('kpi-total-val');
const kpiApprovedEl = document.getElementById('kpi-approved-val');
const kpiFlaggedEl = document.getElementById('kpi-flagged-val');
const kpiBlockedEl = document.getElementById('kpi-blocked-val');

let messages = [];
let costHistory = [];
const MAX_COST_POINTS = 30;

// === CHART.JS SETUP ===
const costCtx = document.getElementById('cost-chart').getContext('2d');
const fraudCtx = document.getElementById('fraud-chart').getContext('2d');

const costChart = new Chart(costCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Cumulative Cost ($)',
            data: [],
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                display: true,
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#6b7280', font: { size: 9, family: "'JetBrains Mono'" }, maxTicksLimit: 6 }
            },
            y: {
                display: true,
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: { color: '#6b7280', font: { size: 9, family: "'JetBrains Mono'" }, callback: v => '$' + v.toFixed(3) }
            }
        }
    }
});

const fraudChart = new Chart(fraudCtx, {
    type: 'doughnut',
    data: {
        labels: ['Approved', 'Flagged', 'Blocked'],
        datasets: [{
            data: [0, 0, 0],
            backgroundColor: ['rgba(52, 211, 153, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(239, 68, 68, 0.7)'],
            borderColor: ['#34d399', '#f59e0b', '#ef4444'],
            borderWidth: 1,
            hoverOffset: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#9ca3af', font: { size: 10, family: "'Inter'" }, padding: 12, usePointStyle: true, pointStyleWidth: 8 }
            }
        }
    }
});

// === WEBSOCKET ===
function connect() {
    const wsUrl = `ws://${window.location.host}/ws/transactions`;
    const url = window.location.protocol === "file:" ? "ws://localhost:8000/ws/transactions" : wsUrl;
    
    const ws = new WebSocket(url);

    ws.onopen = () => {
        connectionIndicator.classList.remove('disconnected');
        connectionIndicator.classList.add('connected');
        console.log('Connected to WebSocket');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.metrics) {
                updateMetrics(data.metrics);
            }
            
            if (data.stats) {
                updateKPIs(data.stats);
            }
            
            if (data.transaction && data.result) {
                messages.unshift(data);
                if (messages.length > 50) messages.pop();
                
                renderFeed();
                
                // Auto-select the latest BLOCK or FLAG for dramatic effect, or first message
                const decision = data.result.decision.toUpperCase();
                if (decision === 'BLOCK' || decision === 'FLAG' || messages.length === 1) {
                    renderDetails(data);
                }
            }
        } catch (e) {
            console.error("Error parsing websocket message", e);
        }
    };

    ws.onclose = () => {
        connectionIndicator.classList.remove('connected');
        connectionIndicator.classList.add('disconnected');
        console.log('Disconnected. Retrying...');
        setTimeout(connect, 3000);
    };
    
    ws.onerror = () => ws.close();
}

// === UPDATE FUNCTIONS ===
function updateKPIs(stats) {
    kpiTotalEl.textContent = stats.total;
    kpiApprovedEl.textContent = stats.approved;
    kpiFlaggedEl.textContent = stats.flagged;
    kpiBlockedEl.textContent = stats.blocked;
    
    // Update fraud doughnut chart
    fraudChart.data.datasets[0].data = [stats.approved, stats.flagged, stats.blocked];
    fraudChart.update('none');
}

function updateMetrics(metrics) {
    // Update Budget
    const burn = metrics.budget_spend_usd.toFixed(4);
    const pct = metrics.budget_utilization_pct;
    
    hourlyBurnEl.textContent = `$${burn}`;
    budgetPctEl.textContent = `${pct.toFixed(1)}%`;
    budgetProgressEl.style.width = `${Math.min(100, pct)}%`;
    
    if (pct > 80) {
        budgetProgressEl.classList.remove('bg-emerald');
        budgetProgressEl.classList.add('bg-red');
        hourlyBurnEl.classList.remove('text-emerald');
        hourlyBurnEl.classList.add('text-red');
    } else {
        budgetProgressEl.classList.remove('bg-red');
        budgetProgressEl.classList.add('bg-emerald');
        hourlyBurnEl.classList.remove('text-red');
        hourlyBurnEl.classList.add('text-emerald');
    }

    // Update Cost Chart
    const now = new Date();
    const timeLabel = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`;
    costChart.data.labels.push(timeLabel);
    costChart.data.datasets[0].data.push(metrics.budget_spend_usd);
    
    if (costChart.data.labels.length > MAX_COST_POINTS) {
        costChart.data.labels.shift();
        costChart.data.datasets[0].data.shift();
    }
    costChart.update('none');

    // Update Self Healing
    const fp = metrics.false_positive_rate;
    fpRateEl.textContent = `${(fp * 100).toFixed(1)}%`;
    fpProgressEl.style.width = `${Math.min(100, fp * 100)}%`;
    
    if (fp > 0.15) {
        fpRateEl.classList.replace('text-emerald', 'text-red');
        fpProgressEl.classList.replace('bg-blue', 'bg-red');
        fpProgressEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
        mcpAlertEl.classList.remove('hidden');
    } else {
        fpRateEl.classList.replace('text-red', 'text-emerald');
        fpProgressEl.classList.replace('bg-red', 'bg-blue');
        fpProgressEl.style.boxShadow = 'none';
        mcpAlertEl.classList.add('hidden');
    }
    
    // Update Router Tier
    const tier = metrics.current_routing_tier.toLowerCase();
    routingTierEl.textContent = `${tier.toUpperCase()} TIER`;
    routingTierEl.className = `routing-badge tier-${tier}`;
}

function renderFeed() {
    feedContainer.innerHTML = '';
    
    messages.forEach((msg) => {
        const card = document.createElement('div');
        const decision = msg.result.decision.toLowerCase();
        
        card.className = `tx-card ${decision}`;
        card.onclick = () => renderDetails(msg);
        
        let reasonHtml = '';
        if (decision !== 'approve') {
            reasonHtml = `<div class="tx-reason"><strong>AI Trigger:</strong> ${msg.result.fraud_category}</div>`;
        }

        card.innerHTML = `
            <div class="tx-header">
                <span class="tx-id">${msg.transaction.transaction_id}</span>
                <span class="decision-badge ${decision}">${msg.result.decision}</span>
            </div>
            <div class="tx-body">
                <span class="tx-amount">$${msg.transaction.amount.toFixed(2)}</span>
                <span class="tx-merchant">${msg.transaction.merchant_name}</span>
            </div>
            ${reasonHtml}
        `;
        
        feedContainer.appendChild(card);
    });
}

function renderDetails(msg) {
    const isHighRisk = msg.result.risk_score > 70;
    const tierLabel = msg.result.routing_tier || 'standard';
    const model = tierLabel === 'economy' ? 'Gemini 2.0 Flash' : 'Gemini 2.0 Pro';
    
    detailContainer.innerHTML = `
        <div class="detail-section">
            <h3 class="section-title">Target Subject</h3>
            <div class="info-grid">
                <div>
                    <p class="info-label">Customer ID</p>
                    <p class="info-value">${msg.transaction.customer_id}</p>
                </div>
                <div>
                    <p class="info-label">Location</p>
                    <p class="info-value">${msg.transaction.location}</p>
                </div>
                <div>
                    <p class="info-label">Amount</p>
                    <p class="info-value">$${msg.transaction.amount.toFixed(2)}</p>
                </div>
                <div>
                    <p class="info-label">Category</p>
                    <p class="info-value">${msg.transaction.merchant_name}</p>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="section-title">AI Reasoning Chain</h3>
            <p class="reasoning-text">${msg.result.explanation}</p>
        </div>
        
        <div class="detail-section">
            <h3 class="section-title">Telemetry Evidence</h3>
            <ul class="evidence-list">
                <li class="evidence-item">
                    <span class="evidence-bullet">●</span>
                    <span class="evidence-label">Model:</span>
                    <span class="evidence-value">${model}</span>
                </li>
                <li class="evidence-item">
                    <span class="evidence-bullet">●</span>
                    <span class="evidence-label">Cost Tier:</span>
                    <span class="evidence-value">${tierLabel.toUpperCase()}</span>
                </li>
                <li class="evidence-item">
                    <span class="evidence-bullet">●</span>
                    <span class="evidence-label">Risk Score:</span>
                    <span class="evidence-value" style="color: ${isHighRisk ? 'var(--color-red)' : 'var(--color-emerald)'}">
                        ${msg.result.risk_score}/100
                    </span>
                </li>
                <li class="evidence-item">
                    <span class="evidence-bullet">●</span>
                    <span class="evidence-label">Confidence:</span>
                    <span class="evidence-value">${(msg.result.confidence * 100).toFixed(0)}%</span>
                </li>
                <li class="evidence-item">
                    <span class="evidence-bullet">●</span>
                    <span class="evidence-label">Category:</span>
                    <span class="evidence-value">${msg.result.fraud_category}</span>
                </li>
            </ul>
        </div>
    `;
}

// Start connection
connect();
