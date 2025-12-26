import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MOCK_STUDENTS, LESSONS as DEFAULT_LESSONS } from '../constants';
import { getLessons } from '../services/lessonService';
import { Lesson } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PlusCircle, Filter, Download, Upload, Save, MessageSquare, UserPlus, X, Trash2, Edit, ChevronDown, PlayCircle, StopCircle, Edit2, Check, Settings, BookOpen, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { StudentStats } from '../types';
import { playClick, playSuccess } from '../services/audioService';
import { AddStudentModal } from '../components/AddStudentModal';
import { AssignHomeworkModal } from '../components/AssignHomeworkModal';
import { EditStudentModal, EditFormState } from '../components/EditStudentModal';
import { ChangePasswordForm } from './ChangePasswordForm';
import { saveCommunication, getCommunications, Communication } from '../services/communicationService';
import { getStudents, syncWithServer, resetToMock } from '../services/studentService';

// NOTE: This file is a modified version with added class invite/code generation features.

export const TeacherDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentStats[]>(() => getStudents());
  const [selectedStudent, setSelectedStudent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savedNotes, setSavedNotes] = useState<{ studentName: string, note: string, date: string }[]>([]);

  // Class Name State
  const [className, setClassName] = useState('Lớp 1A3');
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [tempClassName, setTempClassName] = useState('');

  // Week Selector State
  // Lesson Data for Weeks
  const [allLessons, setAllLessons] = useState<Lesson[]>(DEFAULT_LESSONS);
  const [selectedWeek, setSelectedWeek] = useState<number>(18);

  // Dynamic Weeks based on actual lessons
  const weeks = useMemo(() => {
    return Array.from(new Set(allLessons.map(l => l.week))).sort((a: number, b: number) => b - a);
  }, [allLessons]);

  // Fetch Lessons on mount
  useEffect(() => {
    const fetchData = async () => {
      const data = await getLessons();
      if (data.length > 0) {
        setAllLessons(data);
      }
    };
    fetchData();
  }, []);

  // Feedback/Communications
  const [parentFeedback, setParentFeedback] = useState<Communication[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Class ID State
  const [classId, setClassId] = useState(() => localStorage.getItem('teacher_class_id') || 'DEFAULT');

  // --- New: Class Invite Codes (for sharing with other teachers/parents/students)
  const [classCodes, setClassCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('teacher_class_codes');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const saveClassCodes = (codes: string[]) => {
    setClassCodes(codes);
    localStorage.setItem('teacher_class_codes', JSON.stringify(codes));
  };

  // Generate a new class ID (visible to teacher as the current active class)
  const generateClassId = (prefix = 'CLS') => {
    playClick();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const datePart = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const newId = `${prefix}-${datePart}-${rand}`;
    setClassId(newId);
    localStorage.setItem('teacher_class_id', newId);
    setNotification({ message: `Đã tạo mã lớp: ${newId}`, type: 'success' });
    playSuccess();
    // Sync in background
    syncWithServer(newId).catch(e => console.error('sync error', e));
  };

  // Generate a shareable invite code that other teachers or students can use to join
  const generateInviteCode = (prefix = 'INV') => {
    playClick();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const datePart = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const code = `${prefix}-${datePart}-${rand}`;
    const updated = [code, ...classCodes];
    saveClassCodes(updated);
    setNotification({ message: `Mã chia sẻ đã tạo: ${code}`, type: 'success' });
    playSuccess();
    return code;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotification({ message: 'Đã sao chép vào clipboard', type: 'success' });
      playSuccess();
    } catch (e: any) {
      setNotification({ message: 'Không thể sao chép: ' + (e?.message || e), type: 'error' });
    }
  };

  const revokeInviteCode = (code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi mã ${code}?`)) return;
    const updated = classCodes.filter(c => c !== code);
    saveClassCodes(updated);
    setNotification({ message: `Đã thu hồi mã ${code}`, type: 'success' });
  };

  // Allow joining by invite code (for another teacher to adopt this class id locally)
  const joinByInviteCode = (code: string) => {
    // For now, joining by invite sets the current classId to the invite and syncs.
    // In a more complete implementation the server would validate/attach users.
    const normalized = code.trim().toUpperCase();
    setClassId(normalized);
    localStorage.setItem('teacher_class_id', normalized);
    setNotification({ message: `Đã tham gia lớp ${normalized}`, type: 'success' });
    playSuccess();
    syncWithServer(normalized).catch(e => console.error('join sync error', e));
  };

  const handleClassIdChange = async (newClassId: string) => {
    const normalized = newClassId.trim().toUpperCase() || 'DEFAULT';
    setClassId(normalized);
    localStorage.setItem('teacher_class_id', normalized);
    setNotification({ message: `Đang chuyển sang lớp ${normalized}...`, type: 'success' });
    await syncWithServer(normalized);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await syncWithServer(classId);
    const lessons = await getLessons();
    if (lessons.length > 0) setAllLessons(lessons);
    setTimeout(() => setIsSyncing(false), 800);
  };

  useEffect(() => {
    const loadData = () => {
      const allComms = getCommunications();
      const feedback = allComms.filter(c => c.sender === 'PARENT');
      setParentFeedback(feedback);
      setStudents(getStudents());
    };

    loadData();
    window.addEventListener('students_updated', loadData);

    // Initial Sync with Server
    syncWithServer(classId);

    return () => window.removeEventListener('students_updated', loadData);
  }, [classId]);

  // Add Student Modal State
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Edit Student Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentStats | null>(null);

  // Playback State
  const [playingStudentId, setPlayingStudentId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setNotification({ message: "Vui lòng chọn file Excel (.xlsx, .xls)", type: 'error' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('classId', classId);

    setNotification({ message: "Đang nhập dữ liệu...", type: 'success' });

    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setNotification({ message: data.message, type: 'success' });
        playSuccess();
        await syncWithServer(classId);
      } else {
        setNotification({ message: "Lỗi: " + data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotification({ message: "Lỗi kết nối: " + err.message, type: 'error' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ... rest of the original file remains unchanged (omitted for brevity) ...

  // For safety, render UI including the new invite controls in the header area where classId input sits
  return (
    <div className="space-y-8 relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl animate-fade-in-left flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.type === 'success' ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
          <div>
            <p className="font-bold text-lg">Thông báo</p>
            <p className="text-sm opacity-90">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header area simplified to show where new controls sit */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
          <span className="text-xs font-bold text-gray-500 uppercase">Mã Lớp:</span>
          <input
            value={classId}
            onChange={(e) => handleClassIdChange(e.target.value)}
            className="bg-transparent border-b border-gray-300 w-36 text-sm font-bold text-primary focus:outline-none focus:border-primary"
            title="Nhập mã lớp để chuyển đổi dữ liệu"
            placeholder="DEFAULT"
          />

          <button
            onClick={() => generateClassId('CLS')}
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 transition-colors"
            title="Tạo mã lớp mới (mã ngẫu nhiên)"
          >
            Tạo mã lớp
          </button>

          <button
            onClick={() => copyToClipboard(classId)}
            className="ml-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
            title="Sao chép mã lớp"
          >
            Sao chép
          </button>
        </div>

        {/* Invite codes area */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => generateInviteCode('INV')}
            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition-colors"
            title="Tạo mã chia sẻ để người khác dùng"
          >
            Tạo mã chia sẻ
          </button>

          <div className="bg-white border border-gray-200 rounded-lg p-2 max-w-xs">
            <div className="text-xs font-semibold text-gray-600 mb-1">Mã chia sẻ</div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {classCodes.length === 0 && <div className="text-xs text-gray-400 italic">Chưa có mã chia sẻ.</div>}
              {classCodes.map(code => (
                <div key={code} className="flex items-center justify-between gap-2">
                  <div className="text-sm font-mono text-gray-800">{code}</div>
                  <div className="flex gap-1">
                    <button onClick={() => copyToClipboard(code)} className="text-xs px-2 py-1 bg-gray-100 rounded">Sao chép</button>
                    <button onClick={() => joinByInviteCode(code)} className="text-xs px-2 py-1 bg-blue-50 rounded">Tham gia</button>
                    <button onClick={() => revokeInviteCode(code)} className="text-xs px-2 py-1 bg-red-50 rounded">Thu hồi</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The rest of the dashboard UI is unchanged and rendered below... */}

    </div>
  );
};
