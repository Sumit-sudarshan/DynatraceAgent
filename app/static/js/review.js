/* ============================================================
   FinSentinel — Manual Review Queue JavaScript
   Fetches flagged transactions, provides analyst workflow
   with approve/block/escalate actions and investigation notes.
   ============================================================ */

// === STATE ===
let queueItems = [];
let selectedItem = null;
let reviewStats = { pending: 0, approved: 0, blocked: 0, escalated: 0 };
let sortMode = 'risk'; // 'risk', 'time', 'amount'
let notesStore = {}; // txId -> [{author, time, text}]

// === DOM ===
const queueBody = document.getElementById('queue-body');
const investigationBody = document.getElementById('investigation-body');
const connectionIndicator = document.getElementById('connection-indicator');

// Stats
const statPending = document.getElementById('stat-pending');
const statApproved = document.getElementById('stat-approved');
const statBlocked = document.getElementById('stat-blocked');
const statEscalated = document.getElementById('stat-escalated');

// Sidebar
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// === FETCH FLAGGED TRANSACTIONS ===
async function fetchQueue() {
    try {
        const baseUrl = window.location.protocol === 'file:'
            ? 'http://localhost:8000'
            : window.location.origin;

        const res = await fetch(`${baseUrl}/api/transactions`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Filter only FLAGGED and high-risk transactions for review
        const flagged = data
            .map(item => flattenTx(item))
            .filter(tx => {
                const d = tx.decision.toUpperCase();
                return d === 'FLAG' || (d === 'BLOCK' && tx.riskScore >= 60 && tx.riskScore < 85);
            });

        queueItems = flagged.map(tx => ({
            ...tx,
            status: 'pending', // pending, approved, blocked, escalated
            priority: getPriority(tx.riskScore),
            analystNotes: [],
            auditTrail: [
                { type: 'system', text: `AI flagged transaction with risk score ${tx.riskScore}/100`, time: formatTimeAgo(tx.timestamp) },
                { type: 'flag', text: `Category: ${tx.fraudCategory.replace(/_/g, ' ')}`, time: formatTimeAgo(tx.timestamp) }
            ]
        }));

        updateStats();
        sortQueue();
        renderQueue();
    } catch (err) {
        console.error('Failed to fetch queue:', err);
        renderQueue();
    }
}

function flattenTx(item) {
    return {
        transaction: item.transaction,
        result: item.result,
        txId: item.transaction?.transaction_id || '',
        customerId: item.transaction?.customer_id || '',
        amount: item.transaction?.amount || 0,
        location: item.transaction?.location || '',
        merchantName: item.transaction?.merchant_name || '',
        timestamp: item.transaction?.timestamp || Date.now() / 1000,
        decision: item.result?.decision || 'FLAG',
        riskScore: item.result?.risk_score || 50,
        confidence: item.result?.confidence || 0,
        explanation: item.result?.explanation || '',
        fraudCategory: item.result?.fraud_category || 'unknown',
        reasoningChain: item.result?.reasoning_chain || [],
        recommendedActions: item.result?.recommended_actions || [],
        routingTier: item.result?.routing_tier || 'standard',
    };
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
        document.getElementById('connection-label').textContent = 'MCP Online';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.transaction && data.result) {
                const tx = flattenTx(data);
                const d = tx.decision.toUpperCase();
                if (d === 'FLAG' || (d === 'BLOCK' && tx.riskScore >= 60 && tx.riskScore < 85)) {
                    const queueItem = {
                        ...tx,
                        status: 'pending',
                        priority: getPriority(tx.riskScore),
                        analystNotes: [],
                        auditTrail: [
                            { type: 'system', text: `AI flagged transaction with risk score ${tx.riskScore}/100`, time: 'Just now' },
                            { type: 'flag', text: `Category: ${tx.fraudCategory.replace(/_/g, ' ')}`, time: 'Just now' }
                        ]
                    };
                    queueItems.unshift(queueItem);
                    updateStats();
                    sortQueue();
                    renderQueue();
                    // Update sidebar badge
                    updateSidebarBadge();
                }
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

// === HELPERS ===
function getPriority(riskScore) {
    if (riskScore >= 75) return 'high';
    if (riskScore >= 50) return 'medium';
    return 'low';
}

function getRiskClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function formatTimeAgo(ts) {
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// === STATS ===
function updateStats() {
    reviewStats.pending = queueItems.filter(q => q.status === 'pending').length;
    reviewStats.approved = queueItems.filter(q => q.status === 'approved').length;
    reviewStats.blocked = queueItems.filter(q => q.status === 'blocked').length;
    reviewStats.escalated = queueItems.filter(q => q.status === 'escalated').length;

    if (statPending) statPending.textContent = reviewStats.pending;
    if (statApproved) statApproved.textContent = reviewStats.approved;
    if (statBlocked) statBlocked.textContent = reviewStats.blocked;
    if (statEscalated) statEscalated.textContent = reviewStats.escalated;

}

// === SORT ===
function sortQueue() {
    const pending = queueItems.filter(q => q.status === 'pending');
    const resolved = queueItems.filter(q => q.status !== 'pending');

    if (sortMode === 'risk') {
        pending.sort((a, b) => b.riskScore - a.riskScore);
    } else if (sortMode === 'time') {
        pending.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortMode === 'amount') {
        pending.sort((a, b) => b.amount - a.amount);
    }

    queueItems = [...pending, ...resolved];
}

function setSort(mode) {
    sortMode = mode;
    document.querySelectorAll('.review-toolbar__sort').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-sort="${mode}"]`);
    if (btn) btn.classList.add('active');
    sortQueue();
    renderQueue();
}

// === RENDER QUEUE ===
function renderQueue() {
    if (!queueBody) return;

    const pending = queueItems.filter(q => q.status === 'pending');

    if (queueItems.length === 0) {
        queueBody.innerHTML = `
            <div class="queue-empty">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <div class="queue-empty__title">Queue is Clear</div>
                <div class="queue-empty__desc">No transactions require manual review right now.<br>The AI is handling all decisions automatically.</div>
            </div>`;
        return;
    }

    queueBody.innerHTML = queueItems.map((item, i) => {
        const riskClass = getRiskClass(item.riskScore);
        const isSelected = selectedItem && selectedItem.txId === item.txId;
        const resolvedClass = item.status !== 'pending' ? `resolved--${item.status}` : '';

        let resolvedBadge = '';
        if (item.status === 'approved') {
            resolvedBadge = `<div class="queue-card__resolved-badge text-emerald">${icon('checkCircle')} Analyst Approved</div>`;
        } else if (item.status === 'blocked') {
            resolvedBadge = `<div class="queue-card__resolved-badge text-red">${icon('xCircle')} Analyst Blocked</div>`;
        } else if (item.status === 'escalated') {
            resolvedBadge = `<div class="queue-card__resolved-badge text-purple">${icon('flag')} Escalated</div>`;
        }

        const actionsHtml = item.status === 'pending' ? `
            <div class="queue-card__actions">
                <button class="queue-card__action queue-card__action--approve" onclick="event.stopPropagation(); quickAction(${i}, 'approved')">
                    ${icon('checkCircle')} Approve
                </button>
                <button class="queue-card__action queue-card__action--block" onclick="event.stopPropagation(); quickAction(${i}, 'blocked')">
                    ${icon('xCircle')} Block
                </button>
                <button class="queue-card__action queue-card__action--escalate" onclick="event.stopPropagation(); quickAction(${i}, 'escalated')">
                    ${icon('flag')} Escalate
                </button>
            </div>` : resolvedBadge;

        return `
            <div class="queue-card ${isSelected ? 'selected' : ''} ${resolvedClass}" onclick="selectQueueItem(${i})">
                <div class="queue-card__top">
                    <div class="queue-card__priority queue-card__priority--${item.priority}">
                        ${icon('alertTriangle')} ${item.priority} priority
                    </div>
                    <span class="queue-card__time">${formatTimeAgo(item.timestamp)}</span>
                </div>
                <div class="queue-card__middle">
                    <div class="queue-card__info">
                        <span class="queue-card__customer">${item.customerId}</span>
                        <span class="queue-card__meta">
                            <span>${item.txId}</span>
                            <span>&middot;</span>
                            <span>${item.location}</span>
                            <span>&middot;</span>
                            <span>${item.merchantName}</span>
                        </span>
                    </div>
                    <span class="queue-card__amount">$${item.amount.toFixed(2)}</span>
                    <div class="queue-card__score-wrap">
                        <div class="queue-card__score queue-card__score--${riskClass}">${item.riskScore}</div>
                        <span class="queue-card__score-label">Risk</span>
                    </div>
                </div>
                <div class="queue-card__reason">
                    ${icon('alertTriangle')}
                    <span>${item.fraudCategory.replace(/_/g, ' ')}: ${truncate(item.explanation, 80)}</span>
                </div>
                ${actionsHtml}
            </div>`;
    }).join('');
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

// === SELECT QUEUE ITEM ===
function selectQueueItem(index) {
    selectedItem = queueItems[index];
    renderQueue();
    renderInvestigation(selectedItem, index);
}

// === QUICK ACTIONS (from card) ===
function quickAction(index, status) {
    const item = queueItems[index];
    item.status = status;
    const actionMap = { approved: 'Force Approved', blocked: 'Force Blocked', escalated: 'Escalated to Senior Analyst' };
    item.auditTrail.push({
        type: status === 'approved' ? 'approve' : status === 'blocked' ? 'block' : 'flag',
        text: `Analyst: ${actionMap[status]}`,
        time: 'Just now'
    });
    // Persist to backend
    const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
    fetch(`${baseUrl}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_id: item.txId, status })
    }).catch(err => console.error('Review persist failed:', err));
    updateStats();
    updateSidebarBadge();
    renderQueue();
    if (selectedItem && selectedItem.txId === item.txId) {
        renderInvestigation(item, index);
    }
}

// === DECISION ACTION (from investigation panel) ===
function takeDecision(status) {
    if (!selectedItem) return;
    const index = queueItems.findIndex(q => q.txId === selectedItem.txId);
    if (index === -1) return;
    quickAction(index, status);
}

// === ADD NOTE ===
function addNote() {
    if (!selectedItem) return;
    const textarea = document.getElementById('analyst-notes');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) return;

    const note = {
        author: 'Analyst (SA)',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        text: text
    };

    selectedItem.analystNotes.push(note);
    selectedItem.auditTrail.push({
        type: 'system',
        text: `Note added: "${truncate(text, 50)}"`,
        time: 'Just now'
    });

    // Persist note to backend
    const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
    fetch(`${baseUrl}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_id: selectedItem.txId, status: selectedItem.status, note: text })
    }).catch(err => console.error('Note persist failed:', err));

    textarea.value = '';
    const index = queueItems.findIndex(q => q.txId === selectedItem.txId);
    renderInvestigation(selectedItem, index);
}

// === RENDER INVESTIGATION ===
function renderInvestigation(item, index) {
    if (!investigationBody || !item) return;

    const riskClass = getRiskClass(item.riskScore);
    const tierLabel = item.routingTier || 'standard';
    const model = item.result?.model_used || 'gemini-2.5-flash';
    const isPending = item.status === 'pending';
    const shapFeatures = generateSHAPFeatures(item);

    investigationBody.innerHTML = `
        <!-- Decision Hero -->
        <div class="decision-hero">
            <div class="decision-hero__top">
                <div class="decision-hero__score decision-hero__score--${riskClass}">${item.riskScore}</div>
                <div class="decision-hero__details">
                    <span class="decision-hero__txn-id">${item.txId}</span>
                    <span class="decision-hero__customer">${item.customerId}</span>
                    <div class="decision-hero__meta">
                        <span class="badge badge--flag">${icon('flag')} Pending Review</span>
                        <span class="mono" style="font-size: var(--text-sm); font-weight: 700;">$${item.amount.toFixed(2)}</span>
                        <span style="font-size: var(--text-xs); color: var(--text-dim);">${item.location} &middot; ${item.merchantName}</span>
                    </div>
                </div>
            </div>
            ${isPending ? `
            <div class="decision-actions">
                <button class="decision-btn decision-btn--approve" onclick="takeDecision('approved')">
                    ${icon('checkCircle')} Force Approve
                </button>
                <button class="decision-btn decision-btn--block" onclick="takeDecision('blocked')">
                    ${icon('xCircle')} Force Block
                </button>
                <button class="decision-btn decision-btn--escalate" onclick="takeDecision('escalated')">
                    ${icon('flag')} Escalate
                </button>
            </div>
            ` : `
            <div style="padding: 8px 12px; border-radius: var(--radius-md); text-align: center; font-weight: 800; text-transform: uppercase; font-size: var(--text-sm); letter-spacing: 0.06em;
                background: ${item.status === 'approved' ? 'var(--color-emerald-soft)' : item.status === 'blocked' ? 'var(--color-red-soft)' : 'var(--color-purple-soft)'};
                color: ${item.status === 'approved' ? 'var(--color-emerald)' : item.status === 'blocked' ? 'var(--color-red)' : 'var(--color-purple)'};">
                ${item.status === 'approved' ? 'Approved by Analyst' : item.status === 'blocked' ? 'Blocked by Analyst' : 'Escalated'}
            </div>
            `}
        </div>

        <!-- AI Reasoning -->
        <div class="forensic-section">
            <div class="forensic-section__title">${icon('brain')} AI Reasoning Chain</div>
            <p class="reasoning-text">${item.explanation}</p>
            ${item.reasoningChain.length > 0 ? `
                <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
                    ${item.reasoningChain.map((step, i) => `
                        <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); padding: 4px 0;">
                            <span style="color: var(--color-blue); font-weight: 700; font-family: var(--font-mono); min-width: 18px;">${i + 1}.</span>
                            <span>${step}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>

        <!-- SHAP Feature Impact -->
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
        </div>

        <!-- Telemetry -->
        <div class="forensic-section">
            <div class="forensic-section__title">${icon('server')} Telemetry</div>
            <div class="evidence-list">
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Model</span>
                    <span class="evidence-item__value">${model}</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet ${item.riskScore > 70 ? 'evidence-item__bullet--positive' : 'evidence-item__bullet--negative'}"></span>
                    <span class="evidence-item__label">Risk Score</span>
                    <span class="evidence-item__value" style="color: ${item.riskScore > 70 ? 'var(--color-red)' : item.riskScore > 40 ? 'var(--color-amber)' : 'var(--color-emerald)'};">${item.riskScore}/100</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Confidence</span>
                    <span class="evidence-item__value">${(item.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="evidence-item">
                    <span class="evidence-item__bullet evidence-item__bullet--neutral"></span>
                    <span class="evidence-item__label">Cost Tier</span>
                    <span class="evidence-item__value">${tierLabel.toUpperCase()}</span>
                </div>
            </div>
        </div>

        <!-- Investigation Notes -->
        <div class="notes-section">
            <div class="notes-section__title">${icon('reviewQueue')} Investigation Notes</div>
            ${item.analystNotes.length > 0 ? `
                <div class="notes-saved" style="margin-bottom: var(--space-md);">
                    ${item.analystNotes.map(n => `
                        <div class="note-entry">
                            <div class="note-entry__meta">
                                <span class="note-entry__author">${n.author}</span>
                                <span class="note-entry__time">${n.time}</span>
                            </div>
                            <div class="note-entry__text">${n.text}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <textarea id="analyst-notes" class="notes-textarea" placeholder="Add investigation notes for compliance records..."></textarea>
            <div class="notes-submit-row">
                <button class="notes-submit-btn" onclick="addNote()">
                    ${icon('arrowRight')} Add Note
                </button>
            </div>
        </div>

        <!-- Audit Trail -->
        <div class="forensic-section">
            <div class="forensic-section__title">${icon('activity')} Audit Trail</div>
            <div class="audit-trail">
                ${item.auditTrail.map(entry => `
                    <div class="audit-entry">
                        <div class="audit-entry__icon audit-entry__icon--${entry.type}">
                            ${entry.type === 'system' ? icon('cpu') : entry.type === 'approve' ? icon('checkCircle') : entry.type === 'block' ? icon('xCircle') : icon('flag')}
                        </div>
                        <span class="audit-entry__text">${entry.text}</span>
                        <span class="audit-entry__time">${entry.time}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// === SHAP FEATURES (same as dashboard) ===
function generateSHAPFeatures(tx) {
    const features = [];
    const amountImpact = tx.amount > 5000 ? 0.45 : tx.amount > 1000 ? 0.2 : tx.amount > 100 ? 0.12 : 0.05;
    features.push({ feature: 'txn_amount', impact: amountImpact, direction: tx.amount > 500 ? 'fraud' : 'legit', barWidth: Math.min(100, amountImpact * 200) });

    const categoryRisk = ['electronics', 'jewelry', 'crypto', 'digital_goods'].includes(tx.merchantName?.toLowerCase()) ? 0.35 : 0.08;
    features.push({ feature: 'merchant_cat', impact: categoryRisk, direction: categoryRisk > 0.2 ? 'fraud' : 'legit', barWidth: Math.min(100, categoryRisk * 200) });

    const geoImpact = tx.fraudCategory === 'card_not_present_geo' ? 0.55 : tx.fraudCategory === 'velocity_testing' ? 0.4 : 0.1;
    features.push({ feature: tx.fraudCategory?.includes('geo') ? 'geo_anomaly' : 'velocity_sig', impact: geoImpact, direction: geoImpact > 0.15 ? 'fraud' : 'legit', barWidth: Math.min(100, geoImpact * 180) });

    const hour = new Date().getHours();
    const timeImpact = (hour >= 1 && hour <= 5) ? 0.22 : 0.04;
    features.push({ feature: 'hour_of_day', impact: timeImpact, direction: timeImpact > 0.1 ? 'fraud' : 'legit', barWidth: Math.min(100, timeImpact * 200) });

    const confidenceImpact = tx.riskScore > 60 ? 0.3 : 0.1;
    features.push({ feature: 'risk_conf', impact: confidenceImpact, direction: tx.riskScore > 60 ? 'fraud' : 'legit', barWidth: Math.min(100, confidenceImpact * 200) });

    features.sort((a, b) => b.impact - a.impact);
    return features.slice(0, 5);
}

// === BATCH ACTIONS ===
function batchApproveAll() {
    queueItems.forEach(item => {
        if (item.status === 'pending') {
            item.status = 'approved';
            item.auditTrail.push({ type: 'approve', text: 'Batch approved by analyst', time: 'Just now' });
        }
    });
    updateStats();
    updateSidebarBadge();
    renderQueue();
    if (selectedItem) {
        const idx = queueItems.findIndex(q => q.txId === selectedItem.txId);
        if (idx !== -1) renderInvestigation(queueItems[idx], idx);
    }
}

function batchBlockAll() {
    queueItems.forEach(item => {
        if (item.status === 'pending') {
            item.status = 'blocked';
            item.auditTrail.push({ type: 'block', text: 'Batch blocked by analyst', time: 'Just now' });
        }
    });
    updateStats();
    updateSidebarBadge();
    renderQueue();
    if (selectedItem) {
        const idx = queueItems.findIndex(q => q.txId === selectedItem.txId);
        if (idx !== -1) renderInvestigation(queueItems[idx], idx);
    }
}

// Expose to HTML
window.selectQueueItem = selectQueueItem;
window.quickAction = quickAction;
window.takeDecision = takeDecision;
window.addNote = addNote;
window.setSort = setSort;
window.batchApproveAll = batchApproveAll;
window.batchBlockAll = batchBlockAll;

// === INIT ===
fetchQueue();
connectWS();
