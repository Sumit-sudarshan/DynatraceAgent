/* ============================================================
   FinSentinel — Observability Page (LIVE DATA)
   Fetches from /api/observability every 30s — real in-memory
   metrics + live Dynatrace Problems API.
   ============================================================ */

const BASE_URL = window.location.origin;
let latencyChart, costChart;
let lastData = null;

document.addEventListener('DOMContentLoaded', () => {
    // Sidebar collapse
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');

    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar?.classList.add('collapsed');
        mainContent?.classList.add('expanded');
    }
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        window.dispatchEvent(new Event('resize'));
    });

    // Initial load
    loadObservabilityData();

    // Refresh every 30 seconds
    setInterval(loadObservabilityData, 30000);
});

/* --- MAIN DATA FETCHER --- */
async function loadObservabilityData() {
    try {
        const resp = await fetch(`${BASE_URL}/api/observability`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        lastData = data;
        renderPage(data);
    } catch (err) {
        console.error('Failed to load observability data:', err);
        appendLog('error', `[SYSTEM] Failed to fetch observability data: ${err.message}`);
    }
}

/* --- RENDER ALL METRICS --- */
function renderPage(data) {
    // KPI Cards
    setEl('kpi-latency', `${data.pipeline_latency_avg_ms.toLocaleString()}ms`);
    setEl('kpi-burn-rate', `$${data.budget_spend_usd.toFixed(4)}`);
    setEl('kpi-healing-actions', data.self_healing_actions);
    setEl('kpi-uptime', `${data.dynatrace_uptime_pct.toFixed(2)}%`);
    setEl('kpi-latency-sub', `P95: ${data.pipeline_latency_p95_ms}ms across 3 Gemini agents`);
    setEl('kpi-burn-sub', `Budget utilization: ${data.budget_utilization_pct}% (tier: ${data.routing_tier})`);
    setEl('kpi-healing-sub', `False positive rate: ${data.false_positive_rate}%`);

    // Dynatrace connection badge
    const badge = document.getElementById('dt-status-badge');
    if (badge) {
        badge.textContent = data.dynatrace_connected ? '● Dynatrace Connected' : '● Dynatrace Offline';
        badge.style.color = data.dynatrace_connected ? '#34d399' : '#f87171';
    }

    // Dynatrace problems
    renderProblems(data.dynatrace_problems);

    // Charts
    renderLatencyChart(data.latency_history, data.pipeline_latency_avg_ms, data.pipeline_latency_p95_ms);
    renderCostChart(data.budget_spend_usd, data.total_transactions);

    // Log a real event
    appendLog('info', `[LIVE] Latency avg=${data.pipeline_latency_avg_ms}ms | Spend=$${data.budget_spend_usd.toFixed(4)} | Tier=${data.routing_tier} | DT Problems=${data.dynatrace_problem_count}`);
    if (data.dynatrace_connected) {
        appendLog('success', `[DT] Connected to Dynatrace. Open problems: ${data.dynatrace_problem_count}`);
    }
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* --- DYNATRACE PROBLEMS LIST --- */
function renderProblems(problems) {
    const container = document.getElementById('dt-problems-list');
    if (!container) return;

    if (!problems || problems.length === 0) {
        container.innerHTML = `<div class="log-line log-line--success" style="padding:8px 0">
            <span style="color:#34d399">✅ No open Dynatrace problems detected.</span>
        </div>`;
        return;
    }

    container.innerHTML = problems.map(p => {
        const color = p.severity === 'AVAILABILITY' ? '#f87171' :
                      p.severity === 'ERROR' ? '#fb923c' : '#facc15';
        return `<div class="log-line" style="padding:6px 0; border-bottom: 1px solid rgba(255,255,255,0.05)">
            <span style="color:${color}; font-weight:600">[${p.severity}]</span>
            <span style="color:#e5e7eb; margin-left:8px">${p.title}</span>
        </div>`;
    }).join('');
}

/* --- LATENCY CHART (REAL DATA) --- */
function renderLatencyChart(history, avg, p95) {
    const ctx = document.getElementById('chart-latency');
    if (!ctx) return;

    // history = array of the last N transaction latencies in ms
    const dataPoints = history.length > 0 ? history : Array(10).fill(avg);
    const labels = dataPoints.map((_, i) => `-${dataPoints.length - i}tx`);

    // Build P95-style overlay: mark the highest 5% as P95
    const sorted = [...dataPoints].sort((a, b) => a - b);
    const p95Val = sorted[Math.floor(sorted.length * 0.95)] || p95;
    const p95Line = Array(dataPoints.length).fill(p95Val);

    if (latencyChart) {
        latencyChart.data.labels = labels;
        latencyChart.data.datasets[0].data = dataPoints;
        latencyChart.data.datasets[1].data = p95Line;
        latencyChart.update('none');
        return;
    }

    latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Transaction Latency (ms)',
                    data: dataPoints,
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.08)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    fill: true
                },
                {
                    label: 'P95 Threshold',
                    data: p95Line,
                    borderColor: '#3b82f6',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#9ca3af',
                    bodyColor: '#f9fafb',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)}ms`
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', maxTicksLimit: 6 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', callback: v => v + 'ms' }, min: 0 }
            }
        }
    });
}

/* --- COST CHART (REAL RUNNING TOTAL) --- */
function renderCostChart(totalSpend, totalTxns) {
    const ctx = document.getElementById('chart-cost');
    if (!ctx) return;

    // Reconstruct approximate hourly cost from total spend
    // We show a stepped real line up to the current hour
    const now = new Date();
    const currentHour = now.getHours();
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    // Distribute spend across hours proportionally (rough but real total)
    const costPerHour = totalTxns > 0 ? totalSpend / Math.max(currentHour + 1, 1) : 0;
    let cumulative = 0;
    const costData = labels.map((_, i) => {
        if (i > currentHour) return null;
        cumulative += costPerHour;
        return parseFloat(cumulative.toFixed(4));
    });

    if (costChart) {
        costChart.data.datasets[0].data = costData;
        costChart.update('none');
        return;
    }

    costChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Cumulative API Spend',
                data: costData,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.08)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: true,
                stepped: true,
                spanGaps: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ctx.raw !== null ? ` $${ctx.raw.toFixed(4)}` : ' No data yet' }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#6b7280', maxTicksLimit: 8 } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', callback: v => '$' + v }, min: 0 }
            }
        }
    });
}

/* --- LOG STREAM (real events + live data logs) --- */
function appendLog(type, msg) {
    const terminal = document.getElementById('log-terminal');
    if (!terminal) return;

    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}]`;

    const div = document.createElement('div');
    div.className = `log-line log-line--${type}`;
    div.innerHTML = `<span class="log-time">${timeStr}</span> ${msg}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;

    if (terminal.children.length > 120) terminal.removeChild(terminal.firstChild);
}

function clearLogs() {
    const terminal = document.getElementById('log-terminal');
    if (terminal) {
        terminal.innerHTML = '';
        appendLog('info', '[SYSTEM] Logs cleared by user.');
    }
}
