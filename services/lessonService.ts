import { Lesson } from '../types';
import { LESSONS as DEFAULT_LESSONS } from '../constants';

let cachedLessons: Lesson[] = [];

// Fetch lessons from server, fallback to constants if empty or offline
export const getLessons = async (classId?: string): Promise<Lesson[]> => {
    try {
        const token = localStorage.getItem('token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const url = classId ? `/api/lessons?classId=${classId}` : '/api/lessons';
        const res = await fetch(url, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                cachedLessons = data;
                return data;
            }
        }
    } catch (e) {
        console.warn("Failed to fetch lessons from server, using default.", e);
    }
    // Fallback
    return DEFAULT_LESSONS;
};

export const saveLesson = async (lesson: Lesson): Promise<boolean> => {
    try {
        const token = localStorage.getItem('token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/lessons', {
            method: 'POST',
            headers,
            body: JSON.stringify(lesson)
        });
        return res.ok;
    } catch (e) {
        console.error("Save lesson failed", e);
        return false;
    }
};

export const deleteLesson = async (id: string): Promise<boolean> => {
    try {
        const token = localStorage.getItem('token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/lessons/${id}`, {
            method: 'DELETE',
            headers
        });
        return res.ok;
    } catch (e) {
        console.error("Delete lesson failed", e);
        return false;
    }
};
