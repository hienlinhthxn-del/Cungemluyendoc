import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Users, ChevronLeft, X, UserPlus, Search, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playClick, playSuccess, playError } from '../services/audioService';
import { syncWithServer } from '../services/studentService';

interface ClassGroup {
  id: string;
  name: string;
  studentCount: number;
}

export const ClassManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  
  // State quản lý học sinh trong lớp
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentStudents, setCurrentStudents] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Tải danh sách lớp từ localStorage
    const savedClasses = localStorage.getItem('classes');
    if (savedClasses) {
      setClasses(JSON.parse(savedClasses));
    } else {
      // Dữ liệu mẫu nếu chưa có
      setClasses([
        { id: '1', name: 'Lớp 1A', studentCount: 32 },
        { id: '2', name: 'Lớp 1B', studentCount: 28 },
      ]);
    }
  }, []);

  const saveClasses = (newClasses: ClassGroup[]) => {
    setClasses(newClasses);
    localStorage.setItem('classes', JSON.stringify(newClasses));
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newClass: ClassGroup = {
      id: Date.now().toString(),
      name: newClassName,
      studentCount: 0,
    };

    saveClasses([...classes, newClass]);
    setNewClassName('');
    setIsModalOpen(false);
  };

  const handleDeleteClass = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lớp này không?')) {
      saveClasses(classes.filter(c => c.id !== id));
    }
  };

  // --- LOGIC QUẢN LÝ HỌC SINH ---
  const openClassDetails = (cls: ClassGroup) => {
    setSelectedClass(cls);
    // Lấy danh sách học sinh từ localStorage chung của app
    const allStudents = JSON.parse(localStorage.getItem('app_students_data') || '[]');
    // Lọc ra học sinh của lớp này
    const classStudents = allStudents.filter((s: any) => s.classId === cls.id);
    setCurrentStudents(classStudents);
  };

  const handleAddStudentToClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !selectedClass) return;

    // Tạo học sinh mới đúng cấu trúc
    const newStudent = {
      id: `s${Date.now()}`,
      name: studentName,
      classId: selectedClass.id,
      completedLessons: 0,
      averageScore: 0,
      readingSpeed: 0,
      history: [],
      lastPractice: new Date(),
      badges: []
    };

    // 1. Lưu vào danh sách tổng
    const allStudents = JSON.parse(localStorage.getItem('app_students_data') || '[]');
    const updatedAllStudents = [...allStudents, newStudent];
    localStorage.setItem('app_students_data', JSON.stringify(updatedAllStudents));

    // 2. Cập nhật UI hiện tại
    setCurrentStudents([...currentStudents, newStudent]);
    setStudentName('');

    // 3. Cập nhật sĩ số lớp bên ngoài
    const updatedClasses = classes.map(c => 
      c.id === selectedClass.id ? { ...c, studentCount: c.studentCount + 1 } : c
    );
    setClasses(updatedClasses);
    localStorage.setItem('classes', JSON.stringify(updatedClasses));
    
    // (Tùy chọn) Gửi lên server nếu cần thiết kế đồng bộ sau
    fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newStudent.id, name: newStudent.name, classId: selectedClass.id })
    }).catch(err => console.error("Failed to sync new student to server", err));
    
    playSuccess();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      alert("Vui lòng chọn file Excel (.xlsx, .xls)");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('classId', selectedClass.id);

    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        playSuccess();
        alert(data.message);
        
        // Sync and refresh
        await syncWithServer(selectedClass.id);
        
        // Refresh local list logic (re-read from storage after sync might be needed, or just reload page)
        // For now, we reload the list from the updated storage
        openClassDetails(selectedClass);

      } else {
        playError();
        alert("Lỗi: " + data.error);
      }
    } catch (err: any) {
      playError();
      alert("Lỗi kết nối: " + err.message);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/teacher')}
          className="flex items-center text-gray-600 hover:text-blue-600 mb-6 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Quay lại bảng điều khiển
        </button>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Quản Lý Lớp Học</h1>
            <p className="text-gray-600 mt-1">Danh sách các lớp học hiện tại</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-md"
          >
            <Plus className="w-5 h-5" />
            Thêm Lớp Mới
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map((cls) => (
            <div key={cls.id} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => openClassDetails(cls)}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{cls.name}</h3>
                    <p className="text-sm text-gray-500">{cls.studentCount} học sinh</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                  className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-sm text-blue-600 font-medium group-hover:underline">Quản lý danh sách &rarr;</span>
                <div className="bg-gray-100 p-1.5 rounded-full text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                   <UserPlus className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MODAL THÊM LỚP */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Thêm Lớp Mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddClass}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tên lớp</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Ví dụ: Lớp 1A"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Thêm Lớp
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL QUẢN LÝ HỌC SINH TRONG LỚP */}
        {selectedClass && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-fade-in flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Danh sách lớp {selectedClass.name}</h3>
                  <p className="text-sm text-gray-500">Sĩ số hiện tại: {currentStudents.length} em</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                  <button
                    onClick={() => { playClick(); fileInputRef.current?.click(); }}
                    className="flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors border border-green-200"
                    title="Nhập danh sách từ Excel"
                  >
                    <Upload className="w-4 h-4 mr-1.5" /> Nhập Excel
                  </button>
                  <button onClick={() => setSelectedClass(null)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-100 rounded-full ml-2">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Form thêm nhanh */}
              <form onSubmit={handleAddStudentToClass} className="mb-4 bg-blue-50 p-3 rounded-xl flex gap-2">
                <input 
                  type="text" 
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nhập tên học sinh mới..."
                  className="flex-1 px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Thêm
                </button>
              </form>

              {/* Danh sách cuộn */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {currentStudents.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                    <Users className="w-12 h-12 mb-2 opacity-20" />
                    <p>Lớp chưa có học sinh nào.</p>
                  </div>
                ) : (
                  currentStudents.map((s, idx) => (
                    <div key={s.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="font-bold text-gray-700">{idx + 1}. {s.name}</span>
                      <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded border">ID: {s.id}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};