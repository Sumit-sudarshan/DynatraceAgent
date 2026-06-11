/* ============================================================
   FinSentinel — Dashboard JavaScript
   WebSocket, Charts, KPI updates, Feed, Detail Panel
   ============================================================ */

// === STATE ===
let messages = [];
let costHistory = [];
const MAX_FEED_ITEMS = 50;
const MAX_COST_POINTS = 30;

// === DOM ELEMENTS ===
const feedContainer = document.getElementById('feed-container');
const detailContainer = document.getElementById('detail-container');
const connectionIndicator = document.getElementById('connection-indicator');

// KPI Elements
const kpiTotalEl = document.getElementById('kpi-total-val');
const kpiApprovedEl = document.getElementById('kpi-approved-val');
const kpiFlaggedEl = document.getElementById('kpi-flagged-val');
const kpiBlockedEl = document.getElementById('kpi-blocked-val');
const kpiFraudRateEl = document.getElementById('kpi-fraud-rate-val');
const kpiCostEl = document.getElementById('kpi-cost-val');

// Health Elements
const hourlyBurnEl = document.getElementById('hourly-burn');
const budgetPctEl = document.getElementById('budget-pct');
const budgetProgressEl = document.getElementById('budget-progress');
const fpRateEl = document.getElementById('fp-rate');
const fpProgressEl = document.getElementById('fp-progress');
const routingTierEl = document.getElementById('routing-tier');
const mcpAlertEl = document.getElementById('mcp-alert');

// === SIDEBAR TOGGLE ===
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// === CHART.JS SETUP (deferred until DOM ready) ===
let costChart, fraudChart;

function initCharts() {
    const costCtx = document.getElementById('cost-chart')?.getContext('2d');
    const fraudCtx = document.getElementById('fraud-chart')?.getContext('2d');
    if (!costCtx || !fraudCtx) return;

    costChart = new Chart(costCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Cumulative Cost ($)',
                data: [],
                borderColor: '#22d3ee',
                backgroundColor: (ctx) => {
                    const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
                    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.2)');
                    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.01)');
                    return gradient;
                },
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#22d3ee'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(55, 65, 81, 0.8)',
                    borderWidth: 1,
                    titleFont: { family: "'Inter'", size: 11 },
                    bodyFont: { family: "'JetBrains Mono'", size: 11 },
                    padding: 8,
                    cornerRadius: 6
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
                    ticks: { color: '#4b5563', font: { size: 9, family: "'JetBrains Mono'" }, maxTicksLimit: 6 }
                },
                y: {
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
                    ticks: { color: '#4b5563', font: { size: 9, family: "'JetBrains Mono'" }, callback: v => '$' + v.toFixed(3) }
                }
            }
        }
    });

    fraudChart = new Chart(fraudCtx, {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Flagged', 'Blocked'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(52, 211, 153, 0.75)',
                    'rgba(245, 158, 11, 0.75)',
                    'rgba(239, 68, 68, 0.75)'
                ],
                borderColor: ['#34d399', '#f59e0b', '#ef4444'],
                borderWidth: 1.5,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: { size: 10, family: "'Inter'", weight: 500 },
                        padding: 14,
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(55, 65, 81, 0.8)',
                    borderWidth: 1,
                    titleFont: { family: "'Inter'", size: 11 },
                    bodyFont: { family: "'JetBrains Mono'", size: 11 },
                    padding: 8,
                    cornerRadius: 6
                }
            }
        }
    });
}

// === WEBSOCKET ===
function connect() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/transactions`;
    const url = window.location.protocol === "file:" ? "ws://localhost:8000/ws/transactions" : wsUrl;

    const ws = new WebSocket(url);

    ws.onopen = () => {
        connectionIndicator.classList.remove('indicator-dot--disconnected');
        connectionIndicator.classList.add('indicator-dot--connected');
        document.getElementById('connection-label').textContent = 'LIVE STREAM';
        console.log('WebSocket connected');
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
                if (messages.length > MAX_FEED_ITEMS) messages.pop();

                renderFeed();

                // Auto-select the newly arrived transaction
                renderDetails(data);
            }
        } catch (e) {
            console.error("Error parsing websocket message", e);
        }
    };

    ws.onclose = () => {
        connectionIndicator.classList.remove('indicator-dot--connected');
        connectionIndicator.classList.add('indicator-dot--disconnected');
        document.getElementById('connection-label').textContent = 'LIVE STREAM';
        console.log('Disconnected. Retrying in 3s...');
        setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
}

// === UPDATE FUNCTIONS ===
function updateKPIs(stats) {
    animateValue(kpiTotalEl, stats.total);
    animateValue(kpiApprovedEl, stats.approved);
    animateValue(kpiFlaggedEl, stats.flagged);
    animateValue(kpiBlockedEl, stats.blocked);

    // Fraud Rate
    const fraudRate = stats.total > 0
        ? ((stats.flagged + stats.blocked) / stats.total * 100).toFixed(1)
        : '0.0';
    kpiFraudRateEl.textContent = fraudRate + '%';

    // Update fraud doughnut chart
    fraudChart.data.datasets[0].data = [stats.approved, stats.flagged, stats.blocked];
    fraudChart.update('none');

}

function updateMetrics(metrics) {
    const SESSION_CAP = 5.0;
    const burn = metrics.budget_spend_usd.toFixed(4);
    const pct = (metrics.budget_spend_usd / SESSION_CAP) * 100;

    hourlyBurnEl.textContent = `$${burn}`;
    budgetPctEl.textContent = `${pct.toFixed(1)}% of $${SESSION_CAP}`;
    budgetProgressEl.style.width = `${Math.min(100, pct)}%`;

    // KPI cost card
    kpiCostEl.textContent = `$${metrics.budget_spend_usd.toFixed(3)}`;

    if (pct > 80) {
        budgetProgressEl.className = 'progress-bar progress-bar--red';
        hourlyBurnEl.className = 'health-card__value mono text-red';
    } else {
        budgetProgressEl.className = 'progress-bar progress-bar--emerald';
        hourlyBurnEl.className = 'health-card__value mono text-emerald';
    }

    // Cost Chart
    const now = new Date();
    const timeLabel = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`;
    costChart.data.labels.push(timeLabel);
    costChart.data.datasets[0].data.push(metrics.budget_spend_usd);

    if (costChart.data.labels.length > MAX_COST_POINTS) {
        costChart.data.labels.shift();
        costChart.data.datasets[0].data.shift();
    }
    costChart.update('none');

    // Self Healing - False Positive
    const fp = metrics.false_positive_rate;
    fpRateEl.textContent = `${(fp * 100).toFixed(1)}%`;
    fpProgressEl.style.width = `${Math.min(100, fp * 100)}%`;

    if (fp > 0.15) {
        fpRateEl.className = 'fp-value mono text-red';
        fpProgressEl.className = 'progress-bar progress-bar--red';
        fpProgressEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
        mcpAlertEl.classList.remove('hidden');
    } else {
        fpRateEl.className = 'fp-value mono text-emerald';
        fpProgressEl.className = 'progress-bar progress-bar--blue';
        fpProgressEl.style.boxShadow = 'none';
        mcpAlertEl.classList.add('hidden');
    }

    // Routing Tier
    const tier = metrics.current_routing_tier.toLowerCase();
    routingTierEl.textContent = `${tier.toUpperCase()} TIER`;
    routingTierEl.className = `routing-badge routing-badge--${tier}`;
}

// === ANIMATED VALUE ===
function animateValue(el, newVal) {
    const oldVal = parseInt(el.textContent) || 0;
    if (oldVal === newVal) return;
    el.textContent = newVal;
    el.style.animation = 'none';
    el.offsetHeight; // trigger reflow
    el.style.animation = 'countUp 0.3s ease-out';
}

// === RISK SCORE HELPERS ===
function getRiskClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function getRiskLabel(score) {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MED';
    return 'LOW';
}

function getDecisionIcon(decision) {
    switch (decision.toUpperCase()) {
        case 'APPROVE': return icon('checkCircle');
        case 'BLOCK': return icon('xCircle');
        case 'FLAG': return icon('alertTriangle');
        default: return '';
    }
}

// === RENDER FEED ===
function renderFeed() {
    feedContainer.innerHTML = '';

    messages.forEach((msg) => {
        const card = document.createElement('div');
        const decision = msg.result.decision.toLowerCase();
        const riskScore = msg.result.risk_score || 0;
        const riskClass = getRiskClass(riskScore);

        card.className = `tx-card tx-card--${decision}`;
        card.onclick = () => renderDetails(msg);

        let reasonHtml = '';
        if (decision !== 'approve') {
            reasonHtml = `
                <div class="tx-card__reason">
                    ${icon('alertTriangle')}
                    <span><strong>AI Trigger:</strong> ${msg.result.fraud_category || 'Suspicious Activity'}</span>
                </div>`;
        }

        card.innerHTML = `
            <div class="tx-card__top">
                <span class="tx-card__id">${msg.transaction.transaction_id}</span>
                <span class="badge badge--${decision}">${getDecisionIcon(decision)} ${msg.result.decision}</span>
            </div>
            <div class="tx-card__middle">
                <div class="tx-card__left">
                    <span class="tx-card__name">${msg.transaction.customer_id}</span>
                    <span class="tx-card__meta">${msg.transaction.location || 'Unknown'} &middot; ${msg.transaction.merchant_name || 'Unknown'}</span>
                </div>
                <div class="tx-card__right">
                    <span class="tx-card__amount">$${msg.transaction.amount.toFixed(2)}</span>
                    <div class="risk-score">
                        <div class="risk-score__value risk-score__value--${riskClass}">${riskScore}</div>
                        <span class="risk-score__label">${getRiskLabel(riskScore)}</span>
                    </div>
                </div>
            </div>
            ${reasonHtml}
        `;

        feedContainer.appendChild(card);
    });
}

// === RENDER DETAIL PANEL ===
function renderDetails(msg) {
    const riskScore = msg.result.risk_score || 0;
    const isHighRisk = riskScore > 70;
    const riskClass = getRiskClass(riskScore);
    const tierLabel = msg.result.routing_tier || 'standard';
    // Use real model name returned by the backend agent, not a hardcoded string
    const model = msg.result.model_used || (tierLabel === 'economy' ? 'gemini-2.5-flash' : 'gemini-2.5-flash');
    const confidence = msg.result.confidence || 0;
    const decision = msg.result.decision.toUpperCase();

    // Build SHAP-style reasoning bars from explanation + fraud_category
    const reasoningChain = msg.result.reasoning_chain || [];
    const explanation = msg.result.explanation || 'No detailed explanation available.';
    const fraudCategory = msg.result.fraud_category || 'none';
    const recommendedActions = msg.result.recommended_actions || [];

    // Generate SHAP-style feature impact bars (simulated from available data)
    const shapFeatures = generateSHAPFeatures(msg);

    detailContainer.innerHTML = `
        <!-- Risk Score Hero -->
        <div class="detail-section" style="text-align: center; padding: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.75rem;">
                <div class="risk-score__value risk-score__value--${riskClass}" style="width: 56px; height: 56px; font-size: 1.25rem;">
                    ${riskScore}
                </div>
                <div style="text-align: left;">
                    <div style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Risk Assessment</div>
                    <div style="font-size: 1rem; font-weight: 800; color: ${isHighRisk ? 'var(--color-red)' : riskScore > 40 ? 'var(--color-amber)' : 'var(--color-emerald)'};">
                        ${decision}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted);">Confidence: ${(confidence * 100).toFixed(0)}%</div>
                </div>
            </div>
            <div class="badge badge--${decision.toLowerCase()}" style="font-size: 0.6rem;">
                ${getDecisionIcon(decision.toLowerCase())} ${fraudCategory.replace(/_/g, ' ').toUpperCase()}
            </div>
        </div>

        <!-- Transaction Subject -->
        <div class="detail-section">
            <div class="detail-section__title">${icon('user')} Target Subject</div>
            <div class="info-grid">
                <div class="info-grid__item">
                    <div class="info-grid__label">Customer ID</div>
                    <div class="info-grid__value">${msg.transaction.customer_id}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Location</div>
                    <div class="info-grid__value">${msg.transaction.location || 'Unknown'}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Amount</div>
                    <div class="info-grid__value">$${msg.transaction.amount.toFixed(2)}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Merchant Name</div>
                    <div class="info-grid__value" style="font-weight: 600;">${msg.transaction.merchant_name}</div>
                </div>
            </div>
            
            <div class="info-grid" style="margin-top: 0.5rem;">
                <div class="info-grid__item">
                    <div class="info-grid__label">Method</div>
                    <div class="info-grid__value">${msg.transaction.transaction_method || 'Card Payment'}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Card Network</div>
                    <div class="info-grid__value">${msg.transaction.card_network}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Channel</div>
                    <div class="info-grid__value">${msg.transaction.channel}</div>
                </div>
                <div class="info-grid__item">
                    <div class="info-grid__label">Device & IP</div>
                    <div class="info-grid__value" style="font-size: 0.65rem; word-break: break-all;">${msg.transaction.device_fingerprint}</div>
                </div>
            </div>
        </div>

        <!-- AI Reasoning Chain -->
        <div class="detail-section">
            <div class="detail-section__title">${icon('brain')} AI Reasoning Chain</div>
            <p class="reasoning-text">${explanation}</p>
            ${reasoningChain.length > 0 ? `
                <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    ${reasoningChain.map((step, i) => `
                        <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); padding: 4px 0;">
                            <span style="color: var(--color-blue); font-weight: 700; font-family: var(--font-mono); min-width: 18px;">${i + 1}.</span>
                            <span>${step}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>

        <!-- Feature Impact Analysis -->
        <div class="detail-section">
            <div class="detail-section__title">${icon('barChart')} Feature Impact Analysis</div>
            <div class="shap-bar-container">
                ${shapFeatures.map(f => `
                    <div class="shap-bar">
                        <span class="shap-bar__label">${f.feature}</span>
                        <div class="shap-bar__track">
                            <div class="shap-bar__fill shap-bar__fill--${f.direction}" style="width: ${f.barWidth}%;"></div>
                        </div>
                        <span class="shap-bar__impact" style="color: ${f.direction === 'fraud' ? 'var(--color-red)' : 'var(--color-emerald)'};">
                            ${f.direction === 'fraud' ? '+' : '-'}${f.impact.toFixed(2)}
                        </span>
                    </div>
                `).join('')}
            </div>
            <p style="font-size: 0.6rem; color: var(--text-dim); margin-top: 0.5rem; font-style: italic;">
                Red bars push toward FRAUD, green bars push toward LEGITIMATE
            </p>
        </div>

        <!-- Telemetry Evidence -->
        <div class="detail-section">
            <div class="detail-section__title">${icon('cpu')} Telemetry Evidence</div>
            <div class="evidence-list">
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Model</span>
                    <span class="evidence-item__value">${model}</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Cost Tier</span>
                    <span class="evidence-item__value">${tierLabel.toUpperCase()}</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet ${isHighRisk ? 'evidence-item__bullet--positive' : 'evidence-item__bullet--negative'}"></span>
                    <span class="evidence-item__label">Risk Score</span>
                    <span class="evidence-item__value" style="color: ${isHighRisk ? 'var(--color-red)' : 'var(--color-emerald)'};">${riskScore}/100</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Confidence</span>
                    <span class="evidence-item__value">${(confidence * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>

        <!-- Recommended Actions -->
        ${recommendedActions.length > 0 ? `
        <div class="detail-section">
            <div class="detail-section__title">${icon('zap')} Recommended Actions</div>
            <div class="actions-list">
                ${recommendedActions.map(a => `
                    <span class="action-tag">${icon('arrowRight')} ${a}</span>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
}

// === GENERATE FEATURE WEIGHTS ===
// Uses LLM-provided feature_weights if available, otherwise simulates impacts for backward compatibility
function generateSHAPFeatures(msg) {
    if (msg.result && msg.result.feature_weights && msg.result.feature_weights.length > 0) {
        return msg.result.feature_weights.map(f => ({
            feature: f.feature,
            impact: f.impact,
            direction: f.direction,
            barWidth: Math.min(100, f.impact * 200)
        })).sort((a, b) => b.impact - a.impact).slice(0, 5);
    }

    const tx = msg.transaction;
    const result = msg.result;
    const riskScore = result.risk_score || 0;
    const features = [];

    // Amount-based impact
    const amountImpact = tx.amount > 5000 ? 0.45 : tx.amount > 1000 ? 0.2 : 0.05;
    features.push({
        feature: 'txn_amount',
        impact: amountImpact,
        direction: tx.amount > 1000 ? 'fraud' : 'legit',
        barWidth: Math.min(100, amountImpact * 200)
    });

    // Velocity / Category-based
    const categoryRisk = ['electronics', 'jewelry', 'crypto'].includes(tx.merchant_name?.toLowerCase())
        ? 0.35 : 0.08;
    features.push({
        feature: 'merchant_cat',
        impact: categoryRisk,
        direction: categoryRisk > 0.2 ? 'fraud' : 'legit',
        barWidth: Math.min(100, categoryRisk * 200)
    });

    // Geo-based
    const geoImpact = result.fraud_category === 'card_not_present_geo' ? 0.55
        : result.fraud_category === 'velocity_testing' ? 0.4
        : 0.06;
    features.push({
        feature: result.fraud_category === 'card_not_present_geo' ? 'geo_anomaly' : 'velocity_sig',
        impact: geoImpact,
        direction: geoImpact > 0.15 ? 'fraud' : 'legit',
        barWidth: Math.min(100, geoImpact * 180)
    });

    // Time-of-day
    const hour = new Date().getHours();
    const timeImpact = (hour >= 1 && hour <= 5) ? 0.22 : 0.04;
    features.push({
        feature: 'hour_of_day',
        impact: timeImpact,
        direction: timeImpact > 0.1 ? 'fraud' : 'legit',
        barWidth: Math.min(100, timeImpact * 200)
    });

    // Risk score overall confidence
    const confidenceImpact = riskScore > 60 ? 0.3 : 0.1;
    features.push({
        feature: 'risk_conf',
        impact: confidenceImpact,
        direction: riskScore > 60 ? 'fraud' : 'legit',
        barWidth: Math.min(100, confidenceImpact * 200)
    });

    // Sort by absolute impact descending
    features.sort((a, b) => b.impact - a.impact);

    return features.slice(0, 5);
}

async function fetchInitialData() {
    try {
        const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
        
        // Fetch health
        fetch(`${baseUrl}/health`).then(res => res.json()).then(health => {
            console.log("Health Check:", health);
        }).catch(err => console.error("Health fetch failed", err));

        // Fetch stats
        const statsRes = await fetch(`${baseUrl}/api/stats`);
        if (statsRes.ok) {
            const stats = await statsRes.json();
            updateKPIs(stats);
            updateMetrics(stats);
        }

        // Fetch initial transactions
        const txRes = await fetch(`${baseUrl}/api/transactions`);
        if (txRes.ok) {
            const txs = await txRes.json();
            messages = txs.slice(-MAX_FEED_ITEMS).reverse(); // latest first
            renderFeed();
            if (messages.length > 0) {
                renderDetails(messages[0]);
            }
        }
    } catch (e) {
        console.error("Failed to fetch initial data:", e);
    }
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    // Start WS and data fetch in parallel — don't block one on the other
    connect();
    fetchInitialData();
});
