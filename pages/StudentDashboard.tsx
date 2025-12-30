import React, { useRef, useState, useMemo, useEffect } from 'react';
import { LESSONS as DEFAULT_LESSONS, MOCK_STUDENTS } from '../constants';
import { getLessons } from '../services/lessonService';
import { Lesson } from '../types';
import { Link } from 'react-router-dom';
import { BookOpen, Star, ChevronRight, RotateCcw, Bell, User, School, Trophy } from 'lucide-react';
import { playClick } from '../services/audioService';
import { getCommunications, Communication, saveCommunication } from '../services/communicationService';
import { StudentStats } from '../types';

import { getStudents, syncWithServer } from '../services/studentService';

export const StudentDashboard: React.FC = () => {
  // Class ID State
  // Khởi tạo state với `undefined` để biết đang chờ tải từ client.
  const [classId, setClassId] = useState<string | null | undefined>(undefined);
  const [classInput, setClassInput] = useState('');

  // Load students from service
  // Khởi tạo state rỗng, sẽ được tải trong useEffect.
  const [students, setStudents] = useState<StudentStats[]>([]);

  // Dynamic Lessons
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tải dữ liệu từ localStorage một cách an toàn ở phía client.
    const savedClassId = localStorage.getItem('student_class_id');
    setClassId(savedClassId); // Sẽ là null nếu không có

    const initialStudents = getStudents();
    setStudents(initialStudents);

    // Tải thông tin học sinh đã chọn
    const savedStudentId = localStorage.getItem('current_student_id');
    const studentData = savedStudentId ? initialStudents.find(s => s.id === savedStudentId) : null;
    setSelectedStudent(studentData || null);

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLessons();
        if (data && data.length > 0) setAllLessons(data);
      } catch (err) {
        console.error("Lỗi tải bài học:", err);
        setError("Không thể tải được danh sách bài học. Vui lòng thử lại sau.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Student Selection State
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null | undefined>(undefined);

  // Reload data when component mounts or Class ID changes
  useEffect(() => {
    if (classId) {
      // Tạm thời vô hiệu hóa việc đồng bộ tự động để tránh ghi đè dữ liệu mới nhất
      // được lưu trên máy (ví dụ: điểm của học sinh vừa làm bài).
      // syncWithServer(classId).then(() => {
      //   setStudents(getStudents());
      // });
      setStudents(getStudents()); // Chỉ cần tải từ localStorage là đủ
    } else {
      setStudents(getStudents());
    }

    if (selectedStudent) {
      // Refresh selected student data too
      const freshData = getStudents().find(s => s.id === selectedStudent.id);
      if (freshData) setSelectedStudent(freshData);
    }
  }, [classId]);

  const handleClassSubmit = () => {
    if (classInput.trim()) {
      playClick();
      localStorage.setItem('student_class_id', classInput.trim());
      setClassId(classInput.trim());
    }
  };

  const handleSelectStudent = (student: StudentStats) => {
    playClick();
    setSelectedStudent(student);
    localStorage.setItem('current_student_id', student.id);
  };

  const handleLogout = () => {
    playClick();
    setSelectedStudent(null);
    localStorage.removeItem('current_student_id');
  };

  const handleExitClass = () => {
    playClick();
    if (window.confirm(`Bạn muốn thoát khỏi lớp ${classId}?`)) {
      localStorage.removeItem('student_class_id');
      setClassId(null);
      setSelectedStudent(null);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  // Filter similar to parent dashboard
  const filteredStudents = useMemo(() => students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [searchTerm, students]);

  const currentStudent = selectedStudent; // Chỉ dùng selectedStudent

  // Danh sách các lời chào ngộ nghĩnh (đã bỏ tên riêng)
  const funGreetings = [
    `Hú hà! Chào siêu nhân nhí nè! 🦸‍♂️`,
    `A lô a lô! Thuyền trưởng đã sẵn sàng ra khơi chưa? 🚢`,
    `Chào bạn nhỏ! Hôm nay mình cùng đi săn chữ cái nhé! 🕵️‍♂️`,
    `Wow! Bé chăm chỉ quá, ong vàng xin chào nha! 🐝`,
    `Ting ting! Bé ơi, cùng khám phá thế giới nào! 🚀`,
    `Chào bạn! Cùng học vui, cười tít mắt nào! 😄`
  ];

  // Chọn ngẫu nhiên một lời chào (giữ nguyên khi re-render trừ khi reload trang)
  const randomGreeting = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * funGreetings.length);
    return funGreetings[randomIndex];
  }, []);

  // Notifications State
  const [newHomeworks, setNewHomeworks] = useState<Communication[]>([]);

  useEffect(() => {
    const loadHomeworks = () => {
      const allComms = getCommunications();
      const homeworks = allComms.filter(c =>
        c.type === 'HOMEWORK' &&
        (c.studentId === selectedStudent?.id || !c.studentId) &&
        !c.read
      );
      setNewHomeworks(homeworks);
    };

    loadHomeworks();
    window.addEventListener('communications_updated', loadHomeworks);
    window.addEventListener('storage', loadHomeworks);

    return () => {
      window.removeEventListener('communications_updated', loadHomeworks);
      window.removeEventListener('storage', loadHomeworks);
    };
  }, [selectedStudent]);

  // SCREEN 1: CLASS SELECTION
  // Chờ cho đến khi classId được tải xong (không còn là undefined)
  if (classId === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 p-4"><p className="text-white">Đang tải...</p></div>;
  }
  if (classId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center space-y-6 animate-fade-in-up">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-4">
            <School className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Chào Mừng Bé!</h1>
          <p className="text-gray-500">Nhập Mã Lớp cô giáo đưa để vào lớp nhé.</p>

          <input
            type="text"
            placeholder="Ví dụ: 1A3"
            className="w-full text-center text-2xl font-bold py-4 border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none transition-all uppercase placeholder:text-gray-300 placeholder:normal-case placeholder:font-normal"
            value={classInput}
            onChange={(e) => setClassInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleClassSubmit()}
          />

          <button
            onClick={handleClassSubmit}
            disabled={!classInput}
            className="w-full py-4 bg-primary text-white text-xl font-bold rounded-xl hover:bg-blue-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vào Lớp Ngay 🚀
          </button>
        </div>
      </div>
    );
  }

  // SCREEN 2: STUDENT SELECTION
  // Thêm điều kiện chờ selectedStudent được tải xong (không còn là undefined)
  if (selectedStudent === undefined) {
    return <div className="text-center p-10">Đang kiểm tra thông tin đăng nhập...</div>;
  }
  if (!selectedStudent && classId) { // Chỉ hiển thị màn hình chọn khi đã có classId
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up relative">
        <button
          onClick={handleExitClass}
          className="absolute top-0 right-0 z-50 px-3 py-1 bg-red-50 text-red-500 rounded-full text-sm font-bold hover:bg-red-100 hover:text-red-700 transition-colors border border-red-100"
          title="Thoát khỏi lớp học này"
        >
          Thoát lớp {classId}
        </button>

        <div className="text-center mb-8 relative">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Chào bạn nhỏ lớp {classId}!</h1>
          <p className="text-gray-500 mb-4">Chọn tên của mình để bắt đầu học nhé</p>

          <button
            onClick={() => { playClick(); window.location.hash = '/leaderboard'; }}
            className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-white font-bold rounded-full shadow-lg border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all"
          >
            <Trophy className="w-5 h-5 animate-bounce" />
            Xem Bảng Vàng
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-8">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Nhập tên mình..."
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
              onClick={() => handleSelectStudent(student)}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center gap-4 text-left group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-primary font-bold text-lg group-hover:bg-primary group-hover:text-white transition-colors">
                {student.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-800 group-hover:text-primary transition-colors">{student.name}</p>
                <p className="text-xs text-gray-500">Lớp {classId}</p>
              </div>
            </button>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            Không tìm thấy bạn nào tên "{searchTerm}" trong lớp {classId}.
            <br />
            <button onClick={() => syncWithServer(classId).then(() => setStudents(getStudents()))} className="text-primary underline mt-2">
              Thử tải lại danh sách
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isLoading || !currentStudent) {
    return <div className="text-center p-10">Đang tải bài học...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Student Profile Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
            {selectedStudent.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-gray-800">{selectedStudent.name}</p>
            <p className="text-xs text-gray-500">Học sinh Lớp 1A3</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { playClick(); window.location.hash = '/leaderboard'; }}
            className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg border border-yellow-300 font-bold text-sm flex items-center gap-2 hover:bg-yellow-200 transition-colors"
            title="Bảng Xếp Hạng"
          >
            <Trophy className="w-4 h-4" /> BXH
          </button>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 hover:underline">Chuyển TK</button>
        </div>
      </div>

      {/* New Homework Notification */}
      {newHomeworks.length > 0 && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 rounded-r shadow-sm animate-pulse flex items-start gap-3">
          <Bell className="w-6 h-6 flex-shrink-0 animate-bounce" />
          <div>
            <p className="font-bold">Có bài tập mới nè!</p>
            <p className="text-sm">{newHomeworks[0].content}</p>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-400 to-primary rounded-2xl p-6 text-white shadow-lg transform transition-all hover:scale-[1.01]">
        <h1 className="text-3xl font-bold mb-2 animate-bounce-short">{randomGreeting}</h1>
        <p className="text-blue-100 text-lg">Hôm nay chúng ta cùng luyện đọc nhé.</p>
        <div className="mt-6 flex gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
            <span className="font-bold">120 Điểm</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-100" />
            <span className="font-bold">{currentStudent?.completedLessons || 0} Bài đã học</span>
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white text-sm">
            📚
          </span>
          Bài Học Của Em
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...allLessons].sort((a, b) => a.week - b.week).map((lesson, index) => {
            // Determine completion based on index vs completed count
            const isCompleted = index < (currentStudent?.completedLessons || 0);

            return (
              <Link
                key={lesson.id}
                to={`/student/practice/${lesson.id}`}
                onClick={() => playClick()}
                className="group relative bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-primary transition-all duration-300 overflow-hidden"
              >
                {/* Week Badge */}
                <div className="absolute top-0 right-0 bg-secondary text-blue-900 font-bold px-3 py-1 rounded-bl-xl text-sm z-10">
                  Tuần {lesson.week}
                </div>

                <div className="p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                    {(index % 3 === 0) ? '🐸' : (index % 3 === 1) ? '🐶' : '🐱'}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">
                    {lesson.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {lesson.description}
                  </p>

                  <div className={`flex items-center font-bold text-sm ${isCompleted ? 'text-green-600' : 'text-primary'}`}>
                    {isCompleted ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Ôn tập lại
                      </>
                    ) : (
                      <>
                        Bắt đầu học <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100">
                  <div
                    className="h-full bg-green-500 rounded-r-full transition-all duration-1000"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  ></div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
