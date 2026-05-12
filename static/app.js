const DOM = {
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  browseTrigger: document.getElementById('browse-trigger'),
  filePreview: document.getElementById('file-preview'),
  fileName: document.getElementById('file-name'),
  fileSize: document.getElementById('file-size'),
  removeFile: document.getElementById('remove-file'),
  processBtn: document.getElementById('process-btn'),
  processingOverlay: document.getElementById('processing-overlay'),
  uploadCard: document.getElementById('upload-card'),
  resultsPanel: document.getElementById('results-panel'),
  errorCard: document.getElementById('error-card'),
  errorMsg: document.getElementById('error-msg'),
  stepParse: document.getElementById('step-parse'),
  stepExtract: document.getElementById('step-extract'),
  stepRoute: document.getElementById('step-route'),
  routeDecision: document.getElementById('route-decision'),
  routeBadge: document.getElementById('route-badge'),
  routeReasoning: document.getElementById('route-reasoning'),
  policyNumber: document.getElementById('policy-number'),
  policyHolder: document.getElementById('policy-holder'),
  policyDates: document.getElementById('policy-dates'),
  incidentDatetime: document.getElementById('incident-datetime'),
  incidentLocation: document.getElementById('incident-location'),
  incidentDesc: document.getElementById('incident-desc'),
  incidentAuthority: document.getElementById('incident-authority'),
  missingFieldsContainer: document.getElementById('missing-fields-container'),
  partiesContainer: document.getElementById('parties-container'),
  assetsContainer: document.getElementById('assets-container'),
  jsonToggle: document.getElementById('json-toggle'),
  jsonBody: document.getElementById('json-body'),
  jsonContent: document.getElementById('json-content'),
};

let selectedFile = null;

// File handling

DOM.browseTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  DOM.fileInput.click();
});

DOM.uploadZone.addEventListener('click', () => {
  DOM.fileInput.click();
});

DOM.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

DOM.uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.add('drag-over');
});

DOM.uploadZone.addEventListener('dragleave', () => {
  DOM.uploadZone.classList.remove('drag-over');
});

DOM.uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  DOM.uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]);
  }
});

DOM.removeFile.addEventListener('click', () => {
  clearFile();
});

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'txt'].includes(ext)) {
    showError('Invalid file type. Please upload a PDF or TXT file.');
    return;
  }
  selectedFile = file;
  DOM.fileName.textContent = file.name;
  DOM.fileSize.textContent = formatFileSize(file.size);
  DOM.filePreview.classList.add('visible');
  DOM.processBtn.disabled = false;
  hideError();
}

function clearFile() {
  selectedFile = null;
  DOM.fileInput.value = '';
  DOM.filePreview.classList.remove('visible');
  DOM.processBtn.disabled = true;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Processing

DOM.processBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  DOM.uploadCard.style.display = 'none';
  DOM.processingOverlay.classList.add('visible');
  DOM.resultsPanel.classList.remove('visible');
  hideError();

  await animateStep(DOM.stepParse, 600);
  await animateStep(DOM.stepExtract, 800);

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const response = await fetch('/api/process', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Processing failed');
    }

    const data = await response.json();

    await animateStep(DOM.stepRoute, 400);

    await sleep(300);

    DOM.processingOverlay.classList.remove('visible');
    renderResults(data);

  } catch (err) {
    DOM.processingOverlay.classList.remove('visible');
    DOM.uploadCard.style.display = 'block';
    showError(err.message);
    resetSteps();
  }
});

function animateStep(stepEl, duration) {
  return new Promise((resolve) => {
    stepEl.classList.add('active');
    setTimeout(() => {
      stepEl.classList.remove('active');
      stepEl.classList.add('done');
      resolve();
    }, duration);
  });
}

function resetSteps() {
  [DOM.stepParse, DOM.stepExtract, DOM.stepRoute].forEach((s) => {
    s.classList.remove('active', 'done');
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Errors

function showError(msg) {
  DOM.errorMsg.textContent = msg;
  DOM.errorCard.classList.add('visible');
}

function hideError() {
  DOM.errorCard.classList.remove('visible');
}

// Results

function renderResults(data) {
  const fields = data.extractedFields;
  const route = data.recommendedRoute;

  const routeMap = {
    FAST_TRACK: { class: 'fast-track', label: 'Fast-Track' },
    MANUAL_REVIEW: { class: 'manual-review', label: 'Manual Review' },
    INVESTIGATION_FLAG: { class: 'investigation', label: 'Investigation' },
    SPECIALIST_QUEUE: { class: 'specialist', label: 'Specialist Queue' },
  };

  const routeInfo = routeMap[route] || routeMap.MANUAL_REVIEW;
  DOM.routeDecision.className = 'route-decision ' + routeInfo.class;
  DOM.routeBadge.textContent = routeInfo.label;
  DOM.routeReasoning.textContent = data.reasoning;

  DOM.policyNumber.textContent = fields.policy.policyNumber || '—';
  DOM.policyHolder.textContent = fields.policy.policyholderName || '—';
  const start = fields.policy.effectiveDateStart || '—';
  const end = fields.policy.effectiveDateEnd || '—';
  DOM.policyDates.textContent = start !== '—' || end !== '—' ? `${start} → ${end}` : '—';

  DOM.incidentDatetime.textContent = `${fields.incident.date || '—'} at ${fields.incident.time || '—'}`;
  DOM.incidentLocation.textContent = fields.incident.location || '—';
  DOM.incidentDesc.textContent = fields.incident.description || '—';
  const auth = fields.incident.authorityContacted || '';
  const report = fields.incident.reportNumber || '';
  DOM.incidentAuthority.textContent = auth || report ? `${auth} ${report ? '(#' + report + ')' : ''}`.trim() : '—';

  markMissing(DOM.policyNumber, fields.policy.policyNumber);
  markMissing(DOM.policyHolder, fields.policy.policyholderName);
  markMissing(DOM.incidentLocation, fields.incident.location);

  renderMissingFields(data.missingFields);
  renderParties(fields.involvedParties);
  renderAssets(fields.assets);

  DOM.jsonContent.textContent = JSON.stringify(data, null, 2);

  DOM.resultsPanel.classList.add('visible');
  DOM.uploadCard.style.display = 'block';
}

function markMissing(el, value) {
  if (!value || value === '—' || value.toLowerCase() === 'n/a' || value.toLowerCase() === 'unknown') {
    el.classList.add('missing');
    if (!el.textContent || el.textContent === '—') {
      el.textContent = 'Not found';
    }
  } else {
    el.classList.remove('missing');
  }
}

function renderMissingFields(fields) {
  if (!fields || fields.length === 0) {
    DOM.missingFieldsContainer.innerHTML = '<div class="no-missing">✓ All mandatory fields present</div>';
    return;
  }
  const list = document.createElement('ul');
  list.className = 'missing-fields-list';
  fields.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'missing-tag';
    li.textContent = f;
    list.appendChild(li);
  });
  DOM.missingFieldsContainer.innerHTML = '';
  DOM.missingFieldsContainer.appendChild(list);
}

function renderParties(parties) {
  if (!parties || parties.length === 0) {
    DOM.partiesContainer.innerHTML = '<div class="field-value missing">No parties extracted</div>';
    return;
  }

  const avatarMap = {
    Claimant: { emoji: '🧑', cls: 'claimant' },
    'Third Party': { emoji: '👤', cls: 'third-party' },
    Witness: { emoji: '👁️', cls: 'witness' },
    'Insured Driver': { emoji: '🚘', cls: 'insured-driver' },
  };

  DOM.partiesContainer.innerHTML = parties
    .map((p) => {
      const av = avatarMap[p.type] || { emoji: '👤', cls: 'claimant' };
      const injury = p.injuries && !['none', 'no', 'n/a', ''].includes(p.injuries.toLowerCase())
        ? `<div class="party-injury">⚠ ${p.injuries}</div>`
        : '';
      return `
        <div class="party-card">
          <div class="party-avatar ${av.cls}">${av.emoji}</div>
          <div>
            <div class="party-name">${escapeHtml(p.name)}</div>
            <div class="party-type">${escapeHtml(p.type)}</div>
            ${injury}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAssets(assets) {
  if (!assets || assets.length === 0) {
    DOM.assetsContainer.innerHTML = '<div class="field-value missing">No assets extracted</div>';
    return;
  }

  DOM.assetsContainer.innerHTML = assets
    .map((a) => {
      const name = [a.year, a.make, a.model].filter(Boolean).join(' ') || a.type || 'Unknown Asset';
      const damage = a.estimatedDamage != null ? `$${a.estimatedDamage.toLocaleString()}` : '—';
      return `
        <div class="asset-card">
          <div class="asset-icon">🚗</div>
          <div class="asset-details">
            <div class="asset-name">${escapeHtml(name)}</div>
            <div class="asset-id">${escapeHtml(a.id || 'No ID')}</div>
          </div>
          <div class="asset-damage">${damage}</div>
        </div>
      `;
    })
    .join('');
}

// JSON viewer

DOM.jsonToggle.addEventListener('click', () => {
  DOM.jsonToggle.classList.toggle('expanded');
  DOM.jsonBody.classList.toggle('visible');
});

// Utilities

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
