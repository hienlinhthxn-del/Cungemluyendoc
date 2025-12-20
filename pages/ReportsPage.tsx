import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { Download, Trophy, AlertCircle, TrendingUp, Users } from 'lucide-react';
import { StudentStats } from '../types';
import { getStudents, syncWithServer } from '../services/studentService';
import { LESSONS } from '../constants';

export const ReportsPage: React.FC = () => {
    const [students, setStudents] = useState<StudentStats[]>([]);
    const [classId] = useState(() => localStorage.getItem('teacher_class_id') || 'DEFAULT');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await syncWithServer(classId);
            setStudents(getStudents());
            setLoading(false);
        };
        fetchData();
    }, [classId]);

    // Thống kê số lượng bài nộp theo tuần
    const weeklySubmissionData = useMemo(() => {
        // Lấy danh sách các tuần từ bài học
        const weeks = Array.from(new Set(LESSONS.map(l => l.week))).sort((a, b) => a - b);

        return weeks.map(week => {
            const submittedCount = students.filter(s =>
                s.history.some(h => h.week === week && h.score > 0)
            ).length;

            return {
                name: `Tuần ${week}`,
                nopBai: submittedCount,
                chuaNop: students.length - submittedCount
            };
        });
    }, [students]);

    // Top học sinh xuất sắc (dựa trên điểm trung bình)
    const topStudents = useMemo(() => {
        return [...students]
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 3);
    }, [students]);

    // Học sinh cần cố gắng (điểm TB dưới 5 hoặc chưa làm bài nào)
    const strugglingStudents = useMemo(() => {
        return students.filter(s => s.averageScore < 5 || s.history.length === 0);
    }, [students]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    const handleExportFullReport = () => {
        // Logic xuất Excel toàn bộ
        const headers = ["ID", "Họ Tên", "Điểm TB", "Số Bài Đã Làm", "Tốc Độ Đọc"];
        const rows = students.map(s => [
            s.id,
            `"${s.name}"`,
            s.averageScore,
            s.completedLessons,
            `"${s.readingSpeed}"`
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Bao_Cao_Tong_Ket_${classId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu báo cáo...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Học Tập - Lớp {classId}</h1>
                    <p className="text-gray-500">Tổng quan tình hình học tập của cả lớp</p>
                </div>
                <button
                    onClick={handleExportFullReport}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm transition-all"
                >
                    <Download className="w-4 h-4 mr-2" /> Xuất Báo Cáo Tổng Hợp
                </button>
            </div>

            {/* TOP CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-full">
                            <Users className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="opacity-80">Tổng Số Học Sinh</p>
                            <h2 className="text-3xl font-bold">{students.length}</h2>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-full">
                            <TrendingUp className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="opacity-80">Điểm TB Cả Lớp</p>
                            <h2 className="text-3xl font-bold">
                                {students.length > 0
                                    ? Math.round(students.reduce((acc, s) => acc + s.averageScore, 0) / students.length)
                                    : 0}
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-full">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="opacity-80">Học Sinh Cần Lưu Ý</p>
                            <h2 className="text-3xl font-bold">{strugglingStudents.length}</h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Biểu đồ nộp bài */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Tình Hình Nộp Bài Theo Tuần</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={weeklySubmissionData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="nopBai" name="Đã Nộp" fill="#4ade80" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="chuaNop" name="Chưa Nộp" fill="#f87171" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top Học Sinh */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Top 3 Học Sinh Xuất Sắc
                    </h3>
                    <div className="space-y-4">
                        {topStudents.map((student, index) => (
                            <div key={student.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md
                      ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{student.name}</p>
                                        <p className="text-xs text-gray-500">Điểm TB: {student.averageScore}</p>
                                    </div>
                                </div>
                                <Trophy className={`w-6 h-6 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-400'}`} />
                            </div>
                        ))}
                        {topStudents.length === 0 && <p className="text-center text-gray-500">Chưa có dữ liệu</p>}
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Cần Cố Gắng Thêm ({strugglingStudents.length})
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {strugglingStudents.map(student => (
                                <div key={student.id} className="flex justify-between items-center p-2 hover:bg-red-50 rounded transition-colors text-sm">
                                    <span className="text-gray-700 font-medium">{student.name}</span>
                                    <span className="text-red-500 font-bold">{student.averageScore === 0 ? 'Chưa học' : `Điểm: ${student.averageScore}`}</span>
                                </div>
                            ))}
                            {strugglingStudents.length === 0 && <p className="text-green-600 text-sm">Cả lớp đều học tốt!</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
