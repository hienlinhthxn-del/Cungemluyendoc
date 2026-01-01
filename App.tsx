import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';
import { Users, GraduationCap, Baby, Lock } from 'lucide-react';
import { playClick } from './services/audioService';
import { initializeStudentsIfEmpty } from './services/studentService';
import { ErrorBoundary } from './components/ErrorBoundary';

const LOCAL_STORAGE_KEYS = {
  CURRENT_ROLE: 'current_role',
};

const RoleSelector: React.FC<{ onSelect: (role: UserRole) => void }> = ({ onSelect }) => {
  const navigate = useNavigate();

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
          onClick={() => { playClick(); navigate('/login'); }}
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
    </div>
  );
};

const AppContent: React.FC = () => {
  const [role, setRole] = useState<UserRole | null | undefined>(undefined);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedRole = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE);

    // If authenticated teacher, set role automatically
    if (isAuthenticated && user) {
      setRole(UserRole.TEACHER);
      localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE, UserRole.TEACHER);
    } else if (savedRole === UserRole.TEACHER) {
      // Teachers MUST be authenticated. If role is teacher but not authenticated, 
      // we don't set the role but stay on null (or redirect).
      // However, we can try to re-hydrate from localStorage if the token is there.
      // AuthContext handles re-hydration on mount, so if it's NOT authenticated now,
      // it means the token is truly missing or invalid.
      setRole(undefined); // Wait for AuthContext to settle
    } else if (savedRole) {
      setRole(savedRole as UserRole);
    } else {
      setRole(null);
    }
  }, [isAuthenticated, user]);

  // Secondary effect to handle redirections for teachers
  useEffect(() => {
    if (role === undefined) return;

    if (role === UserRole.TEACHER && !isAuthenticated) {
      console.warn("Teacher session missing. Redirecting to login.");
      setRole(null);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE);
      navigate('/login');
    }
  }, [role, isAuthenticated, navigate]);

  useEffect(() => {
    if (role && !isAuthenticated && role !== UserRole.TEACHER) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE, role);
    } else if (role === null) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_ROLE);
    }
  }, [role, isAuthenticated]);

  useEffect(() => {
    initializeStudentsIfEmpty();
  }, []);

  const handleLogout = () => {
    if (role === UserRole.TEACHER) {
      logout(); // Full auth logout
    }
    setRole(null);
    navigate('/');
  };

  if (role === undefined) {
    return <div className="min-h-screen bg-blue-50 flex items-center justify-center"><p>Đang khởi động ứng dụng...</p></div>;
  }

  // Define default logic based on role, but override if creating a specific route
  const getDefaultRoute = () => {
    switch (role) {
      case UserRole.STUDENT: return '/student';
      case UserRole.TEACHER: return '/teacher';
      case UserRole.PARENT: return '/parent';
      default: return '/';
    }
  };

  return (
    <Layout role={role} onLogout={handleLogout}>
      <ErrorBoundary fallbackMessage="Đã có lỗi nghiêm trọng xảy ra. Vui lòng tải lại trang.">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/teacher" /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/teacher" /> : <RegisterPage />} />

          {/* Main selection screen if no role */}
          <Route path="/" element={role ? <Navigate to={getDefaultRoute()} replace /> : <RoleSelector onSelect={setRole} />} />

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
              <Route path="/student/practice/:id" element={<ReadingPractice />} />
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

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;