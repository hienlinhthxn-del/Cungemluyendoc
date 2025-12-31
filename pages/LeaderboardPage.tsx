import React, { useMemo, useState, useEffect } from 'react';
import { Trophy, Medal, Star, Crown, Zap, BookOpen, Filter, School } from 'lucide-react';
import { StudentStats, Class } from '../types';
import { getStudents, syncWithServer } from '../services/studentService';
import { playClick } from '../services/audioService';
import { useAuth } from '../context/AuthContext';

export const LeaderboardPage: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const [students, setStudents] = useState<StudentStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<Class[]>([]);

    // Khởi tạo classId từ localStorage hoặc mặc định 'ALL' cho GV
    const [classId, setClassId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // Tải vai trò hiện tại
            const role = localStorage.getItem('current_role');
            const isTeacher = role === 'teacher' || !!user;

            let savedClassId = localStorage.getItem('student_class_id') || localStorage.getItem('teacher_class_id');

            // Nếu là GV và chưa có classId cụ thể, mặc định là ALL
            if (isTeacher && !savedClassId) {
                savedClassId = 'ALL';
            } else if (!savedClassId) {
                savedClassId = 'DEFAULT';
            }

            setClassId(savedClassId);

            // Tải danh sách lớp nếu là GV
            if (isTeacher) {
                const storedClasses = localStorage.getItem('classes');
                if (storedClasses) {
                    try {
                        setClasses(JSON.parse(storedClasses));
                    } catch (e) {
                        console.error("Lỗi parse classes", e);
                    }
                }
            }

            setLoading(true);
            await syncWithServer(savedClassId);
            setStudents(getStudents());
            setLoading(false);
        };
        init();
    }, [user]);

    const handleClassChange = async (newId: string) => {
        playClick();
        setClassId(newId);
        setLoading(true);
        await syncWithServer(newId);
        setStudents(getStudents());
        setLoading(false);

        // Lưu lại lựa chọn
        if (localStorage.getItem('current_role') === 'teacher') {
            localStorage.setItem('teacher_class_id', newId);
        } else {
            localStorage.setItem('student_class_id', newId);
        }
    };

    // CATEGORY 1: SIÊU SAO ĐIỂM SỐ (Average Score)
    const topScoreStudents = useMemo(() => {
        return [...students]
            .filter(s => (s.averageScore || 0) > 0)
            .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0) || (b.completedLessons || 0) - (a.completedLessons || 0))
            .slice(0, 10); // Tăng lên 10 cho bảng vàng "đa lớp"
    }, [students]);

    // CATEGORY 2: ONG CHĂM CHỈ (Completed Lessons)
    const topDiligentStudents = useMemo(() => {
        return [...students]
            .filter(s => (s.completedLessons || 0) > 0)
            .sort((a, b) => (b.completedLessons || 0) - (a.completedLessons || 0) || (b.averageScore || 0) - (a.averageScore || 0))
            .slice(0, 10);
    }, [students]);

    // CATEGORY 3: THẦN TỐC ĐỘ (Reading Speed)
    const topSpeedStudents = useMemo(() => {
        return [...students]
            .filter(s => typeof s.readingSpeed === 'number' && s.readingSpeed > 0)
            .sort((a, b) => (b.readingSpeed as number) - (a.readingSpeed as number))
            .slice(0, 10);
    }, [students]);

    const PoduimItem: React.FC<{ student: StudentStats, rank: number, type: 'score' | 'diligent' | 'speed' }> = ({ student, rank, type }) => {
        let icon = <Trophy className="w-5 h-5 text-yellow-500" />;
        let bgColor = "bg-white";
        let borderColor = "border-gray-100";
        let scoreText = "";

        if (rank === 1) { bgColor = "bg-yellow-50"; borderColor = "border-yellow-200"; icon = <Crown className="w-6 h-6 text-yellow-600 animate-pulse" />; }
        if (rank === 2) { bgColor = "bg-blue-50"; borderColor = "border-blue-200"; icon = <Medal className="w-5 h-5 text-blue-500" />; }
        if (rank === 3) { bgColor = "bg-orange-50"; borderColor = "border-orange-200"; icon = <Medal className="w-5 h-5 text-orange-500" />; }

        if (type === 'score') scoreText = `${student.averageScore}đ`;
        if (type === 'diligent') scoreText = `${student.completedLessons} bài`;
        if (type === 'speed') scoreText = `${student.readingSpeed} t/p`;

        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgColor} ${borderColor} hover:shadow-md transition-all`}>
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center font-bold text-sm text-gray-500">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{student.name}</h4>
                    {classId === 'ALL' && student.classId && (
                        <span className="text-[10px] text-gray-400 font-medium">Lớp: {student.classId}</span>
                    )}
                </div>
                <div className="text-right flex flex-col items-end">
                    <span className="font-bold text-primary text-sm">{scoreText}</span>
                    <div className="mt-0.5">{icon}</div>
                </div>
            </div>
        );
    };

    if (loading || !classId) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Đang tải bảng vàng...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50 p-4 md:p-8 pb-32">
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="text-center relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 opacity-20 pointer-events-none">
                        <Trophy className="w-32 h-32 text-yellow-500" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-500 via-red-500 to-purple-600 mb-2 drop-shadow-sm uppercase tracking-tight">
                        Bảng Vàng Thi Đua
                    </h1>

                    <div className="flex flex-col items-center gap-4 mt-6">
                        {/* Class Selector for Teacher */}
                        {(classes.length > 0 || localStorage.getItem('current_role') === 'teacher') ? (
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-blue-100">
                                <School className="w-4 h-4 text-primary" />
                                <span className="text-sm font-bold text-gray-600">Phạm vi:</span>
                                <select
                                    value={classId}
                                    onChange={(e) => handleClassChange(e.target.value)}
                                    className="bg-transparent border-none text-primary font-black focus:ring-0 cursor-pointer outline-none text-sm"
                                >
                                    <option value="ALL">Tất cả lớp học</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                                    ))}
                                    <option value="DEFAULT">Lớp mặc định</option>
                                </select>
                            </div>
                        ) : (
                            <p className="text-gray-600 font-medium bg-white/50 px-4 py-1 rounded-full border border-blue-50">
                                Đang vinh danh các ngôi sao lớp <span className="text-primary font-bold">{classId}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Giọng Đọc Vàng */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-yellow-100/50 border-4 border-yellow-50 relative overflow-hidden group">
                        <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Star className="w-40 h-40 text-yellow-500" />
                        </div>
                        <h2 className="text-xl font-black text-yellow-600 mb-6 flex items-center gap-3 relative z-10 uppercase">
                            <div className="w-10 h-10 bg-yellow-100 rounded-2xl flex items-center justify-center">
                                <Star className="w-6 h-6 fill-yellow-500 text-yellow-500" />
                            </div>
                            Giọng Đọc Vàng
                        </h2>
                        <div className="space-y-3 relative z-10">
                            {topScoreStudents.map((s, i) => (
                                <PoduimItem key={s.id} student={s} rank={i + 1} type="score" />
                            ))}
                            {topScoreStudents.length === 0 && <p className="text-gray-400 text-center py-10 font-medium italic">Chưa có dữ liệu</p>}
                        </div>
                    </div>

                    {/* Ong Chăm Chỉ */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-blue-100/50 border-4 border-blue-50 relative overflow-hidden group">
                        <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <BookOpen className="w-40 h-40 text-blue-500" />
                        </div>
                        <h2 className="text-xl font-black text-blue-600 mb-6 flex items-center gap-3 relative z-10 uppercase">
                            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                                <BookOpen className="w-6 h-6 fill-blue-500 text-blue-500" />
                            </div>
                            Ong Chăm Chỉ
                        </h2>
                        <div className="space-y-3 relative z-10">
                            {topDiligentStudents.map((s, i) => (
                                <PoduimItem key={s.id} student={s} rank={i + 1} type="diligent" />
                            ))}
                            {topDiligentStudents.length === 0 && <p className="text-gray-400 text-center py-10 font-medium italic">Chưa có dữ liệu</p>}
                        </div>
                    </div>

                    {/* Thần Tốc Độ */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-red-100/50 border-4 border-red-50 relative overflow-hidden group">
                        <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap className="w-40 h-40 text-red-500" />
                        </div>
                        <h2 className="text-xl font-black text-red-600 mb-6 flex items-center gap-3 relative z-10 uppercase">
                            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center">
                                <Zap className="w-6 h-6 fill-red-500 text-red-500" />
                            </div>
                            Thần Tốc Độ
                        </h2>
                        <div className="space-y-3 relative z-10">
                            {topSpeedStudents.map((s, i) => (
                                <PoduimItem key={s.id} student={s} rank={i + 1} type="speed" />
                            ))}
                            {topSpeedStudents.length === 0 && <p className="text-gray-400 text-center py-10 font-medium italic">Chưa có dữ liệu</p>}
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-8">
                    <button
                        onClick={() => { playClick(); window.history.back(); }}
                        className="bg-white text-gray-700 px-10 py-4 rounded-full font-black shadow-lg border-2 border-gray-100 hover:border-primary hover:text-primary transform hover:scale-105 transition-all text-lg flex items-center gap-2 group"
                    >
                        Quay Lại
                    </button>
                </div>
            </div>
        </div>
    );
};
