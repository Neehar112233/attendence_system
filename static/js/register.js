/**
 * FaceTrack AI — Student Registration Page Logic
 * Handles webcam access, face capture, and form submission.
 */

(() => {
    // DOM Elements
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const placeholder = document.getElementById('camera-placeholder');
    const overlay = document.getElementById('camera-overlay');
    const capturedPreview = document.getElementById('captured-preview');
    const capturedImage = document.getElementById('captured-image');
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnCapture = document.getElementById('btn-capture');
    const btnRetake = document.getElementById('btn-retake');
    const btnRegister = document.getElementById('btn-register');

    let stream = null;
    let capturedBase64 = null;

    // ─── Start Camera ───────────────────────────────────────────────
    btnStartCamera.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });
            video.srcObject = stream;
            video.style.display = 'block';
            placeholder.style.display = 'none';
            overlay.style.display = 'block';
            btnStartCamera.textContent = '⏹ Stop Camera';
            btnStartCamera.classList.add('active');
            btnCapture.disabled = false;
            showToast('Camera started. Position your face in the guide.', 'info');
        } catch (err) {
            console.error('Camera error:', err);
            showToast('Camera access denied. Please allow camera permissions.', 'error');
        }
    });

    // Toggle camera off if already running
    btnStartCamera.addEventListener('click', function handler() {
        // Remove this handler and re-add proper toggle
    });

    // Better toggle logic
    let cameraOn = false;
    btnStartCamera.onclick = async () => {
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
            btnStartCamera.innerHTML = '⏹ Stop Camera';
            btnCapture.disabled = false;
            cameraOn = true;
            showToast('Camera started. Position your face within the guide.', 'info');
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
        btnStartCamera.innerHTML = '📷 Start Camera';
        btnCapture.disabled = true;
        cameraOn = false;
    }

    // ─── Capture Face ───────────────────────────────────────────────
    btnCapture.addEventListener('click', () => {
        if (!stream) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // Mirror the capture to match what user sees
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset

        capturedBase64 = canvas.toDataURL('image/jpeg', 0.9);
        capturedImage.src = capturedBase64;
        capturedPreview.style.display = 'flex';

        // Stop camera after capture
        stopCamera();

        // Enable register button if form is valid
        validateForm();

        showToast('Face captured! Fill in all details to register.', 'success');
    });

    // ─── Retake Photo ───────────────────────────────────────────────
    btnRetake.addEventListener('click', () => {
        capturedBase64 = null;
        capturedPreview.style.display = 'none';
        capturedImage.src = '';
        btnRegister.disabled = true;
        // Re-start camera
        btnStartCamera.click();
    });

    // ─── Form Validation ────────────────────────────────────────────
    const nameInput = document.getElementById('student-name');
    const rollInput = document.getElementById('student-roll');
    const sectionInput = document.getElementById('student-section');
    const branchInput = document.getElementById('student-branch');

    function validateForm() {
        const valid = nameInput.value.trim() &&
                      rollInput.value.trim() &&
                      sectionInput.value &&
                      branchInput.value &&
                      capturedBase64;
        btnRegister.disabled = !valid;
        return valid;
    }

    [nameInput, rollInput, sectionInput, branchInput].forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });

    // ─── Register Student ───────────────────────────────────────────
    btnRegister.addEventListener('click', async () => {
        if (!validateForm()) return;

        btnRegister.disabled = true;
        btnRegister.innerHTML = '<span class="spinner"></span> Registering...';

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameInput.value.trim(),
                    roll: rollInput.value.trim(),
                    section: sectionInput.value,
                    branch: branchInput.value,
                    face_image: capturedBase64
                })
            });

            const data = await res.json();

            if (data.success) {
                showToast(data.message, 'success', 5000);
                // Reset form
                nameInput.value = '';
                rollInput.value = '';
                sectionInput.value = '';
                branchInput.value = '';
                capturedBase64 = null;
                capturedPreview.style.display = 'none';
                capturedImage.src = '';
            } else {
                showToast(data.message, 'error', 5000);
            }
        } catch (err) {
            console.error('Registration error:', err);
            showToast('Server error. Please try again.', 'error');
        }

        btnRegister.disabled = true;
        btnRegister.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <polyline points="16 11 18 13 22 9"/>
            </svg>
            Register Student
        `;
    });
})();
