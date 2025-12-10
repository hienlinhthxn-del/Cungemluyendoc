import React, { useState } from 'react';
import { UserRole } from '../types';
import { BookOpen, GraduationCap, Users, Menu, X, LogOut, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const getNavItems = () => {
    switch (role) {
      case UserRole.STUDENT:
        return [
          { label: 'Trang Chủ', icon: Home, path: '/student' },
          { label: 'Thành Tích', icon: GraduationCap, path: '/student/achievements' },
        ];
      case UserRole.TEACHER:
        return [
          { label: 'Lớp Học', icon: Users, path: '/teacher' },
          { label: 'Báo Cáo', icon: BookOpen, path: '/teacher/reports' },
        ];
      case UserRole.PARENT:
        return [
          { label: 'Tiến Độ Của Con', icon: GraduationCap, path: '/parent' },
          { label: 'Liên Hệ GV', icon: Users, path: '/parent/contact' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => window.location.hash = '/'}>
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
                R
              </div>
              <span className="font-bold text-xl text-blue-900 tracking-tight">ReadBuddy</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'text-primary bg-blue-50'
                      : 'text-gray-500 hover:text-primary hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-1.5" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5 mr-1.5" />
                Thoát
              </button>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-md text-base font-medium ${
                    isActive(item.path)
                      ? 'text-primary bg-blue-50'
                      : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center px-3 py-3 rounded-md text-base font-medium text-red-500 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Thoát
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {children}
      </main>
    </div>
  );
};