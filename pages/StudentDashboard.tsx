import React, { useRef, useState, useMemo, useEffect } from 'react';
import { LESSONS, MOCK_STUDENTS } from '../constants';
import { Link } from 'react-router-dom';
import { BookOpen, Star, ChevronRight, RotateCcw, Bell, User } from 'lucide-react';
import { playClick } from '../services/audioService';
import { getCommunications, Communication, saveCommunication } from '../services/communicationService';
import { StudentStats } from '../types';

import { getStudents } from '../services/studentService';

export const StudentDashboard: React.FC = () => {
  // Load students from service
  const [students, setStudents] = useState<StudentStats[]>(() => getStudents());

  // Student Selection State
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(() => {
    const savedId = localStorage.getItem('current_student_id');
    const currentStudents = getStudents();
    return currentStudents.find(s => s.id === savedId) || null;
  });

  // Reload data when component mounts to ensure we have latest achievements
  useEffect(() => {
    setStudents(getStudents());
    if (selectedStudent) {
      // Refresh selected student data too
      const freshData = getStudents().find(s => s.id === selectedStudent.id);
      if (freshData) setSelectedStudent(freshData);
    }
  }, []);

  const handleSelectStudent = (student: StudentStats) => {
    playClick();
    setSelectedStudent(student);
    localStorage.setItem('current_student_id', student.id);
  };

  const handeLogout = () => {
    setSelectedStudent(null);
    localStorage.removeItem('current_student_id');
  };
  const [searchTerm, setSearchTerm] = useState('');

  // Notifications State


  // Filter similar to parent dashboard
  const filteredStudents = useMemo(() => students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  ), [searchTerm, students]);

  const currentStudent = selectedStudent || students[0] || MOCK_STUDENTS[0]; // Fallback

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
      // Filter for unread homework assigned to this student or broadcast
      const homeworks = allComms.filter(c =>
        c.type === 'HOMEWORK' &&
        (c.studentId === selectedStudent?.id || !c.studentId) &&
        !c.read
      );
      setNewHomeworks(homeworks);
    };

    loadHomeworks();
    window.addEventListener('communications_updated', loadHomeworks);
    // Also listen to storage events for cross-tab syncing if needed, though communications_updated covers same-tab
    window.addEventListener('storage', loadHomeworks);

    return () => {
      window.removeEventListener('communications_updated', loadHomeworks);
      window.removeEventListener('storage', loadHomeworks);
    };
  }, [selectedStudent]);



  if (!selectedStudent) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Chào bạn nhỏ! Bạn tên là gì?</h1>
          <p className="text-gray-500">Chọn tên của mình để bắt đầu học nhé</p>
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
                <p className="text-xs text-gray-500">Lớp 1A3</p>
              </div>
            </button>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            Không tìm thấy bạn nào tên "{searchTerm}"
          </div>
        )}
      </div>
    );
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
        <button onClick={handeLogout} className="text-sm text-primary hover:underline">Chuyển tài khoản</button>
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
            <span className="font-bold">{currentStudent.completedLessons} Bài đã học</span>
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
          {[...LESSONS].sort((a, b) => a.week - b.week).map((lesson, index) => {
            // Determine completion based on index vs completed count
            const isCompleted = index < currentStudent.completedLessons;

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
