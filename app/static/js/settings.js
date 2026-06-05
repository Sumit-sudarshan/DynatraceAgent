/* ============================================================
   FinSentinel — Settings Page Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    
    // Check local storage for sidebar state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            
            // Dispatch resize event for charts if they exist (not strictly needed here but good practice)
            window.dispatchEvent(new Event('resize'));
        });
    }

    // 2. Settings Tabs Logic
    const tabs = document.querySelectorAll('.stab');
    const panels = document.querySelectorAll('.spanel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Add active to clicked
            tab.classList.add('active');
            const targetId = `panel-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 3. Initialize Visualizers
    updateThresholdViz();
    updatePipelineConnectors();
});

/* --- FRAUD THRESHOLDS VISUALIZER --- */
function updateThresholdViz() {
    const flagVal = parseInt(document.getElementById('threshold-flag').value, 10);
    const blockVal = parseInt(document.getElementById('threshold-block').value, 10);

    // Enforce logic constraints
    if (flagVal >= blockVal) {
        // Force flag to be slightly below block if user drags them too close
        document.getElementById('threshold-flag').value = blockVal - 1;
        document.getElementById('val-threshold-flag').textContent = blockVal - 1;
        return updateThresholdViz(); // re-run
    }

    // Update text readouts
    document.getElementById('val-threshold-flag').textContent = flagVal;
    document.getElementById('val-threshold-block').textContent = blockVal;

    // Update visualizer bar widths
    const approvePct = flagVal;
    const flagPct = blockVal - flagVal;
    const blockPct = 100 - blockVal;

    document.getElementById('viz-approve-zone').style.width = `${approvePct}%`;
    document.getElementById('viz-flag-zone').style.width = `${flagPct}%`;
    document.getElementById('viz-block-zone').style.width = `${blockPct}%`;

    // Update tick mark positions
    document.getElementById('viz-tick-flag').style.left = `${approvePct}%`;
    document.getElementById('viz-tick-flag').textContent = flagVal;
    
    document.getElementById('viz-tick-block').style.left = `${blockVal}%`;
    document.getElementById('viz-tick-block').textContent = blockVal;
}

/* --- TAG INPUTS --- */
function addTag(event, wrapperId, inputId) {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        const input = document.getElementById(inputId);
        const val = input.value.trim().replace(',', '');
        
        if (val) {
            const wrapper = document.getElementById(wrapperId);
            
            // Determine color based on context (hacky for demo, but looks good)
            let colorClass = 'risk-tag--amber';
            if (wrapperId === 'geo-tags' || wrapperId === 'mcc-tags' && Math.random() > 0.5) {
                colorClass = 'risk-tag--red';
            }

            const span = document.createElement('span');
            span.className = `risk-tag ${colorClass}`;
            span.innerHTML = `${val.toUpperCase()} <button onclick="removeTag(this)" aria-label="remove">&#x2715;</button>`;
            
            wrapper.insertBefore(span, input);
            input.value = '';
        }
    }
}

function removeTag(btn) {
    btn.parentElement.remove();
}

/* --- UTILS --- */
function toggleApiKey(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
        input.type = 'password';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
}

function testApiKey() {
    const btn = document.getElementById('btn-test-key');
    const originalHtml = btn.innerHTML;
    
    // Loading state
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
    
    setTimeout(() => {
        showToast("Gemini API connection successful.");
        btn.innerHTML = originalHtml;
    }, 1000);
}

function testDynatraceConnection() {
    const btn = document.getElementById('btn-dt-test');
    const originalHtml = btn.innerHTML;
    
    btn.innerHTML = `Testing...`;
    
    setTimeout(() => {
        const dot = document.getElementById('dt-dot');
        const text = document.getElementById('dt-status-text');
        
        dot.className = 'indicator-dot indicator-dot--connected';
        text.textContent = 'Connected & Active';
        text.style.color = 'var(--color-emerald)';
        
        document.getElementById('dt-status-card').style.borderColor = 'var(--color-emerald-border)';
        
        showToast("Successfully authenticated with Dynatrace API.");
        btn.innerHTML = originalHtml;
    }, 1500);
}

/* --- PIPELINE VIZ --- */
function updatePipelineViz(nodeId, isActive) {
    const node = document.getElementById(nodeId);
    if (isActive) {
        node.classList.add('pipeline-node--active');
        node.querySelector('.pnode__status').textContent = 'Active';
    } else {
        node.classList.remove('pipeline-node--active');
        node.querySelector('.pnode__status').textContent = 'Bypassed';
    }
    updatePipelineConnectors();
}

function updatePipelineConnectors() {
    // Simple heuristic to color connectors based on adjacent active nodes
    const n1 = document.getElementById('pnode-pattern').classList.contains('pipeline-node--active');
    const n2 = document.getElementById('pnode-geo').classList.contains('pipeline-node--active');
    const n3 = document.getElementById('pnode-risk').classList.contains('pipeline-node--active');
    const n4 = document.getElementById('pnode-decision').classList.contains('pipeline-node--active');

    const c1 = document.getElementById('conn-1');
    const c2 = document.getElementById('conn-2');
    const c3 = document.getElementById('conn-3');

    if (n1 && n2) c1.classList.add('pipeline-connector--active'); else c1.classList.remove('pipeline-connector--active');
    if (n2 && n3) c2.classList.add('pipeline-connector--active'); else c2.classList.remove('pipeline-connector--active');
    if (n3 && n4) c3.classList.add('pipeline-connector--active'); else c3.classList.remove('pipeline-connector--active');
}

/* --- SAVING --- */
function saveSection(sectionName) {
    const msgMap = {
        'fraud': 'Fraud thresholds updated. Applying to live stream...',
        'ai': 'AI models updated. Pipeline re-initialized.',
        'budget': 'Budget controls saved.',
        'dynatrace': 'Dynatrace integration settings saved.',
        'notifications': 'Alert rules updated.',
        'agents': 'Agent pipeline configuration applied.'
    };
    
    showToast(msgMap[sectionName] || 'Settings saved successfully.');
}

let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    
    msgEl.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
