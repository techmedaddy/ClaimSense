(() => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileRemove = document.getElementById('fileRemove');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const processingSteps = document.getElementById('processingSteps');
    const errorDisplay = document.getElementById('errorDisplay');
    const errorText = document.getElementById('errorText');
    const resultsSection = document.getElementById('resultsSection');

    let selectedFile = null;

    // --- File Selection ---

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('active');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('active');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('active');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    fileRemove.addEventListener('click', () => {
        clearFile();
    });

    function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'txt'].includes(ext)) {
            showError('Unsupported file type. Please upload a PDF or TXT file.');
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatSize(file.size);
        fileInfo.style.display = 'flex';
        dropzone.style.display = 'none';
        analyzeBtn.disabled = false;
        hideError();
    }

    function clearFile() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        dropzone.style.display = '';
        analyzeBtn.disabled = true;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // --- Analysis ---

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // Reset UI
        hideError();
        resultsSection.style.display = 'none';
        analyzeBtn.disabled = true;
        btnText.textContent = 'Processing...';
        btnSpinner.style.display = 'inline-block';

        // Show processing steps
        processingSteps.style.display = 'flex';
        setStep(1);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            // Step 1: Parsing
            await delay(400);
            setStep(2);

            // Step 2: Extracting
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData,
            });

            setStep(3);
            await delay(300);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Processing failed');
            }

            const data = await response.json();

            // Step 3: Done
            completeSteps();
            await delay(400);

            renderResults(data);

        } catch (err) {
            showError(err.message);
            processingSteps.style.display = 'none';
        } finally {
            analyzeBtn.disabled = false;
            btnText.textContent = 'Analyze Claim';
            btnSpinner.style.display = 'none';
        }
    });

    // --- Processing Steps ---

    function setStep(n) {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById('step' + i);
            el.className = 'step';
            if (i < n) el.classList.add('done');
            if (i === n) el.classList.add('active');
        }
    }

    function completeSteps() {
        for (let i = 1; i <= 3; i++) {
            document.getElementById('step' + i).className = 'step done';
        }
    }

    // --- Render Results ---

    function renderResults(data) {
        const fields = data.extractedFields;

        // Policy
        setText('policyNumber', fields.policy?.policyNumber);
        setText('policyHolder', fields.policy?.policyholderName);
        const dateStart = fields.policy?.effectiveDateStart;
        const dateEnd = fields.policy?.effectiveDateEnd;
        setText('policyDates', dateStart && dateEnd ? `${dateStart} — ${dateEnd}` : (dateStart || dateEnd || null));

        // Incident
        const incDate = fields.incident?.date;
        const incTime = fields.incident?.time;
        setText('incidentDateTime', incDate || incTime ? `${incDate || '—'} at ${incTime || '—'}` : null);
        setText('incidentLocation', fields.incident?.location);
        setText('incidentDescription', fields.incident?.description);
        const auth = fields.incident?.authorityContacted;
        const report = fields.incident?.reportNumber;
        setText('incidentAuthority', auth || report ? `${auth || '—'} / ${report || '—'}` : null);

        // Missing Fields
        const missingCard = document.getElementById('missingFieldsCard');
        const missingList = document.getElementById('missingFieldsList');
        missingList.innerHTML = '';
        if (data.missingFields && data.missingFields.length > 0) {
            missingCard.style.display = '';
            data.missingFields.forEach(f => {
                const li = document.createElement('li');
                li.textContent = f;
                missingList.appendChild(li);
            });
        } else {
            missingCard.style.display = 'none';
        }

        // Involved Parties
        const partiesCard = document.getElementById('partiesCard');
        const partiesBody = document.getElementById('partiesTableBody');
        partiesBody.innerHTML = '';
        if (fields.involvedParties && fields.involvedParties.length > 0) {
            partiesCard.style.display = '';
            fields.involvedParties.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${esc(p.name || '—')}</td>
                    <td>${esc(p.role || '—')}</td>
                    <td>${esc(p.contact || '—')}</td>
                    <td>${esc(p.injuryDescription || 'None')}</td>
                `;
                partiesBody.appendChild(tr);
            });
        } else {
            partiesCard.style.display = 'none';
        }

        // Assets
        const assetsCard = document.getElementById('assetsCard');
        const assetsBody = document.getElementById('assetsTableBody');
        assetsBody.innerHTML = '';
        if (fields.assets && fields.assets.length > 0) {
            assetsCard.style.display = '';
            fields.assets.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${esc(a.description || '—')}</td>
                    <td>${esc(a.vin || '—')}</td>
                    <td>${esc(a.damageDescription || '—')}</td>
                    <td>${a.estimatedValue != null ? '$' + Number(a.estimatedValue).toLocaleString() : '—'}</td>
                `;
                assetsBody.appendChild(tr);
            });
        } else {
            assetsCard.style.display = 'none';
        }

        // Routing banner
        const banner = document.getElementById('routingBanner');
        const badge = document.getElementById('routingBadge');
        const reasoning = document.getElementById('routingReasoning');

        const route = data.recommendedRoute;
        const routeClass = route.toLowerCase().replace(/_/g, '-');
        banner.className = 'routing-banner route-' + routeClass;

        const routeLabels = {
            'FAST_TRACK': 'Fast Track',
            'MANUAL_REVIEW': 'Manual Review',
            'INVESTIGATION': 'Investigation',
            'SPECIALIST': 'Specialist'
        };
        badge.textContent = routeLabels[route] || route;
        reasoning.textContent = data.reasoning;

        // JSON
        document.getElementById('jsonOutput').textContent = JSON.stringify(data, null, 2);

        // Show results
        resultsSection.style.display = '';
    }

    function setText(id, value) {
        document.getElementById(id).textContent = value || '—';
    }

    function esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- JSON Toggle ---
    document.getElementById('jsonToggle').addEventListener('click', () => {
        const body = document.getElementById('jsonBody');
        const chevron = document.querySelector('.chevron');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : '';
        chevron.classList.toggle('open', !isOpen);
    });

    // --- Error ---

    function showError(msg) {
        errorText.textContent = msg;
        errorDisplay.style.display = 'flex';
    }

    function hideError() {
        errorDisplay.style.display = 'none';
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
})();
