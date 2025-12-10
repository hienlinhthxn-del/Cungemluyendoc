
import React, { useState } from 'react';
import { X, Calendar, BookOpen, Clock } from 'lucide-react';
import { LESSONS } from '../constants';

interface AssignHomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (lessonId: string, note: string, dueDate: string, readingLimit: number, quizLimit: number) => void;
}

export const AssignHomeworkModal: React.FC<AssignHomeworkModalProps> = ({ isOpen, onClose, onAssign }) => {
    const [selectedLessonId, setSelectedLessonId] = useState(LESSONS[0]?.id || '');
    const [note, setNote] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [readingLimit, setReadingLimit] = useState<string>('');
    const [quizLimit, setQuizLimit] = useState<string>('');

    if (!isOpen) return null;

    const handleAssign = () => {
        try {
            console.log("Submitting assignment:", { selectedLessonId, note, dueDate, readingLimit, quizLimit });
            if (selectedLessonId) {
                const rLimit = readingLimit ? Number(readingLimit) : 0;
                const qLimit = quizLimit ? Number(quizLimit) : 0;

                onAssign(
                    selectedLessonId,
                    note,
                    dueDate,
                    isNaN(rLimit) ? 0 : rLimit,
                    isNaN(qLimit) ? 0 : qLimit
                );
                setNote('');
                setDueDate('');
                setReadingLimit('');
                setQuizLimit('');
            }
        } catch (error) {
            console.error("Error in handler:", error);
            alert("Có lỗi xảy ra khi gửi bài. Vui lòng thử lại.");
        }
    };

    const selectedLesson = LESSONS.find(l => l.id === selectedLessonId);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-primary" />
                        Giao Bài Về Nhà
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Chọn Bài Học</label>
                            <select
                                value={selectedLessonId}
                                onChange={(e) => setSelectedLessonId(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer hover:border-blue-400 transition-colors"
                            >
                                {LESSONS.map((lesson) => (
                                    <option key={lesson.id} value={lesson.id}>
                                        {lesson.title}
                                    </option>
                                ))}
                            </select>
                            {selectedLesson && (
                                <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                    "{selectedLesson.description}"
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Hạn Nộp Bài</label>
                                <input
                                    type="datetime-local"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Thời Gian Đọc (Phút)</label>
                                    <div className="relative">
                                        <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Để trống = Không giới hạn"
                                            value={readingLimit}
                                            onChange={(e) => setReadingLimit(e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-primary text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Thời Gian Làm Bài Tập (Phút)</label>
                                    <div className="relative">
                                        <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Để trống = Không giới hạn"
                                            value={quizLimit}
                                            onChange={(e) => setQuizLimit(e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-primary text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Lời Nhắn / Yêu Cầu (Tùy chọn)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ví dụ: Các em nhớ luyện đọc kỹ phần từ khó nhé..."
                                rows={3}
                                className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900 text-sm">Lưu ý</p>
                                <p className="text-blue-700 text-xs mt-1">
                                    Bài tập sẽ được gửi thông báo đến phụ huynh và học sinh ngay lập tức.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedLessonId}
                        className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all transform hover:translate-y-[-1px]"
                    >
                        Gửi Bài
                    </button>
                </div>
            </div>
        </div>
    );
};
