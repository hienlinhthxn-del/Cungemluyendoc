import { StudentStats, WeeklyStats } from '../types';
import { MOCK_STUDENTS } from '../constants';

const STUDENTS_STORAGE_KEY = 'app_students_data';

// Helper to dedupe students by ID
const dedupeStudents = (list: StudentStats[]): StudentStats[] => {
    const seen = new Set();
    return list.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
    });
};

export const getStudents = (): StudentStats[] => {
    try {
        const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
        if (!stored) return []; // Return empty if nothing stored

        const parsed = JSON.parse(stored, (key, value) => {
            if (key === 'lastPractice') return new Date(value);
            return value;
        });
        return dedupeStudents(parsed);
    } catch (e) {
        console.error("Failed to load students", e);
        return [];
    }
};

// NEW: Force sync with server (Call this from Dashboard)
// NEW: Force sync with server (Call this from Dashboard)
export const syncWithServer = async () => {
    try {
        const response = await fetch('/api/students');
        if (!response.ok) throw new Error('Failed to fetch from server');

        const serverData: StudentStats[] = await response.json();

        if (Array.isArray(serverData) && serverData.length > 0) {
            console.log("Syncing: Server has data, updating local...");

            const localStudents = getStudents();

            // MERGE STRATEGY: Server Authority + Smart Merge for Audio
            const finalStudents = serverData.map(serverStudent => {
                const localStudent = localStudents.find(s => s.id === serverStudent.id);
                if (!localStudent) return serverStudent;

                // If Local has Audio URL but Server doesn't, preserve Local Audio
                // This happens when Upload finishes but Sync hasn't run yet
                const mergedHistory = serverStudent.history.map(serverH => {
                    const localH = localStudent.history.find(h => h.week === serverH.week);
                    if (localH && localH.audioUrl && !serverH.audioUrl) {
                        return { ...serverH, audioUrl: localH.audioUrl };
                    }
                    return serverH;
                });

                return {
                    ...serverStudent,
                    history: mergedHistory
                };
            });

            // Save merged list
            localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(finalStudents));
            window.dispatchEvent(new Event('students_updated'));
        }
    } catch (error) {
        console.error("Sync failed:", error);
    }
};

const syncStudentToServer = async (student: StudentStats) => {
    try {
        await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: student.id,
                name: student.name,
                completedLessons: student.completedLessons,
                averageScore: student.averageScore,
                readingSpeed: student.readingSpeed,
                history: student.history,
                badges: student.badges
            })
        });
    } catch (e) {
        console.error("Backfill failed", e);
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
                // Upload audio to Cloudinary
                const formData = new FormData();
                formData.append('audioFile', audioBlob); // MATCH SERVER EXPECTATION

                const response = await fetch('/api/upload-student-audio', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
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

export const initializeStudentsIfEmpty = async () => {
    const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
    let students: StudentStats[] = stored ? JSON.parse(stored) : [];

    if (students.length === 0) {
        console.log("Restoring MOCK DATA...");
        students = MOCK_STUDENTS;
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

        // Backfill MOCK data to server immediately
        for (const s of students) {
            await syncStudentToServer(s);
        }
        window.dispatchEvent(new Event('students_updated'));
    }

    // Try to sync/merge on startup
    syncWithServer();
};

export const resetToMock = () => {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS));
    window.dispatchEvent(new Event('students_updated'));
    // Also sync to server to be safe
    MOCK_STUDENTS.forEach(s => syncStudentToServer(s));
};
