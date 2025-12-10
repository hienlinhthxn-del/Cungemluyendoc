import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { StudentStats } from '../types';

interface EditStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (form: EditFormState) => void;
    student: StudentStats | null;
    week: number;
}

export interface EditFormState {
    name: string;
    completedLessons: number;
    score: number;
    speed: string | number;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, onClose, onUpdate, student, week }) => {
    const [editForm, setEditForm] = useState<EditFormState>({ name: '', completedLessons: 0, score: 0, speed: '' });

    useEffect(() => {
        if (student) {
            const weekRecord = student.history.find(h => h.week === week);
            setEditForm({
                name: student.name,
                completedLessons: student.completedLessons,
                score: weekRecord ? weekRecord.score : 0,
                speed: weekRecord ? weekRecord.speed : 0
            });
        }
    }, [student, week]);

    if (!isOpen || !student) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Chỉnh Sửa (Tuần {week})</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số bài đã hoàn thành (Tổng)</label>
                        <input type="number" min="0" value={editForm.completedLessons} onChange={(e) => setEditForm({ ...editForm, completedLessons: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                        <p className="text-sm font-bold text-blue-900 border-b border-blue-200 pb-2">Dữ liệu Tuần {week}</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm số</label>
                            <input type="number" min="0" max="100" value={editForm.score} onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tốc độ đọc</label>
                            <input type="text" value={editForm.speed} onChange={(e) => setEditForm({ ...editForm, speed: e.target.value })} placeholder="VD: 40 hoặc 'Đánh vần'" className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Hủy bỏ</button>
                        <button onClick={() => onUpdate(editForm)} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-600">Lưu thay đổi</button>
                    </div>
                </div>
            </div>
        </div>
    );
};