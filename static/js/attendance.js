/**
 * FaceTrack AI — Attendance Page Logic
 * Handles webcam for face recognition and real-time attendance marking.
 */

(() => {
    // DOM Elements
    const video = document.getElementById('attendance-video');
    const canvas = document.getElementById('attendance-canvas');
    const placeholder = document.getElementById('attendance-placeholder');
    const overlay = document.getElementById('attendance-camera-overlay');
    const cameraContainer = document.getElementById('attendance-camera-container');
    const btnStart = document.getElementById('btn-start-attendance-camera');
    const btnRecognize = document.getElementById('btn-recognize');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const resultSection = document.getElementById('recognition-result');
    const resultContent = document.getElementById('result-content');
    const attendanceList = document.getElementById('attendance-list');
    const attendanceEmpty = document.getElementById('attendance-empty');
    const countBadge = document.getElementById('attendance-count-badge');
    const branchSelect = document.getElementById('attendance-branch');
    const subjectSelect = document.getElementById('attendance-subject');

    let stream = null;
    let cameraOn = false;
    let isProcessing = false;

    // ─── Populate Subjects ──────────────────────────────────────────
    if (branchSelect && subjectSelect) {
        branchSelect.addEventListener('change', () => {
            const branch = branchSelect.value;
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            if (branch && typeof window.SRI_VASAVI_SUBJECTS !== 'undefined' && window.SRI_VASAVI_SUBJECTS[branch]) {
                window.SRI_VASAVI_SUBJECTS[branch].forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    subjectSelect.appendChild(opt);
                });
                subjectSelect.disabled = false;
            } else {
                subjectSelect.disabled = true;
            }
        });
    }

    // ─── Start/Stop Camera ──────────────────────────────────────────
    btnStart.onclick = async () => {
        if (!cameraOn && (!branchSelect.value || !subjectSelect.value)) {
            showToast('Please select Branch and Subject first.', 'warning');
            return;
        }

        if (cameraOn) {
            stopCamera();
            return;
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            });
            video.srcObject = stream;
            video.style.display = 'block';
            placeholder.style.display = 'none';
            overlay.style.display = 'block';
            btnStart.innerHTML = '⏹ Stop Camera';
            btnRecognize.disabled = false;
            cameraOn = true;

            // Update status
            statusIndicator.classList.add('active');
            statusText.textContent = 'Camera Active';

            // Add scan line
            const cameraCard = document.querySelector('.attendance-camera');
            if (cameraCard) cameraCard.classList.add('active');

            showToast('Camera active. Click "Recognize & Mark" to identify students.', 'info');
        } catch (err) {
            console.error('Camera error:', err);
            showToast('Cannot access camera. Please allow permissions.', 'error');
        }
    };

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        video.srcObject = null;
        video.style.display = 'none';
        placeholder.style.display = 'flex';
        overlay.style.display = 'none';
        btnStart.innerHTML = '📷 Start Camera';
        btnRecognize.disabled = true;
        cameraOn = false;

        statusIndicator.classList.remove('active');
        statusText.textContent = 'Camera Off';

        const cameraCard = document.querySelector('.attendance-camera');
        if (cameraCard) cameraCard.classList.remove('active');
    }

    // ─── Recognize & Mark Attendance ────────────────────────────────
    btnRecognize.addEventListener('click', async () => {
        if (!cameraOn || isProcessing) return;

        isProcessing = true;
        btnRecognize.disabled = true;
        btnRecognize.innerHTML = '<span class="spinner"></span> Recognizing...';

        // Capture frame from video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // Mirror
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);

        try {
            const res = await fetch('/api/mark-attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    face_image: imageBase64,
                    subject: subjectSelect.value
                })
            });

            const data = await res.json();
            showResult(data);

            if (data.success && data.results.length > 0) {
                const r = data.results[0];
                if (!r.already_marked) {
                    showToast(data.message, 'success', 5000);
                    addToAttendanceList(r);
                } else {
                    showToast(data.message, 'warning', 4000);
                }
            } else {
                showToast(data.message, data.success ? 'warning' : 'error', 4000);
            }
        } catch (err) {
            console.error('Recognition error:', err);
            showToast('Server error. Please try again.', 'error');
            showResult({ success: false, message: 'Server connection failed.', results: [] });
        }

        isProcessing = false;
        btnRecognize.disabled = false;
        btnRecognize.innerHTML = '🔍 Recognize & Mark';
    });

    // ─── Show Recognition Result ────────────────────────────────────
    function showResult(data) {
        resultSection.style.display = 'block';

        if (data.success && data.results.length > 0) {
            const r = data.results[0];
            const statusClass = r.already_marked ? 'result-info' : 'result-success';
            const statusIcon = r.already_marked ? '⚠️' : '✅';

            resultContent.innerHTML = `
                <div class="result-content ${statusClass}">
                    <span style="font-size:1.5rem">${statusIcon}</span>
                    <div class="result-details">
                        <div class="result-name">${r.name}</div>
                        <div class="result-meta">Roll: ${r.roll} | Section: ${r.section} | ${r.branch}</div>
                    </div>
                    <div class="result-confidence">${r.confidence}%</div>
                </div>
            `;
        } else {
            resultContent.innerHTML = `
                <div class="result-content result-error">
                    <span style="font-size:1.5rem">❌</span>
                    <div class="result-details">
                        <div class="result-name">${data.message}</div>
                    </div>
                </div>
            `;
        }
    }

    // ─── Add to Attendance List ─────────────────────────────────────
    function addToAttendanceList(student) {
        if (attendanceEmpty) attendanceEmpty.style.display = 'none';

        const initials = student.name.split(' ').map(w => w[0]).join('').substring(0, 2);
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = 'attendance-item';
        item.innerHTML = `
            <div class="attendance-avatar">${initials}</div>
            <div class="attendance-info">
                <div class="attendance-name">${student.name}</div>
                <div class="attendance-roll" style="margin-bottom: 2px;">${student.roll} · ${student.section} · ${student.branch}</div>
                <div class="attendance-roll" style="color: var(--accent-primary-light);">${subjectSelect.value}</div>
            </div>
            <div class="attendance-time">${time}</div>
        `;

        attendanceList.insertBefore(item, attendanceList.firstChild);

        // Update badge count
        const currentCount = parseInt(countBadge.textContent) || 0;
        countBadge.textContent = currentCount + 1;
    }

    // ─── Load Today's Attendance on Page Load ───────────────────────
    async function loadTodayAttendance() {
        try {
            const res = await fetch('/api/attendance');
            const data = await res.json();

            if (data.records && data.records.length > 0) {
                attendanceEmpty.style.display = 'none';
                countBadge.textContent = data.records.length;

                data.records.forEach(record => {
                    const initials = record.name.split(' ').map(w => w[0]).join('').substring(0, 2);
                    const item = document.createElement('div');
                    item.className = 'attendance-item';
                    item.innerHTML = `
                        <div class="attendance-avatar">${initials}</div>
                        <div class="attendance-info">
                            <div class="attendance-name">${record.name}</div>
                            <div class="attendance-roll" style="margin-bottom: 2px;">${record.roll} · ${record.section} · ${record.branch}</div>
                            <div class="attendance-roll" style="color: var(--accent-primary-light);">${record.subject || '-'}</div>
                        </div>
                        <div class="attendance-time">${record.time || ''}</div>
                    `;
                    attendanceList.appendChild(item);
                });
            }
        } catch (err) {
            console.error('Failed to load attendance:', err);
        }
    }

    loadTodayAttendance();
})();
