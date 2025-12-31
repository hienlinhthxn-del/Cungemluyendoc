
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

// --- ASYNC API METHODS (Replaces LocalStorage) ---
export const fetchCommunications = async (): Promise<Communication[]> => {
    try {
        const response = await fetch('/api/communications');
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.json();
    } catch (e) {
        console.error("Fetch comms error:", e);
        // Fallback to local storage if API fails (offline mode?)
        return getCommunicationsLocal();
    }
};

export const sendCommunication = async (comm: Communication): Promise<Communication | null> => {
    try {
        const response = await fetch('/api/communications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(comm)
        });
        if (!response.ok) throw new Error('Failed to send');
        const result = await response.json();

        // Also update local storage for immediate offline reflection (optional)
        saveCommunicationLocal(comm);
        return result;
    } catch (e) {
        console.error("Send comm error:", e);
        return null;
    }
};

// --- LEGACY SYNC METHODS (Renamed/Deprecated) ---
// Kept for fallback or if components aren't fully migrated yet
export const getCommunicationsLocal = (): Communication[] => {
    try {
        const data = localStorage.getItem(COMM_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
};

export const saveCommunicationLocal = (comm: Communication) => {
    const list = getCommunicationsLocal();
    localStorage.setItem(COMM_STORAGE_KEY, JSON.stringify([comm, ...list]));
    window.dispatchEvent(new Event('communications_updated'));
};

// Alias specifically for backward compatibility if I miss a spot, 
// BUT components should be updated to use fetchCommunications.
// However, since components expect sync return, I can't just alias it.
// I will update components to use fetchCommunications.
export const getCommunications = getCommunicationsLocal;
export const saveCommunication = saveCommunicationLocal;
