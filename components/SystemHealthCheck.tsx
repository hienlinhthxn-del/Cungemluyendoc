import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const SystemHealthCheck = () => {
  const [health, setHealth] = useState<{ mongo: string, cloudinary: string, cloudDetails?: string, storageMode?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lấy địa chỉ API từ biến môi trường, nếu không có thì dùng đường dẫn tương đối (cho local)
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

    const checkSystems = async () => {
      try {
        // 1. Check Basic Health (Mongo)
        const healthRes = await fetch(`${API_BASE_URL}/api/health`);
        const healthData = await healthRes.json().catch(() => 
          ({ mongo_status: 'error', storage_mode: 'unknown', error: 'Server không trả về JSON hợp lệ' })
        );

        // 2. Check Cloudinary Connection (Real Ping)
        const cloudRes = await fetch(`${API_BASE_URL}/api/test-cloudinary`);
        const cloudData = await cloudRes.json().catch(() => 
          ({ status: 'error', message: 'Server không trả về JSON hợp lệ' })
        );

        setHealth({
          mongo: healthData.mongo_status || healthData.mongo, // Correct property is mongo_status
          storageMode: healthData.storage_mode, // Check if running in Cloudinary Mode
          cloudinary: cloudData.status, // 'success' or 'error'
          cloudDetails: cloudData.message
        });
      } catch (e) {
        console.error("System Check Error", e);
        setHealth({ mongo: 'error', cloudinary: 'error', cloudDetails: 'Yêu cầu mạng thất bại' });
      } finally {
        setLoading(false);
      }
    };

    checkSystems();
  }, []);

  if (loading || !health) return null;

  const isCloudFallback = health.storageMode?.includes('CLOUDINARY');
  const mongoIssue = health.mongo !== 'connected' && !isCloudFallback; // Only an issue if NO fallback
  const cloudIssue = health.cloudinary !== 'success';

  if (!mongoIssue && !cloudIssue && !isCloudFallback) return null;

  // Green state: Mongo connected OR Cloud Backup active + No Cloudinary Error
  if (!mongoIssue && !cloudIssue && isCloudFallback) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r shadow-sm flex items-start animate-fade-in">
        <div className="flex-shrink-0">
          <RefreshCw className="h-5 w-5 text-blue-500" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-bold text-blue-800 uppercase">HỆ THỐNG ĐANG CHẠY CHẾ ĐỘ DỰ PHÒNG (AN TOÀN)</h3>
          <div className="mt-1 text-sm text-blue-700">
            <p>Dữ liệu đang được lưu trữ an toàn trên <strong>Cloudinary</strong> (Do chưa kết nối MongoDB).</p>
            <p className="text-xs mt-1 text-blue-600/80">Bạn có thể yên tâm sử dụng, dữ liệu sẽ không bị mất.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r shadow-sm animate-pulse-slow">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-bold text-red-800 uppercase">CẢNH BÁO LỖI HỆ THỐNG (QUAN TRỌNG)</h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc pl-5 space-y-2">
              {mongoIssue && (
                <li>
                  <strong className="block">❌ CHƯA LƯU ĐƯỢC DANH SÁCH HỌC SINH (MongoDB Lỗi)</strong>
                  <span>Server đang chạy chế độ tạm. Sau 15 phút không dùng, toàn bộ danh sách học sinh sẽ bị mất và quay về 2 học sinh mẫu.</span>
                  <br />
                  <span className="font-semibold text-xs bg-white px-1 border border-red-200 rounded">Cách sửa:</span> <span className="text-xs">Bạn chưa điền đúng <code>MONGODB_URI</code> trên Render.</span>
                </li>
              )}
              {cloudIssue && (
                <li>
                  <strong className="block">❌ KHÔNG LƯU ĐƯỢC FILE GHI ÂM (Cloudinary Lỗi)</strong>
                  <span>Kết nối đến kho lưu trữ thất bại: "{health.cloudDetails}"</span>
                  <br />
                  <span className="text-xs">Nguyên nhân: API Key hoặc API Secret trên Render bị sai.</span>
                  <br />
                  <span className="font-semibold text-xs bg-white px-1 border border-red-200 rounded">Cách sửa:</span> <span className="text-xs">Vào Render kiểm tra lại <code>CLOUDINARY_API_SECRET</code> (coi chừng copy thừa dấu cách).</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};