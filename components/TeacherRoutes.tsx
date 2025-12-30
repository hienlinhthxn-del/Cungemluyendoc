import React from 'react';
import { Route } from 'react-router-dom';
import { TeacherDashboard } from '../pages/TeacherDashboard';
import { ReportsPage } from '../pages/ReportsPage';
import { LessonManager } from '../pages/LessonManagerPage';
import { ClassManagerPage } from '../pages/ClassManagerPage';
import { LostAndFoundPage } from '../pages/LostAndFoundPage';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { ReadingPractice } from '../pages/ReadingPractice';
import { ErrorBoundary } from './ErrorBoundary';

export const TeacherRoutes = () => (
  <>
    <Route
      path="/teacher"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải Bảng điều khiển Giáo viên. Vui lòng thử lại.">
          <TeacherDashboard />
        </ErrorBoundary>
      }
    />
    <Route
      path="/teacher/reports"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang báo cáo. Vui lòng thử lại.">
          <ReportsPage />
        </ErrorBoundary>
      }
    />
    <Route
      path="/teacher/lessons"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang quản lý bài học. Vui lòng thử lại.">
          <LessonManager />
        </ErrorBoundary>
      }
    />
    <Route
      path="/teacher/classes"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang quản lý lớp học. Vui lòng thử lại.">
          <ClassManagerPage />
        </ErrorBoundary>
      }
    />
    <Route
      path="/teacher/lost-and-found"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang đồ thất lạc. Vui lòng thử lại.">
          <LostAndFoundPage onBack={() => window.history.back()} />
        </ErrorBoundary>
      }
    />
    <Route
      path="/leaderboard"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải bảng xếp hạng. Vui lòng thử lại.">
          <LeaderboardPage />
        </ErrorBoundary>
      }
    />
    {/* Cho phép giáo viên truy cập trang luyện đọc để sửa giọng đọc mẫu */}
    <Route
      path="/student/practice/:id"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang luyện đọc để chỉnh sửa. Vui lòng thử lại.">
          <ReadingPractice />
        </ErrorBoundary>
      }
    />
  </>
);