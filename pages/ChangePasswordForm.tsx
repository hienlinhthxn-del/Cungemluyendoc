import React, { useState } from 'react';
import { KeyRound, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { playClick, playSuccess, playError } from '../services/audioService';

const TEACHER_PASSWORD_KEY = 'teacher_password';

export const ChangePasswordForm: React.FC = () => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const getCurrentPassword = () => {
        return localStorage.getItem(TEACHER_PASSWORD_KEY) || import.meta.env.VITE_TEACHER_PASSWORD || '123456';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        playClick();
        setError('');
        setSuccess('');

        if (!oldPassword || !newPassword || !confirmPassword) {
            setError('Vui lòng điền đầy đủ thông tin.');
            playError();
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu mới không khớp. Vui lòng nhập lại.');
            playError();
            return;
        }

        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            playError();
            return;
        }

        const currentPassword = getCurrentPassword();
        if (oldPassword !== currentPassword) {
            setError('Mật khẩu cũ không đúng.');
            playError();
            return;
        }

        // Save the new password to localStorage
        localStorage.setItem(TEACHER_PASSWORD_KEY, newPassword);
        setSuccess('Đổi mật khẩu thành công!');
        playSuccess();

        // Clear fields
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <Lock className="w-6 h-6 text-gray-500" />
                Đổi Mật Khẩu
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mật khẩu cũ</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập mật khẩu hiện tại"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mật khẩu mới</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Ít nhất 6 ký tự"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập lại mật khẩu mới"
                        />
                    </div>
                </div>
                {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle className="w-5 h-5" />{error}</div>}
                {success && <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg"><CheckCircle className="w-5 h-5" />{success}</div>}
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                    Lưu Thay Đổi
                </button>
            </form>
        </div>
    );
};