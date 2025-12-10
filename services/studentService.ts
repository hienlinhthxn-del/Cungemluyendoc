import { StudentStats, WeeklyStats } from '../types';
import { MOCK_STUDENTS } from '../constants';

const STUDENTS_STORAGE_KEY = 'app_students_data';

export const getStudents = (): StudentStats[] => {
    try {
        const data = localStorage.getItem(STUDENTS_STORAGE_KEY);
        if (data) {
            // Merge with MOCK_STUDENTS to ensure we have structure if version changed, 
            // but for now just returning parsed data is fine.
            // We might want to ensure Dates are parsed back from strings if needed, 
            // but typically JSON stringify/parse leaves dates as strings. 
            // Consumers need to handle string dates.
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

export const saveStudentResult = (studentId: string, week: number, score: number, speed: number | string) => {
    const students = getStudents();
    const index = students.findIndex(s => s.id === studentId);

    if (index !== -1) {
        const student = students[index];

        // Update or Add Week History
        const historyIndex = student.history.findIndex(h => h.week === week);
        if (historyIndex !== -1) {
            // Update existing week (maybe average? or overwrite? Let's overwrite for latest attempt)
            student.history[historyIndex] = { week, score, speed };
        } else {
            student.history.push({ week, score, speed });
            student.history.sort((a, b) => a.week - b.week);
        }

        // Update General Stats
        student.lastPractice = new Date();
        // Re-calculate average
        const totalScore = student.history.reduce((acc, curr) => acc + curr.score, 0);
        student.averageScore = Math.round(totalScore / student.history.length);
        student.readingSpeed = speed; // Update latest speed

        // Save back
        students[index] = student;
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

        // Trigger a custom event so other components can reload if they are listening (optional but nice)
        window.dispatchEvent(new Event('students_updated'));
    }
};

export const initializeStudentsIfEmpty = () => {
    if (!localStorage.getItem(STUDENTS_STORAGE_KEY)) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS));
    }
};
