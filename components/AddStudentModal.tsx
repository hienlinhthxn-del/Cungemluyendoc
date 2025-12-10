import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [newStudentName, setNewStudentName] = useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        if (newStudentName.trim()) {
            onAdd(newStudentName.trim());
            setNewStudentName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Thêm Học Sinh Mới</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên học sinh</label>
                        <input
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            placeholder="Nhập tên học sinh..."
                            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Hủy bỏ</button>
                        <button onClick={handleAdd} disabled={!newStudentName.trim()} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50">Thêm vào lớp</button>
                    </div>
                </div>
            </div>
        </div>
    );
};