
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { getStudents, saveStudentResult, syncWithServer } from '../services/studentService';
import { StudentStats } from '../types';

interface CloudFile {
    public_id: string;
    url: string;
    created_at: string;
    format: string;
    size: number;
}

export const LostAndFoundPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [students, setStudents] = useState<StudentStats[]>([]);

    // Claim State
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedWeek, setSelectedWeek] = useState(1);

    // Notification
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadFiles();
        setStudents(getStudents());
    }, []);

    const loadFiles = async (cursor?: string) => {
        setLoading(true);
        try {
            const url = cursor
                ? `/api/admin/cloudinary-files?next_cursor=${cursor}`
                : '/api/admin/cloudinary-files';

            const res = await fetch(url);
            const data = await res.json();

            if (cursor) {
                setFiles(prev => [...prev, ...data.files]);
            } else {
                setFiles(data.files);
            }
            setNextCursor(data.next_cursor);
        } catch (error) {
            console.error(error);
            setNotification({ message: 'Lỗi tải danh sách file', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!selectedFile || !selectedStudent) return;

        const file = files.find(f => f.url === selectedFile);
        if (!file) return;

        setNotification({ message: 'Đang lưu bài...', type: 'success' });
        try {
            // Save to student record
            // Note: score/speed 0 for now, teacher can update later
            await saveStudentResult(selectedStudent, selectedWeek, 0, 0, undefined);

            // Manually force the Audio URL update (since saveStudentResult expects a blob usually)
            // We'll use a direct API call to ensure the URL is set
            await fetch(`/api/students/${selectedStudent}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    week: selectedWeek,
                    score: 0,
                    speed: 0,
                    audioUrl: file.url
                })
            });

            setNotification({ message: 'Đã nhận bài thành công!', type: 'success' });

            // Refresh local data
            await syncWithServer(localStorage.getItem('teacher_class_id') || undefined);

            // Clear selection
            setSelectedFile(null);

        } catch (e) {
            console.error(e);
            setNotification({ message: 'Lỗi khi lưu bài', type: 'error' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Quay lại
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800 bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-indigo-600">
                        Kho Thất Lạc (Lost & Found)
                    </h1>
                </div>

                {notification && (
                    <div className={`p-4 mb-6 rounded-lg shadow-sm border ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                        {notification.message}
                    </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* List Files */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="font-semibold text-gray-700">Danh sách file âm thanh trên Cloud</h2>
                            <button
                                onClick={() => loadFiles()}
                                className="p-2 hover:bg-white rounded-full transition-colors"
                                title="Làm mới"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="h-[600px] overflow-y-auto p-4 space-y-3">
                            {files.map(file => (
                                <div
                                    key={file.public_id}
                                    className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${selectedFile === file.url
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-100 hover:bg-gray-50'
                                        }`}
                                    onClick={() => setSelectedFile(file.url)}
                                >
                                    <div className="flex-shrink-0 bg-indigo-100 p-2 rounded-full text-indigo-600">
                                        <Play className="w-4 h-4" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate" title={file.public_id}>
                                            {file.public_id}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(file.created_at).toLocaleString('vi-VN')} • {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>

                                    {/* Mini Player */}
                                    <audio controls src={file.url} className="h-8 w-24 ml-2" />
                                </div>
                            ))}

                            {files.length === 0 && !loading && (
                                <div className="text-center py-10 text-gray-400">
                                    Không tìm thấy file nào.
                                </div>
                            )}

                            {nextCursor && (
                                <button
                                    onClick={() => loadFiles(nextCursor)}
                                    disabled={loading}
                                    className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium mt-4"
                                >
                                    {loading ? 'Đang tải...' : 'Tải thêm'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Claim Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-lg border border-indigo-100 p-6 sticky top-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                <Check className="w-5 h-5 mr-2 text-indigo-600" />
                                Nhận Bài
                            </h2>

                            {!selectedFile ? (
                                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <p>Vui lòng chọn một file bên trái để nghe thử và nhận bài.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-indigo-50 p-3 rounded border border-indigo-100 mb-4">
                                        <p className="text-xs text-indigo-600 font-semibold uppercase mb-1">Đang chọn file:</p>
                                        <p className="text-sm text-gray-700 break-all">{
                                            files.find(f => f.url === selectedFile)?.public_id || selectedFile
                                        }</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Chọn Học sinh
                                        </label>
                                        <select
                                            value={selectedStudent}
                                            onChange={(e) => setSelectedStudent(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            <option value="">-- Chọn học sinh --</option>
                                            {students.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.classId || 'N/A'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Chọn Tuần
                                        </label>
                                        <select
                                            value={selectedWeek}
                                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            {Array.from({ length: 35 }, (_, i) => i + 1).map(w => (
                                                <option key={w} value={w}>Tuần {w}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleClaim}
                                        disabled={!selectedStudent}
                                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] ${!selectedStudent
                                                ? 'bg-gray-300 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
                                            }`}
                                    >
                                        Xác nhận Nhận Bài
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
