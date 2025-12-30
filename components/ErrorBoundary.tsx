import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallbackMessage: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

// Lớp bảo vệ để bắt lỗi render trong các component con
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Cập nhật state để lần render tiếp theo sẽ hiển thị UI dự phòng.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Bạn cũng có thể log lỗi này tới một dịch vụ báo cáo lỗi
    console.error("Lỗi không bắt được trong component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Giao diện dự phòng khi có lỗi
      return (
        <div className="m-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
          <h2 className="font-bold text-lg mb-2">Đã có lỗi xảy ra</h2>
          <p>{this.props.fallbackMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          >
            Tải lại trang
          </button>
          {/* Chỉ hiển thị chi tiết lỗi trong môi trường development */}
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 text-xs whitespace-pre-wrap bg-red-50 p-2 rounded">
              <code>
                {this.state.error.toString()}
                <br />
                {this.state.error.stack}
              </code>
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}