/* ============================================================
   FinSentinel — Transaction Explorer JavaScript
   Fetches transactions via REST API and WebSocket,
   provides advanced filtering, sorting, and forensic detail.
   ============================================================ */

// === STATE ===
let allTransactions = [];
let filteredTransactions = [];
let selectedTxn = null;
let currentPage = 1;
const PAGE_SIZE = 20;

let sortColumn = 'timestamp';
let sortDirection = 'desc';

// === DOM ===
const tableBody = document.getElementById('tx-table-body');
const forensicBody = document.getElementById('forensic-body');
const resultsCount = document.getElementById('results-count');
const paginationContainer = document.getElementById('pagination-container');

// Filters
const filterSearch = document.getElementById('filter-search');
const filterDecision = document.getElementById('filter-decision');
const filterCategory = document.getElementById('filter-category');
const filterLocation = document.getElementById('filter-location');
const filterRiskRange = document.getElementById('filter-risk-range');
const filterRiskValue = document.getElementById('filter-risk-value');
const btnApplyFilters = document.getElementById('btn-apply-filters');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Connection
const connectionIndicator = document.getElementById('connection-indicator');

// === SIDEBAR TOGGLE ===
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// === RISK RANGE SLIDER ===
if (filterRiskRange) {
    filterRiskRange.addEventListener('input', () => {
        filterRiskValue.textContent = filterRiskRange.value;
        const val = parseInt(filterRiskRange.value);
        if (val >= 70) filterRiskValue.style.color = 'var(--color-red)';
        else if (val >= 40) filterRiskValue.style.color = 'var(--color-amber)';
        else filterRiskValue.style.color = 'var(--color-emerald)';
    });
}

// === FILTER EVENTS ===
if (btnApplyFilters) {
    btnApplyFilters.addEventListener('click', applyFilters);
}
if (btnClearFilters) {
    btnClearFilters.addEventListener('click', clearFilters);
}

// Quick filter on Enter in search box
if (filterSearch) {
    filterSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
}

// === FETCH INITIAL DATA ===
async function fetchTransactions() {
    try {
        const baseUrl = window.location.protocol === 'file:'
            ? 'http://localhost:8000'
            : window.location.origin;

        const res = await fetch(`${baseUrl}/api/transactions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        allTransactions = data.map(item => ({
            ...item,
            // Flatten for easier access
            txId: item.transaction?.transaction_id || '',
            customerId: item.transaction?.customer_id || '',
            amount: item.transaction?.amount || 0,
            location: item.transaction?.location || '',
            merchantName: item.transaction?.merchant_name || '',
            timestamp: item.transaction?.timestamp || Date.now() / 1000,
            decision: item.result?.decision || 'APPROVE',
            riskScore: item.result?.risk_score || 0,
            confidence: item.result?.confidence || 0,
            explanation: item.result?.explanation || '',
            fraudCategory: item.result?.fraud_category || 'none',
            reasoningChain: item.result?.reasoning_chain || [],
            recommendedActions: item.result?.recommended_actions || [],
            routingTier: item.result?.routing_tier || 'standard',
        }));

        applyFilters();
    } catch (err) {
        console.error('Failed to fetch transactions:', err);
        // Show empty state
        renderTable([]);
    }
}

// === WEBSOCKET for live updates ===
function connectWS() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/transactions`;
    const url = window.location.protocol === 'file:' ? 'ws://localhost:8000/ws/transactions' : wsUrl;

    const ws = new WebSocket(url);

    ws.onopen = () => {
        connectionIndicator.classList.remove('indicator-dot--disconnected');
        connectionIndicator.classList.add('indicator-dot--connected');
        document.getElementById('connection-label').textContent = 'MCP Online';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.transaction && data.result) {
                const flat = {
                    transaction: data.transaction,
                    result: data.result,
                    txId: data.transaction.transaction_id,
                    customerId: data.transaction.customer_id,
                    amount: data.transaction.amount,
                    location: data.transaction.location,
                    merchantName: data.transaction.merchant_name,
                    timestamp: data.transaction.timestamp,
                    decision: data.result.decision,
                    riskScore: data.result.risk_score || 0,
                    confidence: data.result.confidence || 0,
                    explanation: data.result.explanation || '',
                    fraudCategory: data.result.fraud_category || 'none',
                    reasoningChain: data.result.reasoning_chain || [],
                    recommendedActions: data.result.recommended_actions || [],
                    routingTier: data.result.routing_tier || 'standard',
                };
                allTransactions.unshift(flat);
                if (allTransactions.length > 200) allTransactions.pop();
                applyFilters();
            }
        } catch (e) {
            console.error('WS parse error:', e);
        }
    };

    ws.onclose = () => {
        connectionIndicator.classList.remove('indicator-dot--connected');
        connectionIndicator.classList.add('indicator-dot--disconnected');
        document.getElementById('connection-label').textContent = 'MCP Offline';
        setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();
}

// === FILTERS ===
function applyFilters() {
    const searchTerm = (filterSearch?.value || '').toLowerCase().trim();
    const decisionFilter = filterDecision?.value || 'all';
    const categoryFilter = filterCategory?.value || 'all';
    const locationFilter = filterLocation?.value || 'all';
    const riskMin = parseInt(filterRiskRange?.value || 0);

    filteredTransactions = allTransactions.filter(tx => {
        // Search (ID, customer, location)
        if (searchTerm) {
            const haystack = `${tx.txId} ${tx.customerId} ${tx.location} ${tx.merchantName}`.toLowerCase();
            if (!haystack.includes(searchTerm)) return false;
        }
        // Decision
        if (decisionFilter !== 'all' && tx.decision.toUpperCase() !== decisionFilter.toUpperCase()) return false;
        // Category
        if (categoryFilter !== 'all' && tx.merchantName !== categoryFilter) return false;
        // Location
        if (locationFilter !== 'all' && tx.location !== locationFilter) return false;
        // Risk score
        if (tx.riskScore < riskMin) return false;

        return true;
    });

    // Sort
    sortTransactions();

    currentPage = 1;
    renderTable(filteredTransactions);
    renderPagination();
}

function clearFilters() {
    if (filterSearch) filterSearch.value = '';
    if (filterDecision) filterDecision.value = 'all';
    if (filterCategory) filterCategory.value = 'all';
    if (filterLocation) filterLocation.value = 'all';
    if (filterRiskRange) {
        filterRiskRange.value = 0;
        filterRiskValue.textContent = '0';
        filterRiskValue.style.color = 'var(--color-emerald)';
    }
    applyFilters();
}

// === SORTING ===
function sortTransactions() {
    filteredTransactions.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = (bVal || '').toLowerCase();
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

function handleSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'desc';
    }

    // Update header classes
    document.querySelectorAll('.tx-table th').forEach(th => {
        th.classList.remove('sorted');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.innerHTML = sortArrowSvg('none');
    });
    const activeHeader = document.querySelector(`.tx-table th[data-col="${column}"]`);
    if (activeHeader) {
        activeHeader.classList.add('sorted');
        const icon = activeHeader.querySelector('.sort-icon');
        if (icon) icon.innerHTML = sortArrowSvg(sortDirection);
    }

    sortTransactions();
    renderTable(filteredTransactions);
}

function sortArrowSvg(dir) {
    if (dir === 'asc') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`;
    if (dir === 'desc') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`;
}

// === RENDER TABLE ===
function renderTable(txns) {
    if (!tableBody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageTxns = txns.slice(start, end);

    if (resultsCount) {
        resultsCount.innerHTML = `<strong>${txns.length}</strong> transactions found`;
    }

    if (pageTxns.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-dim);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                        ${icon('search')}
                        <span>No transactions match your filters</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = pageTxns.map((tx, i) => {
        const riskClass = getRiskClass(tx.riskScore);
        const decision = tx.decision.toUpperCase();
        const decisionClass = decision === 'APPROVE' ? 'approve' : decision === 'FLAG' ? 'flag' : 'block';
        const isSelected = selectedTxn && selectedTxn.txId === tx.txId;
        const time = new Date(tx.timestamp * 1000);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return `
            <tr class="${isSelected ? 'selected' : ''}" onclick="selectTransaction(${start + i})">
                <td><span class="tx-table__id">${tx.txId}</span></td>
                <td><span class="tx-table__customer">${tx.customerId}</span></td>
                <td><span class="tx-table__amount">$${tx.amount.toFixed(2)}</span></td>
                <td><span class="tx-table__location">${tx.location}</span></td>
                <td><span class="tx-table__category">${tx.merchantName}</span></td>
                <td>
                    <div class="tx-table__risk">
                        <div class="risk-chip risk-chip--${riskClass}">${tx.riskScore}</div>
                    </div>
                </td>
                <td><span class="badge badge--${decisionClass}">${decision}</span></td>
            </tr>`;
    }).join('');
}

// === PAGINATION ===
function renderPagination() {
    if (!paginationContainer) return;

    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

    let html = `
        <button class="results-bar__page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled style="opacity:0.3;pointer-events:none;"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>`;

    for (let p = 1; p <= Math.min(totalPages, 5); p++) {
        html += `<button class="results-bar__page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
    if (totalPages > 5) {
        html += `<span style="color: var(--text-dim); font-size: 0.7rem;">...</span>`;
        html += `<button class="results-bar__page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
        <button class="results-bar__page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled style="opacity:0.3;pointer-events:none;"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>`;

    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable(filteredTransactions);
    renderPagination();
}

// === SELECT TRANSACTION ===
function selectTransaction(index) {
    selectedTxn = filteredTransactions[index];
    renderTable(filteredTransactions);
    renderForensicDetail(selectedTxn);
}

// === RENDER FORENSIC DETAIL ===
function renderForensicDetail(tx) {
    if (!forensicBody || !tx) return;

    const riskClass = getRiskClass(tx.riskScore);
    const decision = tx.decision.toUpperCase();
    const decisionClass = decision === 'APPROVE' ? 'approve' : decision === 'FLAG' ? 'flag' : 'block';
    const tierLabel = tx.routingTier || 'standard';
    const model = tx.modelUsed || 'gemini-2.5-flash';
    const time = new Date(tx.timestamp * 1000);

    // Generate device info (simulated since backend doesn't provide hardware-level info)
    const deviceInfo = generateDeviceInfo(tx);
    const ipAddress = generateIP(tx.customerId);
    const customerHistory = generateCustomerHistory(tx);
    const shapFeatures = generateSHAPFeatures(tx);

    forensicBody.innerHTML = `
        <!-- Hero -->
        <div class="forensic-hero">
            <div class="forensic-hero__score forensic-hero__score--${riskClass}">${tx.riskScore}</div>
            <div class="forensic-hero__info">
                <span class="forensic-hero__txn-id">${tx.txId} &middot; ${time.toLocaleString()}</span>
                <span class="forensic-hero__customer">${tx.customerId}</span>
                <div class="forensic-hero__decision">
                    <span class="badge badge--${decisionClass}">${decision}</span>
                    <span class="forensic-hero__amount">$${tx.amount.toFixed(2)}</span>
                    <span class="tx-table__category">${tx.merchantName}</span>
                </div>
            </div>
            <div class="forensic-hero__actions">
                <button class="forensic-hero__action-btn forensic-hero__action-btn--approve">
                    ${icon('checkCircle')} Force Approve
                </button>
                <button class="forensic-hero__action-btn forensic-hero__action-btn--block">
                    ${icon('xCircle')} Force Block
                </button>
                <button class="forensic-hero__action-btn forensic-hero__action-btn--escalate">
                    ${icon('flag')} Escalate
                </button>
            </div>
        </div>

        <!-- Tabs -->
        <div class="forensic-tabs">
            <div class="forensic-tab active" onclick="switchTab(this, 'overview')">Overview</div>
            <div class="forensic-tab" onclick="switchTab(this, 'reasoning')">AI Reasoning</div>
            <div class="forensic-tab" onclick="switchTab(this, 'history')">Customer History</div>
        </div>

        <!-- TAB: Overview -->
        <div id="tab-overview" class="forensic-tab-content">
            <!-- Device Forensics -->
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('cpu')} Device Forensics</div>
                <div class="device-grid">
                    <div class="device-grid__item">
                        <span class="device-grid__label">Device</span>
                        <span class="device-grid__value">${deviceInfo.device}</span>
                    </div>
                    <div class="device-grid__item">
                        <span class="device-grid__label">OS Version</span>
                        <span class="device-grid__value">${deviceInfo.os}</span>
                    </div>
                    <div class="device-grid__item">
                        <span class="device-grid__label">Browser</span>
                        <span class="device-grid__value">${deviceInfo.browser}</span>
                    </div>
                    <div class="device-grid__item">
                        <span class="device-grid__label">IP Address</span>
                        <span class="device-grid__value">${ipAddress}</span>
                    </div>
                    <div class="device-grid__item">
                        <span class="device-grid__label">Location</span>
                        <span class="device-grid__value">${tx.location}</span>
                    </div>
                    <div class="device-grid__item">
                        <span class="device-grid__label">Merchant ID</span>
                        <span class="device-grid__value">${tx.transaction?.merchant_id || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!-- Geolocation -->
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('crosshair')} Geolocation</div>
                <div class="geo-map">
                    <div class="geo-map__pin" style="top: ${30 + Math.random() * 40}%; left: ${20 + Math.random() * 60}%;"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" opacity="0.15"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span class="geo-map__label">${tx.location} &middot; ${ipAddress}</span>
                </div>
            </div>

            <!-- Telemetry -->
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('server')} Telemetry Evidence</div>
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
                        <span class="evidence-item__bullet ${tx.riskScore > 70 ? 'evidence-item__bullet--positive' : 'evidence-item__bullet--negative'}"></span>
                        <span class="evidence-item__label">Risk Score</span>
                        <span class="evidence-item__value" style="color: ${tx.riskScore > 70 ? 'var(--color-red)' : tx.riskScore > 40 ? 'var(--color-amber)' : 'var(--color-emerald)'};">${tx.riskScore}/100</span>
                    </div>
                    <div class="evidence-item">
                        <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                        <span class="evidence-item__label">Confidence</span>
                        <span class="evidence-item__value">${(tx.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div class="evidence-item">
                        <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                        <span class="evidence-item__label">Category</span>
                        <span class="evidence-item__value">${tx.fraudCategory.replace(/_/g, ' ')}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB: AI Reasoning -->
        <div id="tab-reasoning" class="forensic-tab-content hidden">
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('brain')} AI Reasoning Chain</div>
                <p class="reasoning-text">${tx.explanation}</p>
                ${tx.reasoningChain.length > 0 ? `
                    <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
                        ${tx.reasoningChain.map((step, i) => `
                            <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); padding: 4px 0;">
                                <span style="color: var(--color-blue); font-weight: 700; font-family: var(--font-mono); min-width: 18px;">${i + 1}.</span>
                                <span>${step}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="forensic-section">
                <div class="forensic-section__title">${icon('barChart')} Feature Impact Analysis</div>
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

            ${tx.recommendedActions.length > 0 ? `
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('zap')} Recommended Actions</div>
                <div class="actions-list">
                    ${tx.recommendedActions.map(a => `
                        <span class="action-tag">${icon('arrowRight')} ${a}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <!-- TAB: Customer History -->
        <div id="tab-history" class="forensic-tab-content hidden">
            <div class="forensic-section">
                <div class="forensic-section__title">${icon('activity')} Transaction Timeline</div>
                <div class="timeline">
                    ${customerHistory.map((h, i) => `
                        <div class="timeline__item">
                            <div class="timeline__dot ${i === 0 ? 'timeline__dot--current' : `timeline__dot--${h.decision.toLowerCase()}`}"></div>
                            <div class="timeline__body">
                                <div class="timeline__text">
                                    <span class="timeline__label">${h.merchant} ${i === 0 ? '<span style="color: var(--color-blue); font-weight: 700; font-size: 0.6rem;">(CURRENT)</span>' : ''}</span>
                                    <span class="timeline__sub">${h.location} &middot; ${h.category}</span>
                                </div>
                                <span class="timeline__amount">$${h.amount.toFixed(2)}</span>
                                <span class="badge badge--${h.decision.toLowerCase() === 'approve' ? 'approve' : h.decision.toLowerCase() === 'flag' ? 'flag' : 'block'}">${h.decision}</span>
                                <span class="timeline__time">${h.timeAgo}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// === TAB SWITCHING ===
function switchTab(el, tabName) {
    // Update tab buttons
    document.querySelectorAll('.forensic-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    // Show/hide tab content
    document.querySelectorAll('.forensic-tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');
}

// === HELPERS ===
function getRiskClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function generateDeviceInfo(tx) {
    // Deterministic device info based on customer ID hash
    const hash = simpleHash(tx.customerId);
    const devices = [
        { device: 'iPhone 15 Pro', os: 'iOS 18.2', browser: 'Safari 18.2' },
        { device: 'Samsung Galaxy S24', os: 'Android 15', browser: 'Chrome 131' },
        { device: 'Pixel 9 Pro', os: 'Android 15', browser: 'Chrome 131' },
        { device: 'MacBook Pro M3', os: 'macOS 15.1', browser: 'Chrome 131' },
        { device: 'Windows Desktop', os: 'Windows 11', browser: 'Edge 131' },
        { device: 'iPad Air M2', os: 'iPadOS 18.2', browser: 'Safari 18.2' },
    ];
    return devices[hash % devices.length];
}

function generateIP(customerId) {
    const hash = simpleHash(customerId);
    return `${72 + (hash % 180)}.${(hash * 3) % 256}.${(hash * 7) % 256}.${(hash * 13) % 256}`;
}

function generateCustomerHistory(tx) {
    // Current transaction + simulated past transactions
    const categories = ['grocery', 'gas', 'coffee', 'electronics', 'travel', 'restaurant', 'digital_goods'];
    const locations = ['New York', 'Chicago', 'San Francisco', 'Austin', 'Miami', 'Seattle'];
    const decisions = ['APPROVE', 'APPROVE', 'APPROVE', 'APPROVE', 'FLAG', 'APPROVE'];

    const history = [{
        merchant: tx.transaction?.merchant_id || 'Unknown',
        location: tx.location,
        category: tx.merchantName,
        amount: tx.amount,
        decision: tx.decision,
        timeAgo: 'Just now'
    }];

    const hash = simpleHash(tx.customerId);
    for (let i = 1; i <= 7; i++) {
        const idx = (hash + i * 17) % 6;
        history.push({
            merchant: `merch_${100 + ((hash * i) % 900)}`,
            location: locations[(hash + i) % locations.length],
            category: categories[(hash + i * 3) % categories.length],
            amount: parseFloat((5 + ((hash * i * 7) % 300)).toFixed(2)),
            decision: decisions[(hash + i) % decisions.length],
            timeAgo: i === 1 ? '2m ago' : i === 2 ? '15m ago' : i === 3 ? '1h ago' : i === 4 ? '3h ago' : i === 5 ? '1d ago' : i === 6 ? '2d ago' : '5d ago'
        });
    }

    return history;
}

// === GENERATE FEATURE WEIGHTS ===
function generateSHAPFeatures(tx) {
    if (tx.result && tx.result.feature_weights && tx.result.feature_weights.length > 0) {
        return tx.result.feature_weights.map(f => ({
            feature: f.feature,
            impact: f.impact,
            direction: f.direction,
            barWidth: Math.min(100, f.impact * 200)
        })).sort((a, b) => b.impact - a.impact).slice(0, 5);
    }

    const features = [];
    const amountImpact = tx.amount > 5000 ? 0.45 : tx.amount > 1000 ? 0.2 : 0.05;
    features.push({ feature: 'txn_amount', impact: amountImpact, direction: tx.amount > 1000 ? 'fraud' : 'legit', barWidth: Math.min(100, amountImpact * 200) });

    const categoryRisk = ['electronics', 'jewelry', 'crypto', 'digital_goods'].includes(tx.merchantName?.toLowerCase()) ? 0.35 : 0.08;
    features.push({ feature: 'merchant_cat', impact: categoryRisk, direction: categoryRisk > 0.2 ? 'fraud' : 'legit', barWidth: Math.min(100, categoryRisk * 200) });

    const geoImpact = tx.fraudCategory === 'card_not_present_geo' ? 0.55 : tx.fraudCategory === 'velocity_testing' ? 0.4 : 0.06;
    features.push({ feature: tx.fraudCategory === 'card_not_present_geo' ? 'geo_anomaly' : 'velocity_sig', impact: geoImpact, direction: geoImpact > 0.15 ? 'fraud' : 'legit', barWidth: Math.min(100, geoImpact * 180) });

    const hour = new Date().getHours();
    const timeImpact = (hour >= 1 && hour <= 5) ? 0.22 : 0.04;
    features.push({ feature: 'hour_of_day', impact: timeImpact, direction: timeImpact > 0.1 ? 'fraud' : 'legit', barWidth: Math.min(100, timeImpact * 200) });

    const confidenceImpact = tx.riskScore > 60 ? 0.3 : 0.1;
    features.push({ feature: 'risk_conf', impact: confidenceImpact, direction: tx.riskScore > 60 ? 'fraud' : 'legit', barWidth: Math.min(100, confidenceImpact * 200) });

    features.sort((a, b) => b.impact - a.impact);
    return features.slice(0, 5);
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Make sort handler accessible from HTML
window.handleSort = handleSort;
window.selectTransaction = selectTransaction;
window.goToPage = goToPage;
window.switchTab = switchTab;

// === INIT ===
fetchTransactions();
connectWS();
