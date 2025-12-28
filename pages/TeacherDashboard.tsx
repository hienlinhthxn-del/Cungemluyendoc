import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MOCK_STUDENTS, LESSONS as DEFAULT_LESSONS } from '../constants';
import { getLessons } from '../services/lessonService';
import { Lesson } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PlusCircle, Filter, Download, Upload, Save, MessageSquare, UserPlus, X, Trash2, Edit, ChevronDown, PlayCircle, StopCircle, Edit2, Check, Settings, BookOpen, RefreshCw, AlertCircle, ExternalLink, School, Users } from 'lucide-react';
import { StudentStats, Class } from '../types';
import { playClick, playSuccess } from '../services/audioService';
import { AssignHomeworkModal } from '../components/AssignHomeworkModal';
import { EditStudentModal, EditFormState } from '../components/EditStudentModal';
import { ChangePasswordForm } from './ChangePasswordForm';
import { saveCommunication, getCommunications, Communication } from '../services/communicationService';
import { getStudents, syncWithServer, resetToMock } from '../services/studentService';

export const TeacherDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentStats[]>(() => getStudents());
  const [selectedStudent, setSelectedStudent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savedNotes, setSavedNotes] = useState<{ studentName: string, note: string, date: string }[]>([]);

  // Class Management State
  const [classes, setClasses] = useState<Class[]>([]);
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassTeacher, setNewClassTeacher] = useState('');

  // Week Selector State
  // Lesson Data for Weeks
  const [allLessons, setAllLessons] = useState<Lesson[]>(DEFAULT_LESSONS);
  const [selectedWeek, setSelectedWeek] = useState<number>(18);

  // Dynamic Weeks based on actual lessons
  const weeks = useMemo(() => {
    return Array.from(new Set(allLessons.map(l => l.week))).sort((a: number, b: number) => b - a);
  }, [allLessons]);

  // Fetch Lessons and Classes on mount
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Lessons
      const lessonData = await getLessons();
      if (lessonData.length > 0) {
        setAllLessons(lessonData);
      }

      // 2. Fetch Classes
      // Ưu tiên lấy từ LocalStorage (do trang Quản Lý Lớp lưu ở đây) để đồng bộ dữ liệu
      const savedClasses = localStorage.getItem('classes');
      if (savedClasses) {
        setClasses(JSON.parse(savedClasses));
      } else {
        try {
          const res = await fetch('/api/classes');
          if (res.ok) {
            const classData = await res.json();
            setClasses(classData);
          }
        } catch (e) {
          console.error("Failed to load classes", e);
        }
      }
    };
    fetchData();
  }, []);

  // Feedback/Communications
  const [parentFeedback, setParentFeedback] = useState<Communication[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Class ID State
  const [classId, setClassId] = useState(() => localStorage.getItem('teacher_class_id') || 'DEFAULT');
  const [inputClassId, setInputClassId] = useState(classId);

  useEffect(() => {
    setInputClassId(classId);
  }, [classId]);

  const handleClassIdChange = async (newClassId: string) => {
    setClassId(newClassId);
    localStorage.setItem('teacher_class_id', newClassId);
    setNotification({ message: `Đang chuyển sang lớp ${newClassId}...`, type: 'success' });
    await syncWithServer(newClassId); // Sync immediately
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await syncWithServer(classId);

    // Also refresh lessons in case user just added one
    const lessons = await getLessons();
    if (lessons.length > 0) setAllLessons(lessons);

    setTimeout(() => setIsSyncing(false), 800);
  };

  useEffect(() => {
    // Load feedback from parents
    const loadData = () => {
      const allComms = getCommunications();
      const feedback = allComms.filter(c => c.sender === 'PARENT');
      setParentFeedback(feedback);
      setStudents(getStudents()); // Refresh students data
    };

    loadData();
    window.addEventListener('students_updated', loadData);

    // Initial Sync with Server
    syncWithServer(classId);

    return () => window.removeEventListener('students_updated', loadData);
  }, [classId]);

  // Add Student Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Edit Student Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentStats | null>(null);

  // Playback State
  const [playingStudentId, setPlayingStudentId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);

  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Cleanup audio when component unmounts or playback stops
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Clear notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filter Data based on Selected Week & Class
  const weekData = useMemo(() => {
    // 1. Filter by Class ID first
    const classStudents = students.filter(s => {
      if (classId === 'ALL') return true;
      // If classId is DEFAULT, show students with '1A3' or 'DEFAULT' or undefined
      if (classId === 'DEFAULT') return !s.classId || s.classId === 'DEFAULT' || s.classId === '1A3';
      // Otherwise exact match
      return s.classId === classId;
    });
    
    return classStudents.map(s => {
      const weekRecord = s.history.find(h => h.week === selectedWeek);

      // Tính điểm trung bình của các phần nhỏ (Âm, Từ, Đoạn văn)
      const partialScores = [
        weekRecord?.phonemeScore,
        weekRecord?.wordScore,
        weekRecord?.readingScore
      ].filter((score): score is number => typeof score === 'number');

      const averageScore = partialScores.length > 0
        ? Math.round(partialScores.reduce((a, b) => a + b, 0) / partialScores.length)
        : (weekRecord ? weekRecord.score : 0); // Giữ lại điểm cũ nếu không có điểm thành phần

      return {
        ...s,
        weekRecord: weekRecord || null,
        currentScore: averageScore,
        currentSpeed: weekRecord ? weekRecord.speed : '-',
      };
    });
  }, [students, selectedWeek, classId]);

  const chartData = weekData.map(s => ({
    name: s.name.split(' ').pop(), // Last name
    score: s.currentScore,
  }));

  // --- Class Management Logic ---
  const handleCreateClass = async () => {
    if (!newClassCode || !newClassName) {
      setNotification({ message: "Vui lòng nhập Mã lớp và Tên lớp", type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newClassCode,
          name: newClassName,
          teacherName: newClassTeacher
        })
      });

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Server returned non-JSON:", text);
        throw new Error("Server returned invalid response: " + text.substring(0, 50));
      }

      if (res.ok) {
        setClasses(prev => [data, ...prev]);
        setNotification({ message: "Tạo lớp thành công!", type: 'success' });
        setIsCreateClassModalOpen(false);
        setNewClassCode('');
        setNewClassName('');
        setNewClassTeacher('');
        playSuccess();
        
        // Auto switch to new class
        handleClassIdChange(data.id);
      } else {
        setNotification({ message: data.error || "Có lỗi xảy ra", type: 'error' });
      }
    } catch (err: any) {
      setNotification({ message: "Lỗi kết nối server: " + (err.message || err), type: 'error' });
    }
  };

  const currentClass = useMemo(() => {
    if (classId === 'ALL') return { name: 'Tất cả học sinh (Toàn trường)' };
    if (classId === 'DEFAULT') return { name: 'Lớp 1A3 (Mặc định)' };
    return classes.find(c => c.id === classId) || { name: `Lớp ${classId}` };
  }, [classes, classId]);

  const handleSaveNote = () => {
    if (!selectedStudent || !noteContent) return;
    const student = students.find(s => s.id === selectedStudent);
    if (student) {
      const newNote = {
        studentName: student.name,
        note: noteContent,
        date: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setSavedNotes([newNote, ...savedNotes]);

      // Save to shared communications
      saveCommunication({
        id: Date.now().toString(),
        studentId: student.id,
        studentName: student.name,
        sender: 'TEACHER',
        content: noteContent,
        type: 'NOTE',
        timestamp: Date.now(),
        read: false
      });

      setNoteContent('');
      setSelectedStudent('');
      playSuccess(); // Success sound
    }
  };

  const handleAssignHomework = (lessonId: string, note: string, dueDate: string, readingLimit: number, quizLimit: number) => {
    try {
      const lesson = allLessons.find(l => l.id === lessonId);
      if (!lesson) {
        console.error("Lesson not found:", lessonId);
        return;
      }

      // Save assignment config for student view
      const config = {
        note,
        dueDate,
        readingLimit: readingLimit > 0 ? readingLimit * 60 : 0, // Store in seconds
        quizLimit: quizLimit > 0 ? quizLimit * 60 : 0
      };
      localStorage.setItem(`assignment_${lessonId}_config`, JSON.stringify(config));

      // Broadcast assignment to parents
      saveCommunication({
        id: Date.now().toString(),
        studentId: undefined, // Broadcast
        sender: 'TEACHER',
        content: `Cô giáo đã giao bài tập "${lesson?.title}". ${note ? 'Lời nhắn: ' + note : ''}`,
        type: 'HOMEWORK',
        timestamp: Date.now(),
        read: false,
        meta: config
      });

      playSuccess();
      setIsAssignModalOpen(false); // Close modal first

      setNotification({
        message: `Đã giao bài "${lesson?.title}" thành công!`,
        type: 'success'
      });

    } catch (e) {
      console.error("Assignment error:", e);
      setNotification({
        message: "Có lỗi xảy ra khi giao bài.",
        type: 'error'
      });
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    playClick();
    if (window.confirm(`Bạn có chắc chắn muốn xóa học sinh ${name} khỏi lớp không?`)) {
      // 1. Tạo mảng học sinh mới một cách an toàn, dựa trên state hiện tại.
      const newStudents = students.filter(s => s.id !== id);

      // 2. Cập nhật React State
      setStudents(newStudents);

      // 3. Cập nhật LocalStorage với mảng dữ liệu chính xác
      localStorage.setItem('app_students_data', JSON.stringify(newStudents));

      // 4. Đồng bộ lên Server
      try {
        const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setNotification({ message: `Đã xóa học sinh ${name}`, type: 'success' });
        } else {
          console.error("Server delete failed");
          // Optional: Revert? For now, we assume success or user retries.
        }
      } catch (err) {
        console.error("Network error deleting student:", err);
      }
    }
  };

  const openEditModal = (student: StudentStats) => {
    playClick();
    setEditingStudent(student);
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = useCallback((editForm: EditFormState) => {
    if (!editingStudent) return;

    // 1. Create the new, updated array of students immutably.
    const updatedStudents = students.map(s => {
      if (s.id !== editingStudent.id) {
        return s;
      }

      // Update specific week history
      const historyExists = s.history.some(h => h.week === selectedWeek);
      const updatedHistory = historyExists
        ? s.history.map(h =>
          h.week === selectedWeek
            ? {
              ...h,
              score: Number(editForm.score),
              speed: editForm.speed,
              readingScore: editForm.readingScore,
              wordScore: editForm.wordScore,
              sentenceScore: editForm.sentenceScore,
              exerciseScore: editForm.exerciseScore
            }
            : h
        )
        : [...s.history, {
          week: selectedWeek,
          score: Number(editForm.score),
          speed: editForm.speed,
          readingScore: editForm.readingScore,
          wordScore: editForm.wordScore,
          sentenceScore: editForm.sentenceScore,
          exerciseScore: editForm.exerciseScore
        }];

      return {
        ...s,
        name: editForm.name,
        completedLessons: Number(editForm.completedLessons),
        history: updatedHistory,
        // Update top-level stats if it's the latest week
        averageScore: selectedWeek === 18 ? Number(editForm.score) : s.averageScore,
        readingSpeed: selectedWeek === 18 ? editForm.speed : s.readingSpeed
      };
    });

    // 2. Update the React state with the new array.
    setStudents(updatedStudents);

    // 3. Save the new array to LocalStorage.
    localStorage.setItem('app_students_data', JSON.stringify(updatedStudents));

    // 4. Sync the specific updated student to the server.
    const updatedStudent = updatedStudents.find(s => s.id === editingStudent.id);
    if (updatedStudent) {
      fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStudent)
      }).catch(console.error);
    }

    setIsEditModalOpen(false);
    setEditingStudent(null);
    playSuccess();
  }, [editingStudent, selectedWeek, students]);

  // --- AUDIO UPLOAD LOGIC ---
  const handleUploadClick = (studentId: string) => {
    setUploadingStudentId(studentId);
    uploadInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingStudentId) return;

    const audioUrl = URL.createObjectURL(file);

    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id !== uploadingStudentId) return s;

        // Update history
        const historyIndex = s.history.findIndex(h => h.week === selectedWeek);
        let newHistory = [...s.history];

        if (historyIndex >= 0) {
          newHistory[historyIndex] = {
            ...newHistory[historyIndex],
            audioUrl: audioUrl
          };
        } else {
          newHistory.push({
            week: selectedWeek,
            score: 0,
            speed: 0,
            audioUrl: audioUrl
          } as any);
        }

        return { ...s, history: newHistory };
      });

      localStorage.setItem('app_students_data', JSON.stringify(updated));
      return updated;
    });

    setNotification({ message: "Đã tải lên file ghi âm thành công!", type: 'success' });
    playSuccess();

    if (uploadInputRef.current) uploadInputRef.current.value = '';
    setUploadingStudentId(null);
  };

  const playAudioUrl = (url: string) => {
    playClick();
    const audio = new Audio(url);
    audio.play().catch(e => alert("Lỗi phát audio: " + e.message));
  };

  // --- AUDIO PLAYBACK LOGIC ---
  const handlePlayRecording = (student: StudentStats) => {
    // If currently playing this student, stop it
    if (playingStudentId === student.id) {
      window.speechSynthesis.cancel();
      setPlayingStudentId(null);
      // Stop any audio elements if we were tracking them, but for now just cancel speech
      // Note: If using 'new Audio()', we don't have a global reference to stop it easily without state.
      // But typically we'd reload or just rely on the user handling it.
      // For better UX, we'd need to track the Audio object.
      // Simply returning here.
      return;
    }

    // Stop and Reset
    window.speechSynthesis.cancel();
    playClick();

    // 1. Try to play REAL RECORDING first
    const weekRecord = student.history.find(h => h.week === selectedWeek);
    if (weekRecord?.audioUrl) {
      console.log("Playing real audio:", weekRecord.audioUrl);
      const audio = new Audio(weekRecord.audioUrl || '');

      audio.play().catch(e => {
        alert("Không thể phát file ghi âm: " + e.message);
        setPlayingStudentId(null);
      });

      audio.onended = () => setPlayingStudentId(null);
      return;
    }

    // 2. Fallback to SIMULATION (Text-to-Speech)
    // Only if no real recording exists
    setNotification({ message: "Học sinh chưa có file ghi âm. Đang phát giọng đọc mô phỏng.", type: 'error' });
    setPlayingStudentId(student.id);

    // Get text content for the selected week
    const lesson = allLessons.find(l => l.week === selectedWeek);
    let textToRead = "Thưa cô con đọc bài."; // Default intro

    if (lesson && lesson.readingText.length > 0) {
      // Read the first 2 lines of the lesson to simulate
      textToRead += " " + lesson.readingText.slice(0, 2).join('. ');
    } else {
      textToRead += " Bài học tuần này rất vui.";
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utteranceRef.current = utterance;

    utterance.lang = 'vi-VN';
    utterance.rate = 0.9; // Slightly slow like a kid
    utterance.pitch = 1.4; // High pitch to simulate a child's voice

    utterance.onend = () => setPlayingStudentId(null);
    utterance.onerror = () => setPlayingStudentId(null);

    window.speechSynthesis.speak(utterance);
  };

  const openParentView = (studentId: string) => {
    playClick();
    const url = `/#/parent?studentId=${studentId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleExportReport = () => {
    playClick();

    // Define headers
    const headers = ["ID", "Họ và Tên", `Điểm Tuần ${selectedWeek}`, "Tốc độ đọc", "Trạng thái"];

    // Map data to rows
    const rows = weekData.map(s => {
      const status = s.currentScore > 0 ? "Đã nộp" : "Chưa nộp";
      // Escape generic commas in content
      const safeName = `"${s.name.replace(/"/g, '""')}"`;
      const safeSpeed = `"${String(s.currentSpeed).replace(/"/g, '""')}"`;

      return [
        s.id,
        safeName,
        s.currentScore,
        safeSpeed,
        status
      ];
    });

    // Combine headers and rows
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', `Bao_cao_Tuan_${selectedWeek}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      message: "Đã xuất báo cáo thành công!",
      type: 'success'
    });
  };

  const handleMigrateStudents = () => {
    if (classId === 'ALL' || classId === 'DEFAULT') return;

    if (window.confirm(`Bạn có muốn chuyển TOÀN BỘ ${students.length} học sinh đang có trong hệ thống về lớp "${currentClass.name}" (Mã: ${classId}) không?`)) {
      const updatedStudents = students.map(s => ({ ...s, classId: classId }));
      setStudents(updatedStudents);
      localStorage.setItem('app_students_data', JSON.stringify(updatedStudents));
      setNotification({ message: `Đã chuyển ${students.length} học sinh về lớp ${currentClass.name}`, type: 'success' });
      playSuccess();
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-xl shadow-2xl animate-fade-in-left flex items-center gap-3 ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
          }`}>
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

      {/* SYSTEM HEALTH CHECK BANNER */}
      <SystemHealthCheck />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleClassIdChange(inputClassId); }}
              className="flex items-center gap-2"
            >
              <School className="w-8 h-8 text-blue-600" />
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 font-semibold uppercase">Nhập Mã Lớp</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={inputClassId}
                    onChange={(e) => setInputClassId(e.target.value)}
                    onBlur={() => handleClassIdChange(inputClassId)}
                    className="text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-blue-600 focus:outline-none bg-transparent transition-colors placeholder-gray-300 w-48"
                    placeholder="Mã lớp..."
                  />
                  <button type="submit" className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-bold">Xem</button>
                </div>
              </div>
            </form>
            
            <button 
              onClick={() => handleClassIdChange('ALL')}
              className={`ml-3 px-4 py-2 rounded-xl border-2 transition-all flex flex-col items-center ${classId === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
              title="Bấm vào đây để xem toàn bộ học sinh nếu bạn không tìm thấy lớp"
            >
               <span className="text-[10px] font-bold uppercase tracking-wider">Tổng Hệ Thống</span>
               <span className="text-xl font-black leading-none">{students.length} <span className="text-[10px] font-normal">em</span></span>
            </button>
          </div>

          {/* Quick Class Selection List */}
          {classes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 animate-fade-in">
              <span className="text-xs text-gray-400 flex items-center font-semibold uppercase mr-1">Chọn nhanh:</span>
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => handleClassIdChange(cls.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    classId === cls.id 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mb-2">
             <p className="text-gray-500 text-sm">
                Tên lớp: <span className="font-bold text-gray-700">{currentClass.name}</span>
             </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Thống kê:</span>
            <div className="relative inline-block">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="appearance-none bg-blue-50 border border-blue-200 text-blue-800 font-bold py-1 px-3 pr-8 rounded-lg cursor-pointer hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {weeks.map(w => (
                  <option key={w} value={w}>Tuần {w}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-blue-800 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              onClick={handleSync}
              className={`p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
              title="Cập nhật dữ liệu từ Server"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => { playClick(); window.location.hash = '/teacher/classes'; }}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-300"
          >
            <School className="w-4 h-4 mr-2" /> Quản Lý Lớp
          </button>

          <button
            onClick={() => { playClick(); window.location.hash = '/teacher/lessons'; }}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-300"
          >
            <BookOpen className="w-4 h-4 mr-2" /> Quản Lý Bài Học
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-300"
          >
            <Download className="w-4 h-4 mr-2" /> Xuất Báo Cáo
          </button>
          <button
            onClick={() => { playClick(); setIsAssignModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 shadow-sm"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Giao Bài Mới
          </button>
          <button
            onClick={() => { playClick(); setIsSettingsOpen(true); }}
            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={async () => {
              if (!window.confirm("Bạn có muốn quét Cloudinary để khôi phục các bài đọc bị mất link không?")) return;
              setNotification({ message: "Đang quét và khôi phục dữ liệu...", type: 'success' });
              try {
                const res = await fetch('/api/admin/recover-from-cloud', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  setNotification({ message: data.message, type: 'success' });
                  await syncWithServer(classId); // Refresh list
                } else {
                  setNotification({ message: "Lỗi: " + data.error, type: 'error' });
                }
              } catch (e) {
                setNotification({ message: "Lỗi kết nối server", type: 'error' });
              }
            }}
            className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors hidden" // HIDE OLD RECOVER
            title="Khôi phục dữ liệu từ Cloudinary (Cũ)"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={() => window.location.hash = '#/teacher/lost-and-found'}
            className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2"
            title="Kho Thất Lạc (Tìm lại bài đọc)"
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-sm font-semibold hidden md:inline">Kho Thất Lạc</span>
          </button>

          {/* Hidden File Input for Audio Upload */}
          <input
            type="file"
            ref={uploadInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">Sĩ số lớp</p>
          <p className="text-3xl font-bold text-gray-900">{students.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">Đã nộp bài (Tuần {selectedWeek})</p>
          <p className="text-3xl font-bold text-green-600">
            {weekData.filter(s => s.currentScore > 0).length}/{students.length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">Điểm trung bình (Tuần {selectedWeek})</p>
          <p className="text-3xl font-bold text-primary">
            {weekData.filter(s => s.currentScore > 0).length > 0
              ? Math.round(weekData.reduce((acc, curr) => acc + curr.currentScore, 0) / weekData.filter(s => s.currentScore > 0).length)
              : 0}
          </p>
        </div>
      </div>

      {/* LESSON MANAGEMENT & PREVIEW */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          Kho Bài Đọc Tuần {selectedWeek}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allLessons.filter(l => l.week === selectedWeek).map(lesson => (
            <div key={lesson.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors bg-blue-50/30">
              <h4 className="font-bold text-gray-900 mb-1">{lesson.title}</h4>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{lesson.description}</p>
              <button
                onClick={() => {
                  playClick();
                  // Force navigation to student practice page
                  window.location.hash = `/student/practice/${lesson.id}`;
                }}
                className="w-full py-2 bg-white border border-blue-500 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Sửa Giọng Đọc
              </button>
            </div>
          ))}
          {allLessons.filter(l => l.week === selectedWeek).length === 0 && (
            <p className="text-gray-500 italic text-sm col-span-3">Chưa có bài đọc nào cho tuần này.</p>
          )}
        </div>
      </div>

      {/* STUDENT SUBMISSIONS LIST & AUDIO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Danh Sách Nộp Bài (Tuần {selectedWeek})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 text-left">Học sinh</th>
                <th className="px-4 py-4 text-center bg-blue-50/50">Âm / Vần</th>
                <th className="px-4 py-4 text-center bg-yellow-50/50">Từ Ngữ</th>
                <th className="px-4 py-4 text-center bg-green-50/50">Đoạn Văn</th>
                <th className="px-6 py-4 text-center">Tổng Kết</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {weekData.map((student) => {
                const { weekRecord } = student;
                const mainAudioUrl = weekRecord?.audioUrl;
                const hasAnyAudio = mainAudioUrl || weekRecord?.phonemeAudioUrl || weekRecord?.wordAudioUrl || weekRecord?.readingAudioUrl;

                return (
                  <tr key={student.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    
                    {/* Âm / Vần */}
                    <td className="px-4 py-3 text-center border-l border-gray-100 bg-blue-50/30">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-700">{weekRecord?.phonemeScore ?? '-'}</span>
                        {weekRecord?.phonemeAudioUrl ? (
                          <button onClick={() => playAudioUrl(weekRecord.phonemeAudioUrl)} className="text-blue-600 hover:scale-110 transition-transform"><PlayCircle className="w-5 h-5" /></button>
                        ) : <span className="text-[10px] text-gray-300">--</span>}
                      </div>
                    </td>
                    
                    {/* Từ Ngữ */}
                    <td className="px-4 py-3 text-center border-l border-gray-100 bg-yellow-50/30">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-700">{weekRecord?.wordScore ?? '-'}</span>
                        {weekRecord?.wordAudioUrl ? (
                          <button onClick={() => playAudioUrl(weekRecord.wordAudioUrl)} className="text-yellow-600 hover:scale-110 transition-transform"><PlayCircle className="w-5 h-5" /></button>
                        ) : <span className="text-[10px] text-gray-300">--</span>}
                      </div>
                    </td>
                    
                    {/* Đoạn Văn */}
                    <td className="px-4 py-3 text-center border-l border-gray-100 bg-green-50/30">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-700">{weekRecord?.readingScore ?? '-'}</span>
                        {weekRecord?.readingAudioUrl ? (
                          <button onClick={() => playAudioUrl(weekRecord.readingAudioUrl)} className="text-green-600 hover:scale-110 transition-transform"><PlayCircle className="w-5 h-5" /></button>
                        ) : <span className="text-[10px] text-gray-300">--</span>}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-lg ${student.currentScore >= 80 ? 'text-green-600' : student.currentScore >= 50 ? 'text-blue-600' : 'text-red-500'}`}>
                          {student.currentScore > 0 ? student.currentScore : '-'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Tốc độ: {student.currentSpeed || '-'}
                        </span>
                      </div>
                      {(student.currentScore > 0 || hasAnyAudio) ? (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handlePlayRecording(student)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${playingStudentId === student.id
                              ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
                              : hasAnyAudio
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              }`}
                            title={mainAudioUrl ? "Phát file ghi âm tổng" : "Không có file tổng - Phát mô phỏng"}
                          >
                            {playingStudentId === student.id ? (
                              <>
                                <StopCircle className="w-3 h-3 animate-pulse" /> Đang phát...
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-3 h-3" /> {mainAudioUrl ? "Nghe Tổng" : "Mô Phỏng"}
                              </>
                            )}
                          </button>
                          {!mainAudioUrl && <span className="text-[10px] text-red-500 font-bold">⚠ Thiếu file tổng</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic mb-1 block">Chưa nộp</span>
                      )}

                      <button
                        onClick={() => handleUploadClick(student.id)} // This is for the main audio file
                        className="mt-1 text-[10px] flex items-center gap-1 text-gray-500 hover:text-blue-600 bg-gray-50 px-2 py-1 rounded border border-gray-200 mx-auto"
                        title="Tải lên file ghi âm cho học sinh này"
                      >
                        <Upload className="w-3 h-3" /> {mainAudioUrl ? 'Sửa file' : 'Tải file'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openParentView(student.id)}
                          className="text-gray-400 hover:text-green-500 transition-colors"
                          title={`Xem trang phụ huynh của em ${student.name}`}
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openEditModal(student)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title={`Chỉnh sửa điểm tuần ${selectedWeek}`}
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Xóa học sinh"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {weekData.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-b-xl border-t border-gray-100">
             <p className="text-gray-400 font-medium mb-2">Không tìm thấy học sinh nào trong lớp "{classId}".</p>
             <div className="flex flex-col items-center gap-3">
               <button onClick={() => handleClassIdChange('ALL')} className="text-blue-600 font-bold hover:underline">
                  &larr; Bấm vào đây để xem tất cả {students.length} học sinh đang có
               </button>
               
               {students.length > 0 && classId !== 'ALL' && classId !== 'DEFAULT' && (
                 <button 
                   onClick={handleMigrateStudents}
                   className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-bold hover:bg-yellow-200 border border-yellow-300 flex items-center gap-2 shadow-sm"
                 >
                   <RefreshCw className="w-4 h-4" />
                   Chuyển toàn bộ {students.length} HS về lớp này
                 </button>
               )}
             </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Biểu đồ điểm số Tuần {selectedWeek}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#EFF6FF' }}
                />
                <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Alerts & Notes */}
        <div className="space-y-6">
          {/* Action Items / Alerts */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Cần Hỗ Trợ</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold flex-shrink-0">
                  T
                </div>
                <div>
                  <p className="font-bold text-gray-900">Thào Thị Thảo</p>
                  <p className="text-xs text-red-600">Chưa biết đọc</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold flex-shrink-0">
                  L
                </div>
                <div>
                  <p className="font-bold text-gray-900">Vừ Bảo Ly</p>
                  <p className="text-xs text-orange-600">Còn phải đánh vần</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-700 font-bold flex-shrink-0">
                  L
                </div>
                <div>
                  <p className="font-bold text-gray-900">Vừ Thành Long</p>
                  <p className="text-xs text-yellow-600">Còn phải đánh vần</p>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 text-primary text-sm font-bold hover:underline">
              Xem tất cả
            </button>
          </div>

          {/* New: Manual Note Input Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Ghi Chú Nhanh
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Học sinh</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">-- Chọn học sinh --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú lỗi phát âm</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Em hay sai dấu ngã ở các từ 'gỗ', 'đỗ'..."
                  className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <button
                onClick={handleSaveNote}
                disabled={!selectedStudent || !noteContent}
                className="w-full flex items-center justify-center px-4 py-2 bg-secondary text-blue-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Lưu Ghi Chú
              </button>
            </div>

            {/* Recently Saved Notes */}
            {savedNotes.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Ghi chú vừa thêm</h4>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                  {savedNotes.map((note, idx) => (
                    <div key={idx} className="text-sm bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-gray-800">{note.studentName}</span>
                        <span className="text-xs text-gray-400">{note.date}</span>
                      </div>
                      <p className="text-gray-600 italic">"{note.note}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Parent Feedback Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Phản hồi từ Phụ huynh
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {parentFeedback.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Chưa có phản hồi mới.</p>
              ) : (
                parentFeedback.map(comm => (
                  <div key={comm.id} className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-800">PH em {comm.studentName}</span>
                      <span className="text-xs text-gray-400">{new Date(comm.timestamp).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-gray-700">"{comm.content}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tạo Lớp */}
      {isCreateClassModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <School className="w-6 h-6 text-blue-600" />
                Tạo Lớp Học Mới
              </h2>
              <button onClick={() => setIsCreateClassModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã Lớp (ID)</label>
                <input
                  type="text"
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ví dụ: 2A1_2024"
                />
                <p className="text-xs text-gray-500 mt-1">Mã lớp dùng để định danh duy nhất.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Lớp Hiển Thị</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ví dụ: Lớp 2A1 - Cô Lan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giáo Viên Chủ Nhiệm (Tùy chọn)</label>
                <input
                  type="text"
                  value={newClassTeacher}
                  onChange={(e) => setNewClassTeacher(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Tên giáo viên"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsCreateClassModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateClass}
                disabled={!newClassCode || !newClassName}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tạo Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdateStudent}
        student={editingStudent}
        week={selectedWeek}
      />

      <AssignHomeworkModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={handleAssignHomework}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 z-10"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </div>
  );
};

// --- SYSTEM HEALTH CHECK COMPONENT ---
// --- SYSTEM HEALTH CHECK COMPONENT ---
const SystemHealthCheck = () => {
  const [health, setHealth] = useState<{ mongo: string, cloudinary: string, cloudDetails?: string, storageMode?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSystems = async () => {
      try {
        // 1. Check Basic Health (Mongo)
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json().catch(() => 
          ({ mongo_status: 'error', storage_mode: 'unknown', error: 'Server không trả về JSON hợp lệ' })
        );

        // 2. Check Cloudinary Connection (Real Ping)
        const cloudRes = await fetch('/api/test-cloudinary');
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
          <h3 className="text-sm font-bold text-red-800 uppercase">CẢNH BÁO LỖI HỆ TỐNG (QUAN TRỌNG)</h3>
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
