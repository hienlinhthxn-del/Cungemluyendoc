
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MOCK_STUDENTS } from '../constants';
import { Trophy, TrendingUp, Calendar, MessageCircle, PlayCircle, Search, User, ArrowLeft, Edit2, Check, X, Send, ExternalLink } from 'lucide-react';
import { StudentStats } from '../types';
import { playClick, playSuccess } from '../services/audioService';
import { getCommunications, saveCommunication, Communication } from '../services/communicationService';

import { getStudents, syncWithServer } from '../services/studentService';

export const ParentDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentStats[]>(() => getStudents());
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(null); // Khởi tạo là null
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation(); // Lấy object location để đọc query params

  // Teacher Name State
  const [teacherName, setTeacherName] = useState('Cô giáo Hiền');
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [tempTeacherName, setTempTeacherName] = useState('');

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Communications State
  const [teacherMessages, setTeacherMessages] = useState<Communication[]>([]);

  React.useEffect(() => {
    // Load messages from teacher
    if (selectedStudent) {
      const allComms = getCommunications();
      const messages = allComms.filter(c =>
        c.sender === 'TEACHER' &&
        (c.studentId === selectedStudent.id || !c.studentId) // Specific or Broadcast
      );
      setTeacherMessages(messages);
    }
  }, [selectedStudent]);

  // Effect này sẽ xử lý việc chọn học sinh từ URL hoặc localStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studentIdFromUrl = params.get('studentId');
    const allStudents = getStudents(); // Lấy danh sách học sinh mới nhất

    let studentToSelect: StudentStats | undefined;

    if (studentIdFromUrl) {
      // Ưu tiên 1: Lấy ID học sinh từ URL
      studentToSelect = allStudents.find(s => s.id === studentIdFromUrl);
    } else {
      // Ưu tiên 2: Lấy ID từ localStorage (hành vi cũ)
      const savedId = localStorage.getItem('current_student_id');
      if (savedId) {
        studentToSelect = allStudents.find(s => s.id === savedId);
      }
    }

    if (studentToSelect) {
      setSelectedStudent(studentToSelect);
    }
  }, [location.search]); // Chạy lại khi URL thay đổi

  // Initial Sync for Parent (Fetch ALL students so search works)
  useEffect(() => {
    syncWithServer();
  }, []);

  useEffect(() => {
    // Refresh student data when opening, so we see latest scores
    const loadData = () => {
      setStudents(getStudents());
      if (selectedStudent) {
        // Update the currently viewed student as well to reflect new history
        const fresh = getStudents().find(s => s.id === selectedStudent.id);
        if (fresh) setSelectedStudent(fresh);
      }
    };

    window.addEventListener('students_updated', loadData);
    return () => window.removeEventListener('students_updated', loadData);
  }, [selectedStudent]);

  // Lọc danh sách học sinh khi tìm kiếm
  const filteredStudents = useMemo(() => students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [searchTerm, students]);

  // Tạo lời chào cá nhân hóa dựa trên thời gian và tên bé
  const getGreeting = (name: string) => {
    const hour = new Date().getHours();
    let timeGreeting = "Chào buổi sáng";
    if (hour >= 12 && hour < 18) timeGreeting = "Chào buổi chiều";
    if (hour >= 18) timeGreeting = "Buổi tối vui vẻ nhé";

    // Các câu nhắn nhủ ngẫu nhiên kèm theo
    const messages = [
      `Hôm nay bé ${name} đã học rất chăm chỉ!`,
      `Đừng quên nhắc bé ${name} ôn bài nhé!`,
      `Cùng xem thành tích tuyệt vời của ${name} nào!`,
      `Bé ${name} đang tiến bộ từng ngày đấy!`
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    return { timeGreeting, randomMsg };
  };

  const startEditingTeacher = () => {
    playClick();
    setTempTeacherName(teacherName);
    setIsEditingTeacher(true);
  };

  const saveTeacherName = () => {
    playClick();
    if (tempTeacherName.trim()) {
      setTeacherName(tempTeacherName);
    }
    setIsEditingTeacher(false);
  };

  const cancelEditingTeacher = () => {
    playClick();
    setIsEditingTeacher(false);
  };

  // --- TÍNH TOÁN DỮ LIỆU ĐỘNG (PHẢI ĐẶT TRƯỚC RETURN CÓ ĐIỀU KIỆN) ---
  const latestWeekRecord = useMemo(() => {
    if (!selectedStudent?.history || selectedStudent.history.length === 0) {
      return null;
    }
    // Sắp xếp lịch sử nộp bài theo tuần giảm dần và lấy bài đầu tiên
    return [...selectedStudent.history].sort((a, b) => b.week - a.week)[0];
  }, [selectedStudent]);

  const displayScore = latestWeekRecord ? latestWeekRecord.score : 0;
  const displayWeek = latestWeekRecord ? latestWeekRecord.week : '...';
  const displaySpeed = latestWeekRecord ? latestWeekRecord.speed : 0;

  // Phải bọc trong useMemo để xử lý trường hợp selectedStudent là null
  const { timeGreeting, randomMsg } = useMemo(() => {
    if (!selectedStudent) return { timeGreeting: '', randomMsg: '' };
    return getGreeting(selectedStudent.name);
  }, [selectedStudent, getGreeting]);

  const handleSendFeedback = () => {
    if (!feedbackMessage.trim() || !selectedStudent) return;

    playSuccess();

    saveCommunication({
      id: Date.now().toString(),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      sender: 'PARENT',
      content: feedbackMessage,
      type: 'FEEDBACK',
      timestamp: Date.now(),
      read: false
    });

    alert(`Đã gửi tin nhắn thành công đến ${teacherName}!\nNội dung: "${feedbackMessage}"`);

    setFeedbackMessage('');
    setIsFeedbackModalOpen(false);
  };

  // Màn hình chọn con (Giả lập đăng nhập phụ huynh)
  if (!selectedStudent) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Phụ huynh của bé nào đây ạ?</h1>
          <p className="text-gray-500">Vui lòng chọn tên con để xem báo cáo học tập</p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Nhập tên bé để tìm nhanh..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Student Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredStudents.map(student => (
            <button
              key={student.id}
              onClick={() => {
                playClick();
                setSelectedStudent(student);
                localStorage.setItem('current_student_id', student.id);
              }}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-4 text-left group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-primary font-bold text-lg group-hover:bg-primary group-hover:text-white transition-colors">
                {student.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-800 group-hover:text-primary transition-colors">{student.name}</p>
                <p className="text-xs text-gray-500">Lớp {student.classId || '1A3'}</p>
              </div>
            </button>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            Không tìm thấy học sinh nào tên "{searchTerm}"
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up relative">
      {/* Back Button */}
      <button
        onClick={() => setSelectedStudent(null)}
        className="flex items-center text-gray-500 hover:text-primary transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Chọn bé khác
      </button>

      {/* Greeting Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl border-4 border-blue-50">
            🧒
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {timeGreeting}, Phụ huynh bé <span className="text-primary">{selectedStudent.name}</span>!
            </h1>
            <p className="text-gray-500">{randomMsg}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wide">Trường Tiểu Học Tủa Chùa</p>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <span className="inline-block bg-secondary text-blue-900 px-4 py-2 rounded-full font-bold shadow-sm mb-1">
            Tuần {displayWeek}
          </span>
          <p className="text-sm text-gray-500">Dữ liệu cập nhật mới nhất</p>
        </div>
      </div>

      {teacherMessages.some(m => m.type === 'HOMEWORK' && !m.read) && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r flex items-center justify-between">
          <div>
            <p className="text-orange-800 font-bold">📢 Thông báo mới</p>
            <p className="text-orange-700 text-sm">Giáo viên vừa giao bài tập mới cho bé. Phụ huynh vui lòng kiểm tra bên dưới.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transform hover:scale-[1.02] transition-transform">
          <Trophy className="absolute top-4 right-4 w-24 h-24 text-white opacity-10 rotate-12" />
          <h3 className="text-lg font-medium opacity-90 mb-1">Điểm Tuần Gần Nhất</h3>
          <p className="text-5xl font-bold mb-4">{displayScore}</p>

          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-white/20 p-2 rounded-lg w-full backdrop-blur-sm">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                {displayScore >= 80 ? 'Tiến bộ vượt bậc!' : 'Cần cố gắng thêm chút nữa.'}
              </span>
            </div>
            {displaySpeed > 0 && (
              <div className="flex items-center gap-2 bg-white/20 p-2 rounded-lg w-full backdrop-blur-sm">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Tốc độ đọc: {displaySpeed} tiếng/phút
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Hoạt động gần đây
          </h3>
          <div className="space-y-4">
            {[...selectedStudent.history].sort((a, b) => b.week - a.week).slice(0, 3).map((record, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                <div className="p-2 bg-blue-50 rounded-lg text-primary">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">Kết quả Tuần {record.week}</p>
                  <p className="text-xs text-gray-500">Tốc độ: {record.speed} tiếng/phút</p>
                </div>
                <span className={`font-bold text-sm ${record.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                  {record.score}đ
                </span>
              </div>
            ))}
            {selectedStudent.history.length === 0 && (
              <p className="text-gray-400 text-sm italic">Chưa có dữ liệu hoạt động.</p>
            )}
          </div>
        </div>
      </div>

      {/* Teacher Feedback */}
      <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
        <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Nhắn nhủ từ Giáo viên
        </h3>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <p className="text-gray-700 italic">
            {displayScore >= 80
              ? `"Tuần này bé ${selectedStudent.name} đọc rất tốt, to và rõ ràng. Gia đình hãy tiếp tục động viên bé phát huy nhé!"`
              : `"Bé ${selectedStudent.name} cần luyện đọc thêm ở nhà. Nhờ phụ huynh dành 15 phút mỗi tối để cùng bé luyện tập."`
            }
          </p>

          {/* In-App Messages from Teacher */}
          {teacherMessages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              {teacherMessages.slice(0, 3).map(msg => (
                <div key={msg.id} className="bg-orange-100/50 p-3 rounded-lg text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-orange-800 text-xs">
                      {msg.type === 'HOMEWORK' ? 'BÀI TẬP VỀ NHÀ' : 'NHẮN NHỦ'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(msg.timestamp).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <p className="text-gray-700">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end items-center mt-2 h-8">
            {isEditingTeacher ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  value={tempTeacherName}
                  onChange={(e) => setTempTeacherName(e.target.value)}
                  className="border border-orange-300 rounded px-2 py-1 text-xs text-gray-700 w-32 focus:ring-1 focus:ring-orange-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveTeacherName()}
                />
                <button onClick={saveTeacherName} className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors" title="Lưu">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEditingTeacher} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Hủy">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer p-1 rounded hover:bg-orange-50 transition-colors" onClick={startEditingTeacher}>
                <p className="text-right text-xs text-gray-400 group-hover:text-orange-600 transition-colors font-medium">- {teacherName}</p>
                <Edit2 className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => { playClick(); setIsFeedbackModalOpen(true); }}
            className="text-orange-700 font-bold text-sm hover:underline flex items-center gap-1"
          >
            Gửi phản hồi cho cô giáo &rarr;
          </button>
        </div>
      </div>

      {/* Feedback Modal */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Nhắn tin cho {teacherName}
              </h3>
              <button onClick={() => setIsFeedbackModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Phụ huynh có thắc mắc hoặc cần trao đổi gì về việc học của bé <b>{selectedStudent.name}</b> không ạ?
              </p>
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="w-full border border-gray-300 rounded-xl p-3 h-32 outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSendFeedback}
                  disabled={!feedbackMessage.trim()}
                  className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Gửi tin nhắn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
