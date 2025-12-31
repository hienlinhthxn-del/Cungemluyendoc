import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StudentDashboard } from './pages/StudentDashboard';
import { ReadingPractice } from './pages/ReadingPractice';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AchievementsPage } from './pages/AchievementsPage';
import { ParentDashboard } from './pages/ParentDashboard';
import { ReportsPage } from './pages/ReportsPage';
import { LessonManager } from './pages/LessonManagerPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ClassManagerPage } from './pages/ClassManagerPage';
import { LostAndFoundPage } from './pages/LostAndFoundPage';
import { UserRole } from './types';
import { Users, GraduationCap, Baby, Lock, X, KeyRound, ChevronRight } from 'lucide-react';
import { playClick, playError, playSuccess } from './services/audioService';
import { initializeStudentsIfEmpty } from './services/studentService';
import { ErrorBoundary } from './components/ErrorBoundary';

// Đề xuất: Sử dụng hằng số để tránh "magic strings" và lỗi gõ sai
const LOCAL_STORAGE_KEYS = {
  CURRENT_ROLE: 'current_role',
  TEACHER_PASSWORD: 'teacher_password',
};

const TeacherLoginModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogin: () => void }> = ({ isOpen, onClose, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Lấy mật khẩu mặc định từ biến môi trường, hoặc dùng '123456' nếu chạy local không có env
    const defaultPassword = import.meta.env.VITE_TEACHER_PASSWORD || '123456';
    // Ưu tiên mật khẩu do người dùng đặt trong localStorage, sau đó mới đến mật khẩu mặc định.
    const correctPassword =
      localStorage.getItem(LOCAL_STORAGE_KEYS.TEACHER_PASSWORD) ||
      defaultPassword;

    if (password === correctPassword) {
      playSuccess();
      onLogin();
    } else {
      playError();
      setError('Mật khẩu không đúng. Vui lòng thử lại.');
    }
  };

  const handleForgotPassword = () => {
    playClick();
    const isConfirmed = window.confirm(
      'Bạn có chắc chắn muốn đặt lại mật khẩu về mặc định không?\nHành động này sẽ xoá mật khẩu tuỳ chỉnh bạn đã đặt.'
    );

    if (isConfirmed) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.TEACHER_PASSWORD);
      playSuccess();
      alert('Mật khẩu đã được đặt lại về mặc định. Bây giờ bạn có thể đăng nhập bằng mật khẩu mặc định.');
      setPassword(''); // Clear the input field
      setError('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl relative transform transition-all scale-100">
        <button
          onClick={() => { playClick(); onClose(); }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Đăng Nhập Giáo Viên</h2>
          <p className="text-sm text-gray-500 mt-1">Vui lòng nhập mật khẩu để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                placeholder="Nhập mật khẩu..."
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-xs mt-2 ml-1 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            Truy cập
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-gray-500 hover:text-primary hover:underline focus:outline-none"
          >
            Quên mật khẩu?
          </button>
        </div>


      </div>
    </div>
  );
};

const RoleSelector: React.FC<{ onSelect: (role: UserRole) => void }> = ({ onSelect }) => {
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-lg">
          R
        </div>
        <h1 className="text-4xl font-bold text-blue-900 mb-2">ReadBuddy</h1>
        <p className="text-gray-600">Chọn vai trò để tiếp tục</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <button
          onClick={() => { playClick(); onSelect(UserRole.STUDENT); }}
          className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-primary group"
        >
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
            <Baby className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Học Sinh</h3>
          <p className="text-sm text-gray-500 mt-2">Em muốn luyện đọc</p>
        </button>

        <button
          onClick={() => { playClick(); setShowTeacherLogin(true); }}
          className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-green-500 group relative"
        >
          <div className="absolute top-4 right-4">
            <Lock className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" />
          </div>
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-200 transition-colors">
            <GraduationCap className="w-12 h-12 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Giáo Viên</h3>
          <p className="text-sm text-gray-500 mt-2">Quản lý lớp học</p>
        </button>

        <button
          onClick={() => { playClick(); onSelect(UserRole.PARENT); }}
          className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-orange-500 group"
        >
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-orange-200 transition-colors">
            <Users className="w-12 h-12 text-orange-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Phụ Huynh</h3>
          <p className="text-sm text-gray-500 mt-2">Theo dõi con học</p>
        </button>
      </div>

      {/* Teacher Login Modal */}
      <TeacherLoginModal
        isOpen={showTeacherLogin}
        onClose={() => setShowTeacherLogin(false)}
        onLogin={() => onSelect(UserRole.TEACHER)}
      />
    </div>
  );
};

const App: React.FC = () => {
  // Khởi tạo state từ localStorage để ghi nhớ vai trò người dùng
  // Khởi tạo là `undefined` để biết đang chờ tải từ client.
  const [role, setRole] = useState<UserRole | null | undefined>(undefined);

  useEffect(() => {
    // Tải vai trò từ localStorage một cách an toàn ở phía client.
    const savedRole = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE);
    setRole(savedRole ? (savedRole as UserRole) : null);
  }, []);
  // Khi role thay đổi, lưu lại vào localStorage
  useEffect(() => {
    if (role) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE, role);
    } else {
      // Khi đăng xuất (role là null), xoá luôn để quay về màn hình chọn vai trò
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE);
    }
  }, [role]); // Chạy khi role thay đổi (trừ lần đầu là undefined)

  // Initialize data on first load
  useEffect(() => {
    initializeStudentsIfEmpty();
  }, []);

  const handleLogout = () => {
    setRole(null);
  };

  // Hiển thị màn hình tải trong khi chờ đọc localStorage
  if (role === undefined) {
    return <div className="min-h-screen bg-blue-50 flex items-center justify-center"><p>Đang khởi động ứng dụng...</p></div>;
  }
  if (role === null) {
    return <RoleSelector onSelect={setRole} />;
  }

  const getDefaultRoute = () => {
    switch (role) {
      case UserRole.STUDENT: return '/student';
      case UserRole.TEACHER: return '/teacher';
      case UserRole.PARENT: return '/parent';
      default: return '/';
    }
  };

  return (
    <Router>
      <Layout role={role} onLogout={handleLogout}>
        <ErrorBoundary fallbackMessage="Đã có lỗi nghiêm trọng xảy ra trong ứng dụng. Vui lòng thử tải lại trang.">
          <Routes>
            <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />

            {role === UserRole.STUDENT && (
              <>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/practice/:id" element={<ReadingPractice />} />
                <Route path="/achievements" element={<AchievementsPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
              </>
            )}

            {role === UserRole.TEACHER && (
              <>
                <Route path="/teacher" element={<TeacherDashboard />} />
                <Route path="/teacher/lessons" element={<LessonManager />} />
                <Route path="/teacher/classes" element={<ClassManagerPage />} />
                <Route path="/teacher/reports" element={<ReportsPage />} />
                <Route path="/teacher/lost-and-found" element={<LostAndFoundPage onBack={() => window.history.back()} />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
              </>
            )}

            {role === UserRole.PARENT && (
              <>
                <Route path="/parent" element={<ParentDashboard />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/achievements" element={<AchievementsPage />} />
              </>
            )}

            {/* Fallback: Redirect to user's default route if they try to access a wrong page */}
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
};

export default App;