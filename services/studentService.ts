import { StudentStats, WeeklyStats } from '../types';
import { MOCK_STUDENTS } from '../constants';

const STUDENTS_STORAGE_KEY = 'app_students_data';

export const getStudents = (): StudentStats[] => {
    try {
        const data = localStorage.getItem(STUDENTS_STORAGE_KEY);
        if (data) {
            return JSON.parse(data, (key, value) => {
                if (key === 'lastPractice') return new Date(value);
                return value;
            });
        }
    } catch (e) {
        console.error("Failed to load students", e);
    }
    return MOCK_STUDENTS;
};

// NEW: Force sync with server (Call this from Dashboard)
export const syncWithServer = async () => {
    try {
        // 1. Fetch latest data from server
        const response = await fetch('/api/students');
        if (!response.ok) return;

        const serverData = await response.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
            // 2. Update LocalStorage
            localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(serverData));
            // 3. Notify UI
            window.dispatchEvent(new Event('students_updated'));
        }
    } catch (e) {
        console.error("Sync failed:", e);
    }
};

export const saveStudentResult = async (studentId: string, week: number, score: number, speed: number | string, audioBlob?: Blob) => {
    const students = getStudents();
    const index = students.findIndex(s => s.id === studentId);

    if (index !== -1) {
        const student = students[index];
        let uploadedAudioUrl = '';

        // 1. Upload Audio if exists
        if (audioBlob) {
            try {
                const formData = new FormData();
                // Determine extension (mp4 or webm)
                const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                formData.append('audioFile', audioBlob, `student_${studentId}_w${week}.${ext}`);

                const uploadRes = await fetch('/api/upload-student-audio', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    uploadedAudioUrl = data.url;
                }
            } catch (e) {
                console.error("Failed to upload student audio", e);
            }
        }

        // 2. Update Local State (Optimistic UI)
        const historyIndex = student.history.findIndex(h => h.week === week);
        const historyItem: WeeklyStats = { week, score, speed };
        if (uploadedAudioUrl) historyItem.audioUrl = uploadedAudioUrl;

        if (historyIndex !== -1) {
            // Preserve existing audioUrl if new one failed? 
            // Or if simple update? Assume overwrite for now.
            if (!uploadedAudioUrl && student.history[historyIndex].audioUrl) {
                historyItem.audioUrl = student.history[historyIndex].audioUrl;
            }
            student.history[historyIndex] = historyItem;
        } else {
            student.history.push(historyItem);
            student.history.sort((a, b) => a.week - b.week);
        }

        student.lastPractice = new Date();
        const totalScore = student.history.reduce((acc, curr) => acc + curr.score, 0);
        student.averageScore = Math.round(totalScore / student.history.length);
        student.readingSpeed = speed;

        students[index] = student;
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
        window.dispatchEvent(new Event('students_updated'));

        // 3. SYNC TO SERVER (Background)
        try {
            // First ensure student exists on server
            await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: student.id, name: student.name })
            });

            // Then save progress with audioUrl
            await fetch(`/api/students/${studentId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ week, score, speed, audioUrl: uploadedAudioUrl })
            });
        } catch (e) {
            console.error("Background sync failed:", e);
        }
    }
};

export const initializeStudentsIfEmpty = () => {
    if (!localStorage.getItem(STUDENTS_STORAGE_KEY)) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS));
    }
    // Try to sync on startup
    syncWithServer();
};
