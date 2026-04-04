/**
 * FaceTrack AI — Dashboard Page Logic
 * Handles stats, attendance records, and student management.
 */

(() => {
    // DOM Elements
    const totalStudents = document.getElementById('dash-total-students');
    const todayPresent = document.getElementById('dash-today-present');
    const todayAbsent = document.getElementById('dash-today-absent');
    const attendanceRate = document.getElementById('dash-attendance-rate');
    const filterDate = document.getElementById('filter-date');
    const filterSearch = document.getElementById('filter-search');
    const btnFilter = document.getElementById('btn-filter');
    const attendanceTbody = document.getElementById('attendance-tbody');
    const tableEmpty = document.getElementById('table-empty');
    const attendanceTable = document.getElementById('attendance-table');
    const studentsTbody = document.getElementById('students-tbody');
    const studentsEmpty = document.getElementById('students-empty');
    const studentsTable = document.getElementById('students-table');
    const studentsCountBadge = document.getElementById('students-count-badge');

    let allRecords = [];

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    filterDate.value = today;

    // ─── Load Dashboard Stats ───────────────────────────────────────
    async function loadStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            animateNumber(totalStudents, data.total_students);
            animateNumber(todayPresent, data.today_present);
            animateNumber(todayAbsent, data.today_absent);
            attendanceRate.textContent = data.attendance_rate + '%';
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    // ─── Animate Number ─────────────────────────────────────────────
    function animateNumber(el, target) {
        let current = 0;
        const duration = 600;
        const step = target / (duration / 16);
        
        function update() {
            current += step;
            if (current >= target) {
                el.textContent = target;
                return;
            }
            el.textContent = Math.floor(current);
            requestAnimationFrame(update);
        }
        
        if (target === 0) {
            el.textContent = '0';
        } else {
            update();
        }
    }

    // ─── Load Attendance Records ────────────────────────────────────
    async function loadAttendance(date = '') {
        try {
            const url = date ? `/api/attendance?date=${date}` : '/api/attendance';
            const res = await fetch(url);
            const data = await res.json();

            allRecords = data.records || [];
            renderAttendance(allRecords);
        } catch (err) {
            console.error('Failed to load attendance:', err);
        }
    }

    function renderAttendance(records) {
        attendanceTbody.innerHTML = '';

        if (records.length === 0) {
            attendanceTable.style.display = 'none';
            tableEmpty.style.display = 'flex';
            return;
        }

        attendanceTable.style.display = 'table';
        tableEmpty.style.display = 'none';

        records.forEach((rec, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">${i + 1}</td>
                <td style="font-weight: 600;">${rec.name}</td>
                <td><code style="background: var(--bg-elevated); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${rec.roll}</code></td>
                <td style="color: var(--accent-primary-light);max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${rec.subject || '-'}">${rec.subject || '-'}</td>
                <td style="font-family: var(--font-mono); font-size: 0.85rem;">${rec.date}</td>
                <td style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-primary-light);">${rec.time || '-'}</td>
                <td><span class="status-badge status-present">● ${rec.status || 'Present'}</span></td>
            `;
            attendanceTbody.appendChild(tr);
        });
    }

    // ─── Filter ─────────────────────────────────────────────────────
    btnFilter.addEventListener('click', () => {
        const date = filterDate.value;
        loadAttendance(date);
        loadStats();
    });

    filterSearch.addEventListener('input', () => {
        const query = filterSearch.value.toLowerCase().trim();
        if (!query) {
            renderAttendance(allRecords);
            return;
        }
        const filtered = allRecords.filter(r =>
            r.name.toLowerCase().includes(query) ||
            r.roll.toLowerCase().includes(query)
        );
        renderAttendance(filtered);
    });

    filterDate.addEventListener('change', () => {
        loadAttendance(filterDate.value);
    });

    // ─── Load Registered Students ───────────────────────────────────
    async function loadStudents() {
        try {
            const res = await fetch('/api/students');
            const data = await res.json();
            const students = data.students || [];

            studentsCountBadge.textContent = students.length;
            studentsTbody.innerHTML = '';

            if (students.length === 0) {
                studentsTable.style.display = 'none';
                studentsEmpty.style.display = 'flex';
                return;
            }

            studentsTable.style.display = 'table';
            studentsEmpty.style.display = 'none';

            students.forEach((s, i) => {
                const regDate = s.registered_at 
                    ? new Date(s.registered_at).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'short', day: 'numeric' 
                    }) 
                    : '-';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">${i + 1}</td>
                    <td style="font-weight: 600;">${s.name}</td>
                    <td><code style="background: var(--bg-elevated); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${s.roll}</code></td>
                    <td>${s.section || '-'}</td>
                    <td>${s.branch || '-'}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${regDate}</td>
                    <td>
                        <div style="display:flex;gap:0.5rem;">
                            <button class="btn btn-secondary btn-sm" onclick="viewStudent('${s.roll}')">
                                👤 View Profile
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.roll}')" title="Delete student">
                                🗑
                            </button>
                        </div>
                    </td>
                `;
                studentsTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Failed to load students:', err);
        }
    }

    // ─── Delete Student ─────────────────────────────────────────────
    window.deleteStudent = async (roll) => {
        if (!confirm(`Are you sure you want to delete student with roll number: ${roll}?`)) return;

        try {
            const res = await fetch(`/api/students/${roll}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                showToast(data.message, 'success');
                loadStudents();
                loadStats();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete student.', 'error');
        }
    };

    // ─── Modal Logic ────────────────────────────────────────────────
    const studentModal = document.getElementById('student-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalStudentInfo = document.getElementById('modal-student-info');
    const subjectCardsContainer = document.getElementById('subject-cards-container');

    if(btnCloseModal) btnCloseModal.addEventListener('click', () => studentModal.style.display = 'none');
    if(modalOverlay) modalOverlay.addEventListener('click', () => studentModal.style.display = 'none');

    window.viewStudent = async (roll) => {
        studentModal.style.display = 'flex';
        modalStudentInfo.innerHTML = '<span class="spinner"></span> Loading...';
        subjectCardsContainer.innerHTML = '';
        
        try {
            const [attendanceRes, studentsRes] = await Promise.all([
                fetch(`/api/attendance?roll=${roll}`),
                fetch('/api/students')
            ]);
            
            const attendanceData = await attendanceRes.json();
            const studentsData = await studentsRes.json();
            const student = (studentsData.students || []).find(s => s.roll === roll);
            
            if (!student) {
                modalStudentInfo.innerHTML = 'Student not found.';
                return;
            }

            modalStudentInfo.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="font-size:1.5rem; margin-bottom:0.25rem;">${student.name}</h3>
                        <p style="color:var(--text-muted); font-family:var(--font-mono);">${student.roll}</p>
                    </div>
                    <div style="text-align:right;">
                        <p><strong>Branch:</strong> ${student.branch}</p>
                        <p><strong>Section:</strong> ${student.section}</p>
                    </div>
                </div>
            `;
            
            const records = attendanceData.records || [];
            const subjectCounts = {};
            records.forEach(r => {
                const sub = r.subject || 'N/A';
                subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
            });

            if (Object.keys(subjectCounts).length === 0) {
                subjectCardsContainer.innerHTML = '<p style="color:var(--text-muted);">No attendance recorded yet.</p>';
            } else {
                for (let sub in subjectCounts) {
                    subjectCardsContainer.innerHTML += `
                        <div class="subject-card">
                            <h4>${sub}</h4>
                            <div class="subject-count">${subjectCounts[sub]} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">Attended</span></div>
                        </div>
                    `;
                }
            }
        } catch(err) {
            modalStudentInfo.innerHTML = '<span class="error">Error loading student data.</span>';
        }
    };

    // ─── Initial Load ───────────────────────────────────────────────
    loadStats();
    loadAttendance(today);
    loadStudents();
})();
