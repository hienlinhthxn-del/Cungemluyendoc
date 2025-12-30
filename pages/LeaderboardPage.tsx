import React, { useMemo, useState, useEffect } from 'react';
import { Trophy, Medal, Star, Crown, Zap, BookOpen } from 'lucide-react';
import { StudentStats } from '../types';
import { getStudents, syncWithServer } from '../services/studentService';
import { playClick } from '../services/audioService';

export const LeaderboardPage: React.FC = () => {
    const [students, setStudents] = useState<StudentStats[]>([]);
    const [loading, setLoading] = useState(true);
    // Khởi tạo classId là null để chờ tải từ client
    const [classId, setClassId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // Tải classId từ localStorage một cách an toàn ở phía client
            const savedClassId = localStorage.getItem('student_class_id') || localStorage.getItem('teacher_class_id') || 'DEFAULT';
            setClassId(savedClassId);

            setLoading(true);
            await syncWithServer(savedClassId);
            setStudents(getStudents());
            setLoading(false);
        };
        init();
    }, []); // Chỉ chạy một lần khi component mount

    // CATEGORY 1: SIÊU SAO ĐIỂM SỐ (Average Score)
    const topScoreStudents = useMemo(() => {
        return [...students]
            .filter(s => s.averageScore > 0)
            .sort((a, b) => b.averageScore - a.averageScore || b.completedLessons - a.completedLessons)
            .slice(0, 5);
    }, [students]);

    // CATEGORY 2: ONG CHĂM CHỈ (Completed Lessons)
    const topDiligentStudents = useMemo(() => {
        return [...students]
            .filter(s => s.completedLessons > 0)
            .sort((a, b) => b.completedLessons - a.completedLessons || b.averageScore - a.averageScore)
            .slice(0, 5);
    }, [students]);

    // CATEGORY 3: THẦN TỐC ĐỘ (Reading Speed)
    const topSpeedStudents = useMemo(() => {
        return [...students]
            .filter(s => typeof s.readingSpeed === 'number' && s.readingSpeed > 0)
            .sort((a, b) => (b.readingSpeed as number) - (a.readingSpeed as number))
            .slice(0, 5);
    }, [students]);

    const PoduimItem = ({ student, rank, type }: { student: StudentStats, rank: number, type: 'score' | 'diligent' | 'speed', key?: any }) => {
        let icon = <Trophy className="w-6 h-6 text-yellow-500" />;
        let bgColor = "bg-yellow-50";
        let borderColor = "border-yellow-200";
        let scoreText = "";

        if (rank === 1) { bgColor = "bg-yellow-100"; borderColor = "border-yellow-400"; icon = <Crown className="w-8 h-8 text-yellow-600 animate-bounce" />; }
        if (rank === 2) { bgColor = "bg-gray-50"; borderColor = "border-gray-300"; icon = <Medal className="w-7 h-7 text-gray-500" />; }
        if (rank === 3) { bgColor = "bg-orange-50"; borderColor = "border-orange-300"; icon = <Medal className="w-6 h-6 text-orange-600" />; }

        if (type === 'score') scoreText = `${student.averageScore} điểm`;
        if (type === 'diligent') scoreText = `${student.completedLessons} bài`;
        if (type === 'speed') scoreText = `${student.readingSpeed} từ/phút`;

        return (
            <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${bgColor} ${borderColor} transform hover:scale-105 transition-transform shadow-sm`}>
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center font-bold text-xl text-gray-700">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-lg">{student.name}</h4>
                </div>
                <div className="text-right">
                    <span className="font-bold text-primary block">{scoreText}</span>
                    <div className="flex justify-end mt-1">{icon}</div>
                </div>
            </div>
        );
    };

    if (loading || !classId) {
        return (
            <div className="p-8 text-center text-gray-500">
                Đang tải bảng xếp hạng...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-red-600 mb-4 drop-shadow-sm">
                    BẢNG VÀNG THI ĐUA
                </h1>
                <p className="text-gray-600 text-lg">Vinh danh những ngôi sao sáng nhất lớp {classId}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COLUMN 1: SCORE */}
                <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-yellow-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Star className="w-32 h-32" /></div>
                    <h2 className="text-2xl font-bold text-yellow-600 mb-6 flex items-center gap-2 relative z-10">
                        <Star className="w-8 h-8 fill-yellow-500" />
                        Giọng Đọc Vàng
                    </h2>
                    <div className="space-y-3 relative z-10">
                        {topScoreStudents.map((s, i) => (
                            <PoduimItem key={s.id} student={s} rank={i + 1} type="score" />
                        ))}
                        {topScoreStudents.length === 0 && <p className="text-gray-400 text-center py-10">Chưa có dữ liệu</p>}
                    </div>
                </div>

                {/* COLUMN 2: DILIGENT */}
                <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><BookOpen className="w-32 h-32" /></div>
                    <h2 className="text-2xl font-bold text-blue-600 mb-6 flex items-center gap-2 relative z-10">
                        <BookOpen className="w-8 h-8 fill-blue-500" />
                        Ong Chăm Chỉ
                    </h2>
                    <div className="space-y-3 relative z-10">
                        {topDiligentStudents.map((s, i) => (
                            <PoduimItem key={s.id} student={s} rank={i + 1} type="diligent" />
                        ))}
                        {topDiligentStudents.length === 0 && <p className="text-gray-400 text-center py-10">Chưa có dữ liệu</p>}
                    </div>
                </div>

                {/* COLUMN 3: SPEED */}
                <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-red-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-32 h-32" /></div>
                    <h2 className="text-2xl font-bold text-red-600 mb-6 flex items-center gap-2 relative z-10">
                        <Zap className="w-8 h-8 fill-red-500" />
                        Thần Tốc Độ
                    </h2>
                    <div className="space-y-3 relative z-10">
                        {topSpeedStudents.map((s, i) => (
                            <PoduimItem key={s.id} student={s} rank={i + 1} type="speed" />
                        ))}
                        {topSpeedStudents.length === 0 && <p className="text-gray-400 text-center py-10">Chưa có dữ liệu</p>}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
                <button
                    onClick={() => { playClick(); window.history.back(); }}
                    className="bg-white text-gray-700 px-8 py-3 rounded-full font-bold shadow-2xl border-2 border-gray-200 hover:bg-gray-50 transform hover:scale-105 transition-all text-lg"
                >
                    Quay Lại
                </button>
            </div>
        </div>
    );
};
