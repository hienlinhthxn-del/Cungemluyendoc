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
export const syncWithServer = async (classId?: string) => {
    try {
        const url = classId ? `/api/students?classId=${classId}` : '/api/students';
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch from server');

        const serverData: StudentStats[] = await response.json();

        if (Array.isArray(serverData)) {
            // If classId is provided, we treat the server list as the authority for that class.
            // However, to keep it simple, we will merge with local for preservation of unsynced audios.
            console.log("Syncing: Server has data, updating local...");

            // MERGE STRATEGY: Union (Server + Local-Only)
            // This prevents data loss if Server returns empty list or if local creates haven't pushed yet.
            const serverIds = new Set(serverData.map(s => s.id));
            const localStudents = getStudents();

            // 1. Process Server Data (Update existing)
            const updatedServerStudents = serverData.map(serverStudent => {
                const localStudent = localStudents.find(s => s.id === serverStudent.id);
                if (!localStudent) return serverStudent;

                // If Local has Audio URL but Server doesn't, preserve Local Audio
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

            // 2. Keep Local-Only Students (Preserve unsynced new students)
            const localOnlyStudents = localStudents.filter(s => !serverIds.has(s.id));

            const finalStudents = [...updatedServerStudents, ...localOnlyStudents];

            // Save merged list
            localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(finalStudents));
            window.dispatchEvent(new Event('students_updated'));

            // Optional: Try to backfill local-only students to server?
            if (localOnlyStudents.length > 0) {
                console.log(`Found ${localOnlyStudents.length} unsynced students, attempting backfill...`);
                localOnlyStudents.forEach(s => syncStudentToServer(s));
            }
        }
    } catch (error) {
        console.error("Sync failed:", error);
    }
};

export const syncStudentToServer = async (student: StudentStats) => {
    try {
        await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: student.id,
                name: student.name,
                classId: student.classId,
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
                const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
                formData.append('audioFile', audioBlob, `student_${studentId}_w${week}.${ext}`); // MATCH SERVER EXPECTATION

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
                body: JSON.stringify({
                    id: student.id,
                    name: student.name,
                    classId: student.classId
                })
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
        console.log("Local storage empty. Attempting to fetch from server first...");
        try {
            // Try explicit fetch first to avoid race condition with Mock Data
            const response = await fetch('/api/students');
            if (response.ok) {
                const serverData: StudentStats[] = await response.json();
                if (Array.isArray(serverData) && serverData.length > 0) {
                    console.log(`Restored ${serverData.length} students from Server.`);
                    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(serverData));
                    window.dispatchEvent(new Event('students_updated'));
                    return; // EXIT: Data restored from server, skip Mock
                }
            }
        } catch (error) {
            console.warn("Could not reach server for initial load:", error);
        }

        // Only if Server is ALSO empty (or unreachable), fallback to Mock
        console.log("Server empty or unreachable. initializing MOCK DATA...");
        students = MOCK_STUDENTS;
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

        // Backfill MOCK data to server
        for (const s of students) {
            await syncStudentToServer(s);
        }
        window.dispatchEvent(new Event('students_updated'));
    }

    // Standard Sync (Double check)
    syncWithServer();
};


export const resetToMock = () => {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS));
    window.dispatchEvent(new Event('students_updated'));
    // Also sync to server to be safe
    MOCK_STUDENTS.forEach(s => syncStudentToServer(s));
};
