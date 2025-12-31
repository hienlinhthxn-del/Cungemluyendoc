import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                login(data.token, data.user);
                navigate('/teacher');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Lỗi kết nối server');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-blue-900 mb-2">Đăng Nhập</h2>
                <p className="text-center text-gray-500 mb-8">Dành cho Giáo viên</p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="Ví dụ: thaoco_lop1a"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="********"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg transform active:scale-95"
                    >
                        Đăng Nhập
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <p className="text-center text-sm text-gray-500 mb-4">Chưa có tài khoản?</p>
                    <Link
                        to="/register"
                        className="block w-full text-center py-3 rounded-xl border-2 border-blue-100 text-blue-600 font-bold hover:bg-blue-50 transition-colors"
                    >
                        Đăng Ký Tài Khoản Mới
                    </Link>
                </div>
            </div>
        </div>
    );
};
