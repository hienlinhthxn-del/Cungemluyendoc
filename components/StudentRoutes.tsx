import React from 'react';
import { Route } from 'react-router-dom';
import { StudentDashboard } from '../pages/StudentDashboard';
import { ReadingPractice } from '../pages/ReadingPractice';
import { AchievementsPage } from '../pages/AchievementsPage';
import { LeaderboardPage } from '../pages/LeaderboardPage';
import { ErrorBoundary } from './ErrorBoundary';

export const StudentRoutes = () => (
  <>
    <Route
      path="/student"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải Bảng điều khiển Học sinh. Vui lòng thử lại.">
          <StudentDashboard />
        </ErrorBoundary>
      }
    />
    <Route
      path="/student/practice/:id"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang luyện đọc. Vui lòng thử lại.">
          <ReadingPractice />
        </ErrorBoundary>
      }
    />
    <Route
      path="/student/achievements"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải trang thành tích. Vui lòng thử lại.">
          <AchievementsPage />
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
  </>
);