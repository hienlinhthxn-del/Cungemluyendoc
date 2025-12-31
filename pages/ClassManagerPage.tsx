import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2, Users, ChevronLeft, X, UserPlus, Search, Upload, Download, Edit, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playClick, playSuccess, playError } from '../services/audioService';
import { getStudents, saveStudents, syncWithServer } from '../services/studentService';
import { StudentStats } from '../types';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

interface ClassGroup {
  id: string;
  name: string;
}

const StudentListItem = ({ student, index, onDelete, onRename }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);

  const handleSave = () => {
    onRename(student, editName);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group hover:border-blue-200 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <span className="font-mono text-gray-400 w-6 text-sm">#{index + 1}</span>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1 mr-4">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button onClick={handleSave} className="text-green-600 hover:bg-green-100 p-1 rounded">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="font-bold text-gray-700">{student.name}</span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
            title="Đổi tên"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(student.id, student.name)}
          className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
          title="Xóa học sinh"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const ClassManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);

  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentStudents, setCurrentStudents] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClasses();
    fetchAllStudents();
  }, [token]);

  const fetchClasses = async () => {
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/classes', { headers });
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        localStorage.setItem('classes', JSON.stringify(data));
      }
    } catch (e) {
      console.error("Failed to fetch classes", e);
    }
  };

  const fetchAllStudents = async () => {
    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch students (this will return only students for this teacher if backend filters correctly)
      const res = await fetch('/api/students', { headers });
      if (res.ok) {
        const data = await res.json();
        setAllStudents(data);
        saveStudents(data);
      }
    } catch (e) {
      console.error("Failed to fetch students", e);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/classes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: `c${Date.now()}`,
          name: newClassName,
          teacherName: 'Giáo viên'
        })
      });

      if (res.ok) {
        const newClass = await res.json();
        setClasses([...classes, newClass]);
        localStorage.setItem('classes', JSON.stringify([...classes, newClass]));
        setNewClassName('');
        setIsModalOpen(false);
        playSuccess();
      } else {
        alert("Lỗi khi tạo lớp");
      }
    } catch (e) {
      alert("Lỗi kết nối");
    }
  };

  const handleDeleteClass = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lớp này không?')) {
      // TODO: Implement delete API call if available
      // For now just local + refresh
      saveClasses(classes.filter(c => c.id !== id));
    }
  };

  const saveClasses = (newClasses: ClassGroup[]) => {
    setClasses(newClasses);
    localStorage.setItem('classes', JSON.stringify(newClasses));
  };


  // --- LOGIC QUẢN LÝ HỌC SINH ---
  const openClassDetails = (cls: ClassGroup) => {
    setSelectedClass(cls);
    const classStudents = allStudents.filter((s: any) => s.classId === cls.id);
    setCurrentStudents(classStudents);
  };

  const handleAddStudentToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !selectedClass) return;

    const newStudent: StudentStats = {
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

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/students', {
        method: 'POST',
        headers,
        body: JSON.stringify(newStudent)
      });

      if (res.ok) {
        const savedStudent = await res.json();
        const updatedAllStudents = [...allStudents, savedStudent];
        setAllStudents(updatedAllStudents);
        saveStudents(updatedAllStudents);
        setCurrentStudents([...currentStudents, savedStudent]);
        setStudentName('');
        playSuccess();
        window.dispatchEvent(new CustomEvent('students_updated'));
      }
    } catch (err) {
      console.error("Failed to sync new student to server", err);
    }
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
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        playSuccess();
        alert(data.message);
        fetchAllStudents(); // Refresh full list
        // Re-open/refresh view for this class
        // Ideally we fetch just for this class, but fetchAll is fine
        // Wait a bit for state update or manually update local state if returns list
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

  const handleDeleteStudentFromClass = async (studentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" không?`)) return;

    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        const updatedStudents = allStudents.filter(s => s.id !== studentId);
        setAllStudents(updatedStudents);
        saveStudents(updatedStudents);
        setCurrentStudents(currentStudents.filter(s => s.id !== studentId));
        window.dispatchEvent(new CustomEvent('students_updated'));
        playSuccess();
      }
    } catch (e) {
      alert("Lỗi khi xóa học sinh");
    }
  };

  const handleRenameStudent = async (student: StudentStats, newName: string) => {
    if (!newName.trim() || newName === student.name) return;

    const updatedStudent = { ...student, name: newName };

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/students', {
        method: 'POST',
        headers,
        body: JSON.stringify(updatedStudent)
      });

      if (res.ok) {
        const updatedList = allStudents.map(s => s.id === student.id ? updatedStudent : s);
        setAllStudents(updatedList);
        saveStudents(updatedList);
        setCurrentStudents(currentStudents.map(s => s.id === student.id ? updatedStudent : s));
        window.dispatchEvent(new CustomEvent('students_updated'));
        playSuccess();
      }
    } catch (e) {
      alert("Lỗi đổi tên");
    }
  };

  const classStudentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allStudents.forEach(student => {
      if (student.classId) {
        counts.set(student.classId, (counts.get(student.classId) || 0) + 1);
      }
    });
    return counts;
  }, [allStudents]);

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
          {classes.map((cls) => {
            const studentCount = classStudentCounts.get(cls.id) || 0;
            return (
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
                      <p className="text-sm text-gray-500">{studentCount} học sinh</p>
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
            );
          })}
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
                  <button
                    onClick={() => {
                      playClick();
                      const ws = XLSX.utils.json_to_sheet([
                        { "STT": 1, "Họ và tên": "Nguyễn Văn A", "Ghi chú": "Điền tên học sinh vào cột này" },
                        { "STT": 2, "Họ và tên": "Trần Thị B", "Ghi chú": "" }
                      ]);
                      ws['!cols'] = [
                        { wch: 10 }, // STT
                        { wch: 30 }, // Họ và tên
                        { wch: 30 }  // Ghi chú
                      ];
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
                      XLSX.writeFile(wb, "Mau_Danh_Sach_Hoc_Sinh.xlsx");
                    }}
                    className="flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-200 transition-colors border border-blue-200"
                    title="Tải file mẫu Excel"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Tải Mẫu
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
                    <StudentListItem
                      key={s.id || idx}
                      student={s}
                      index={idx}
                      onDelete={handleDeleteStudentFromClass}
                      onRename={handleRenameStudent}
                    />
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
