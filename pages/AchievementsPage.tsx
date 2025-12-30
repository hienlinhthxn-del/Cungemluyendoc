import React, { useState, useEffect } from 'react';
import { ACHIEVEMENTS } from './achievements';
import { Lock, Share2 } from 'lucide-react';
import { playClick } from '../services/audioService';
import { getStudents } from '../services/studentService';

export const AchievementsPage: React.FC = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    // Sử dụng state để lưu thông tin học sinh. `undefined` là trạng thái ban đầu (đang tải).
    const [currentStudent, setCurrentStudent] = useState<ReturnType<typeof getStudents>[0] | null | undefined>(undefined);


    useEffect(() => {
        // Truy cập localStorage chỉ ở phía client (sau khi component đã mount)
        // để tránh lỗi "localStorage is not defined" khi render ở server.
        const studentId = localStorage.getItem('current_student_id');
        const studentData = studentId ? getStudents().find(s => s.id === studentId) : null;
        setCurrentStudent(studentData || null);

        // Trigger animation after component mounts
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Trạng thái đang tải, chờ useEffect chạy lần đầu
    if (currentStudent === undefined) {
        return (
            <div className="text-center p-10">
                <p className="text-gray-500">Đang tải thành tích...</p>
            </div>
        );
    }

    // Xử lý trường hợp không tìm thấy học sinh (chưa đăng nhập hoặc ID không hợp lệ)
    if (!currentStudent) {
        return (
            <div className="text-center p-10 bg-yellow-50 rounded-lg">
                <h2 className="text-xl font-bold text-yellow-800">Vui lòng chọn học sinh!</h2>
                <p className="text-yellow-700 mt-2">Vui lòng quay lại và chọn tên của mình để xem thành tích.</p>
            </div>
        );
    }

    const unlockedAchievements = ACHIEVEMENTS.filter(ach => currentStudent.badges.includes(ach.id));
    const lockedAchievements = ACHIEVEMENTS.filter(ach => !currentStudent.badges.includes(ach.id));

    const handleShare = () => {
        playClick();
        const url = window.location.href;
        const message = `🎉 Tớ đã sưu tập được ${unlockedAchievements.length} huy hiệu trong ứng dụng Luyện Đọc! Hãy xem bộ sưu tập của tớ nhé: ${url}`;
        navigator.clipboard.writeText(message).then(() => {
            alert('Đã sao chép tin nhắn chia sẻ! Bạn có thể dán vào Zalo hoặc Messenger để khoe với bạn bè.');
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Không thể sao chép liên kết.');
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Bộ Sưu Tập Huy Hiệu</h1>
                    <p className="text-gray-500">Đây là những thành tích tuyệt vời mà con đã đạt được!</p>
                </div>
                <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors shadow-sm">
                    <Share2 className="w-4 h-4" />
                    <span className="font-medium text-sm">Khoe thành tích</span>
                </button>
            </div>

            {/* Unlocked Achievements */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-green-600 mb-4">Đã Mở Khóa ({unlockedAchievements.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {unlockedAchievements.map((ach, index) => (
                        <div
                            key={ach.id}
                            className={`text-center p-4 bg-green-50 rounded-xl border-2 border-green-200 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:border-green-400 ${isLoaded ? 'animate-fade-in-up' : 'opacity-0'}`}
                            style={{ animationDelay: `${index * 75}ms` }}
                            onMouseEnter={() => playClick()}
                        >
                            <div
                                className="text-6xl mb-3 transition-transform duration-300 group-hover:scale-110"
                            >
                                {ach.icon}
                            </div>
                            <div>
                                <p className="font-bold text-green-800">{ach.title}</p>
                                <p className="text-xs text-green-600 mt-1">{ach.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Locked Achievements */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-500 mb-4">Sắp Đạt Được ({lockedAchievements.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {lockedAchievements.map((ach, index) => (
                        <div key={ach.id} className="text-center p-4 bg-gray-100 rounded-xl border-2 border-gray-200 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                <Lock className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="text-6xl mb-3 filter grayscale opacity-60">{ach.icon}</div>
                            <p className="font-bold text-gray-500 filter grayscale">{ach.title}</p>
                            <p className="text-xs text-gray-400 mt-1 filter grayscale">{ach.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};