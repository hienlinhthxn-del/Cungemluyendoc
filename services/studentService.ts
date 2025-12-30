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

export const saveStudents = (students: StudentStats[]): void => {
    try {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
        // Dispatch event to notify other components of the change
        window.dispatchEvent(new Event('students_updated'));
    } catch (e) {
        console.error("Failed to save students", e);
    }
};

// NEW: Force sync with server (Call this from Dashboard)
export const syncWithServer = async (classId?: string) => {
    try {
        const url = classId ? `/api/students?classId=${classId}` : '/api/students';
        // Thêm { cache: 'no-store' } để đảm bảo luôn lấy dữ liệu mới nhất, tránh bị cache bởi trình duyệt hoặc CDN.
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch from server');

        const serverData: StudentStats[] = await response.json();

        if (Array.isArray(serverData)) {
            // CHIẾN LƯỢC MỚI: Coi máy chủ là nguồn dữ liệu duy nhất và đáng tin cậy nhất (Single Source of Truth).
            // Logic cũ cố gắng hợp nhất dữ liệu máy chủ và local, nhưng gây ra lỗi khi xóa:
            // học sinh đã xóa ở server bị coi là "chỉ có ở local" và được thêm lại.
            // Logic mới sẽ ghi đè hoàn toàn dữ liệu local bằng dữ liệu từ server, đảm bảo tính nhất quán.
            console.log(`Syncing: Server is truth. Overwriting local cache with ${serverData.length} students.`);
            
            // Hàm saveStudents sẽ lưu vào localStorage và thông báo cho các component khác cập nhật.
            saveStudents(serverData);
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

/**
 * @deprecated This function is too generic and uses an old API. Use `uploadPracticeAudio` and `savePracticeScores` instead.
 */
export const saveStudentResult = async (studentId: string, week: number, score: number, speed: number | string, audioBlob?: Blob) => {
    console.warn("`saveStudentResult` is deprecated. Please refactor to use new service functions.");
    // The old logic is kept here for reference but should not be used for new features.
};

/**
 * MỚI: Tải lên file âm thanh cho một phần cụ thể của bài luyện tập (âm/vần, từ, đoạn văn).
 * @param studentId ID của học sinh.
 * @param week Tuần học.
 * @param part Phần của bài học ('phoneme', 'word', 'reading').
 * @param audioBlob File âm thanh đã ghi.
 * @param score Điểm số cho phần này.
 * @returns Kết quả tải lên, bao gồm URL của file âm thanh mới.
 */
export const uploadPracticeAudio = async (
    studentId: string,
    week: number,
    part: 'phoneme' | 'word' | 'reading',
    audioBlob: Blob,
    score: number
) => {
    try {
        const formData = new FormData();
        formData.append('studentId', studentId);
        formData.append('week', String(week));
        formData.append('part', part);
        formData.append('score', String(score)); // Gửi kèm điểm của phần này

        const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = `student_${studentId}_w${week}_${part}.${ext}`;
        formData.append('audioFile', audioBlob, filename);

        const response = await fetch('/api/submissions', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Tải lên file âm thanh thất bại.');
        }

        return await response.json(); // { success: true, audioUrl: '...' }
    } catch (e) {
        console.error(`Lỗi khi tải lên audio cho phần ${part}:`, e);
        throw e;
    }
};

/**
 * MỚI: Lưu điểm tổng kết cuối cùng cho một buổi luyện tập.
 * @param studentId ID của học sinh.
 * @param week Tuần học.
 * @param scores Một đối tượng chứa tất cả điểm số của tuần đó.
 */
export const savePracticeScores = async (
    studentId: string,
    week: number,
    scores: {
        totalScore: number;
        speed: number | string;
        phonemeScore?: number;
        wordScore?: number;
        readingScore?: number;
        exerciseScore?: number;
    }
) => {
    try {
        // Đồng bộ điểm số lên server
        await fetch(`/api/students/${studentId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                week: week,
                score: scores.totalScore,
                speed: scores.speed,
                phonemeScore: scores.phonemeScore,
                wordScore: scores.wordScore,
                readingScore: scores.readingScore,
                exerciseScore: scores.exerciseScore,
            }),
        });

        // Cập nhật dữ liệu local để giao diện phản hồi ngay lập tức
        const students = getStudents();
        const studentIndex = students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            // ... (Phần logic cập nhật local state có thể được thêm vào đây nếu cần)
            // Tuy nhiên, cách tốt nhất là dựa vào `syncWithServer` để lấy dữ liệu mới nhất.
        }

    } catch (e) {
        console.error("Lỗi đồng bộ điểm số:", e);
        throw e;
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

    // Standard Sync (Double check) with saved class context
    const savedClassId = localStorage.getItem('teacher_class_id');
    syncWithServer(savedClassId || undefined);
};


export const resetToMock = () => {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS));
    window.dispatchEvent(new Event('students_updated'));
    // Also sync to server to be safe
    MOCK_STUDENTS.forEach(s => syncStudentToServer(s));
};
