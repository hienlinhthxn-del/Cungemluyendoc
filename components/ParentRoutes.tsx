import React from 'react';
import { Route } from 'react-router-dom';
import { ParentDashboard } from '../pages/ParentDashboard';
import { ErrorBoundary } from './ErrorBoundary';

export const ParentRoutes = () => (
  <>
    <Route
      path="/parent"
      element={
        <ErrorBoundary fallbackMessage="Không thể tải Bảng điều khiển Phụ huynh. Vui lòng thử lại.">
          <ParentDashboard />
        </ErrorBoundary>
      }
    />
    <Route path="/parent/contact" element={<div className="text-center p-10 text-gray-500">Trang liên hệ đang cập nhật...</div>} />
  </>
);