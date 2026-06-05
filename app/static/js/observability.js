/* ============================================================
   FinSentinel — Observability Page Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            window.dispatchEvent(new Event('resize'));
        });
    }

    // 2. Initialize Charts
    initLatencyChart();
    initCostChart();

    // 3. Start Mock Log Stream
    startLogStream();
});

/* --- CHARTS --- */
let latencyChart, costChart;

function initLatencyChart() {
    const ctx = document.getElementById('chart-latency');
    if (!ctx) return;

    // Generate 30 data points (last 30 mins)
    const labels = Array.from({length: 30}, (_, i) => `-${30-i}m`);
    const dataP50 = Array.from({length: 30}, () => 800 + Math.random() * 200);
    const dataP95 = Array.from({length: 30}, (_, i) => {
        // Add a spike
        if (i > 20 && i < 25) return 2500 + Math.random() * 500;
        return 1200 + Math.random() * 300;
    });

    latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'P95 Latency',
                    data: dataP95,
                    borderColor: '#3b82f6', // blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true
                },
                {
                    label: 'P50 Latency',
                    data: dataP50,
                    borderColor: '#34d399', // emerald
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#9ca3af',
                    bodyColor: '#f9fafb',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#6b7280', maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#6b7280', callback: value => value + 'ms' },
                    min: 0
                }
            }
        }
    });
}

function initCostChart() {
    const ctx = document.getElementById('chart-cost');
    if (!ctx) return;

    // Generate cumulative cost over 24h
    const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
    let currentCost = 0;
    const costData = Array.from({length: 24}, () => {
        currentCost += (0.1 + Math.random() * 0.3);
        return currentCost;
    });

    costChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Spend',
                data: costData,
                borderColor: '#a855f7', // purple
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5,
                fill: true,
                stepped: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ' $' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b7280', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#6b7280', callback: value => '$' + value },
                    min: 0
                }
            }
        }
    });
}

/* --- LOG STREAM --- */
const logTemplates = [
    { type: 'info', msg: '[MCP] Polling Dynatrace problems API. Status: 0 open.' },
    { type: 'info', msg: '[AGENT] Gemini request completed. Latency: 842ms. Prompt tokens: 420.' },
    { type: 'info', msg: '[SYSTEM] Processed batch of 10 transactions. Cache hit rate: 24%.' },
    { type: 'warn', msg: '[BUDGET] Adaptive router warning. Tier 1 capacity at 85%.' },
    { type: 'info', msg: '[AGENT] PatternDetector analysis: Nominal variance.' },
    { type: 'error', msg: '[MCP] API rate limit approaching for environment dt0c01.' },
    { type: 'action', msg: '[ACTION] Budget throttler engaged. Switching to Gemini-1.5-Flash.' },
    { type: 'success', msg: '[SYSTEM] Cache flushed successfully.' }
];

function startLogStream() {
    const terminal = document.getElementById('log-terminal');
    if (!terminal) return;

    setInterval(() => {
        if (Math.random() > 0.6) {
            const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
            appendLog(terminal, template.type, template.msg);
        }
    }, 2000);
}

function appendLog(terminal, type, msg) {
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    
    const div = document.createElement('div');
    div.className = `log-line log-line--${type}`;
    div.innerHTML = `<span class="log-time">${timeStr}</span> ${msg}`;
    
    terminal.appendChild(div);
    
    // Auto-scroll
    terminal.scrollTop = terminal.scrollHeight;

    // Keep max 100 lines
    if (terminal.children.length > 100) {
        terminal.removeChild(terminal.firstChild);
    }
}

function clearLogs() {
    const terminal = document.getElementById('log-terminal');
    if (terminal) {
        terminal.innerHTML = '';
        appendLog(terminal, 'info', '[SYSTEM] Logs cleared by user.');
    }
}
