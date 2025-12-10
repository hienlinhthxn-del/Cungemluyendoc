
export interface Communication {
    id: string;
    studentId?: string; // If null, broadcast to all
    studentName?: string;
    sender: 'TEACHER' | 'PARENT';
    content: string;
    type: 'HOMEWORK' | 'NOTE' | 'FEEDBACK';
    timestamp: number;
    read: boolean;
    meta?: any; // For homework details etc.
}

export const COMM_STORAGE_KEY = 'app_communications';

export const getCommunications = (): Communication[] => {
    try {
        const data = localStorage.getItem(COMM_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const saveCommunication = (comm: Communication) => {
    const list = getCommunications();
    localStorage.setItem(COMM_STORAGE_KEY, JSON.stringify([comm, ...list]));
    window.dispatchEvent(new Event('communications_updated'));
};
