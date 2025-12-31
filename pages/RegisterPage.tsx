import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Mail, UserCheck } from 'lucide-react';

export const RegisterPage: React.FC = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Mật khẩu nhập lại không khớp');
            return;
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                alert('Đăng ký thành công! Vui lòng đăng nhập.');
                navigate('/login');
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
                <h2 className="text-3xl font-bold text-center text-blue-900 mb-2">Đăng Ký</h2>
                <p className="text-center text-gray-500 mb-6">Tạo tài khoản Giáo viên mới</p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Họ và tên</label>
                        <div className="relative">
                            <UserCheck className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Nguyễn Văn A"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên đăng nhập</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="teacher_01"
                                required
                            />
                        </div>
                    </div>

                    {/* Optional Email */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email (Không bắt buộc)</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="example@email.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mật khẩu</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="******"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nhập lại mật khẩu</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="******"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md mt-4"
                    >
                        Đăng Ký Tài Khoản
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                    Đã có tài khoản?{' '}
                    <Link to="/login" className="text-blue-600 font-bold hover:underline">
                        Đăng nhập
                    </Link>
                </p>
            </div>
        </div>
    );
};
