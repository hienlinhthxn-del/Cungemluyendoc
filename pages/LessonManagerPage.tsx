import React, { useState, useEffect } from 'react';
import { Lesson } from '../types';
import { getLessons, saveLesson, deleteLesson } from '../services/lessonService';
import { Edit2, Plus, Trash2, Save, X, BookOpen, Check } from 'lucide-react';

export const LessonManager: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getLessons();
        setLessons(data);
        setLoading(false);
    };

    const handleEdit = (lesson: Lesson) => {
        setEditingLesson({ ...lesson }); // Copy object
    };

    const handleCreate = () => {
        const newId = `w${lessons.length + 1}`;
        setEditingLesson({
            id: newId,
            week: lessons.length + 1,
            title: `Tuần ${lessons.length + 1}: Bài Mới`,
            description: 'Mô tả bài học...',
            phonemes: [],
            vocabulary: ['từ mới 1', 'từ mới 2'],
            readingText: ['Câu đọc mẫu 1.', 'Câu đọc mẫu 2.'],
            questions: []
        });
    };

    const handleSave = async () => {
        if (!editingLesson) return;

        // Validation simple
        if (!editingLesson.week || !editingLesson.title) {
            alert('Vui lòng nhập Tuần và Tiêu đề');
            return;
        }

        try {
            const success = await saveLesson(editingLesson);
            if (success) {
                alert('Đã lưu bài học thành công!');
                setEditingLesson(null);
                loadData(); // Refresh list
            }
        } catch (err: any) {
            alert(`Lỗi khi lưu bài học: ${err.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc muốn xóa bài này không?')) {
            await deleteLesson(id);
            loadData();
        }
    };

    // Helper to update array fields (vocabulary, readingText)
    const updateArrayField = (field: 'vocabulary' | 'readingText' | 'phonemes', index: number, value: string) => {
        if (!editingLesson) return;
        const newArray = [...(editingLesson[field] || [])];
        newArray[index] = value;
        setEditingLesson({ ...editingLesson, [field]: newArray });
    };

    const addArrayItem = (field: 'vocabulary' | 'readingText' | 'phonemes') => {
        if (!editingLesson) return;
        setEditingLesson({
            ...editingLesson,
            [field]: [...(editingLesson[field] || []), '']
        });
    };

    const removeArrayItem = (field: 'vocabulary' | 'readingText' | 'phonemes', index: number) => {
        if (!editingLesson) return;
        const newArray = [...(editingLesson[field] || [])];
        newArray.splice(index, 1);
        setEditingLesson({ ...editingLesson, [field]: newArray });
    };

    if (loading) return <div className="p-10 text-center">Đang tải danh sách bài học...</div>;

    if (editingLesson) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-4 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-green-700 flex items-center gap-2">
                        <Edit2 className="w-6 h-6" /> Soạn Thảo Bài Học
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => setEditingLesson(null)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Hủy</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 flex items-center gap-2">
                            <Save className="w-4 h-4" /> Lưu Bài
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Tuần Học (Số)</label>
                            <input
                                type="number"
                                value={editingLesson.week}
                                onChange={e => setEditingLesson({ ...editingLesson, week: parseInt(e.target.value) })}
                                className="w-full border border-gray-300 rounded p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Mã Bài (ID)</label>
                            <input
                                type="text"
                                value={editingLesson.id}
                                onChange={e => setEditingLesson({ ...editingLesson, id: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Tiêu Đề Bài</label>
                            <input
                                type="text"
                                value={editingLesson.title}
                                onChange={e => setEditingLesson({ ...editingLesson, title: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 font-bold text-lg text-blue-800"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Mô Tả Ngắn</label>
                            <textarea
                                value={editingLesson.description}
                                onChange={e => setEditingLesson({ ...editingLesson, description: e.target.value })}
                                className="w-full border border-gray-300 rounded p-2 h-20"
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-6">
                        {/* Phonemes */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                                Âm / Vần Mới
                                <button onClick={() => addArrayItem('phonemes')} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">+ Thêm</button>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {editingLesson.phonemes.map((p, i) => (
                                    <div key={i} className="flex items-center bg-yellow-50 border border-yellow-200 rounded px-2">
                                        <input
                                            value={p}
                                            onChange={e => updateArrayField('phonemes', i, e.target.value)}
                                            className="bg-transparent w-16 p-1 outline-none font-bold text-red-500"
                                        />
                                        <button onClick={() => removeArrayItem('phonemes', i)}><X className="w-3 h-3 text-gray-400 hover:text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Vocabulary */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                                Từ Vựng
                                <button onClick={() => addArrayItem('vocabulary')} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">+ Thêm</button>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {editingLesson.vocabulary.map((v, i) => (
                                    <div key={i} className="flex items-center border border-gray-200 rounded px-2 bg-gray-50">
                                        <input
                                            value={v}
                                            onChange={e => updateArrayField('vocabulary', i, e.target.value)}
                                            className="bg-transparent w-full p-2 outline-none"
                                        />
                                        <button onClick={() => removeArrayItem('vocabulary', i)}><X className="w-4 h-4 text-gray-400 hover:text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reading Text */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between">
                        Bài Đọc (Mỗi dòng là một đoạn)
                        <button onClick={() => addArrayItem('readingText')} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">+ Thêm Đoạn</button>
                    </label>
                    <div className="space-y-2">
                        {editingLesson.readingText.map((text, i) => (
                            <div key={i} className="flex gap-2 items-start">
                                <span className="mt-2 text-gray-400 text-xs font-bold">#{i + 1}</span>
                                <textarea
                                    value={text}
                                    onChange={e => updateArrayField('readingText', i, e.target.value)}
                                    className="w-full border border-gray-300 rounded p-2 h-20 focus:ring-2 focus:ring-green-500"
                                ></textarea>
                                <button onClick={() => removeArrayItem('readingText', i)} className="mt-2 p-1 bg-red-100 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg">
                        <Save className="w-5 h-5" /> Lưu Thay Đổi
                    </button>
                </div>
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản Lý Bài Học</h1>
                    <p className="text-gray-500">Soạn thảo và chỉnh sửa nội dung bài đọc cho học sinh</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm"
                >
                    <Plus className="w-5 h-5 mr-2" /> Thêm Bài Mới
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lessons.map(lesson => (
                    <div key={lesson.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Tuần {lesson.week}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(lesson)} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Sửa"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(lesson.id)} className="p-1 hover:bg-gray-100 rounded text-red-600" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-1">{lesson.title}</h3>
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{lesson.description}</p>

                        <div className="flex flex-wrap gap-1 mt-auto">
                            {lesson.phonemes.slice(0, 4).map(p => (
                                <span key={p} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{p}</span>
                            ))}
                            {lesson.phonemes.length > 4 && <span className="text-xs text-gray-400">+{lesson.phonemes.length - 4}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
