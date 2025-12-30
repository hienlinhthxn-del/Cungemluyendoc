
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLessons } from '../services/lessonService';
import { evaluateReading } from '../services/geminiService';
import { playClick, playSuccess, playFanfare, playError } from '../services/audioService';
import { Mic, Square, RefreshCcw, Volume2, ArrowLeft, Award, AlertCircle, MessageSquare, CheckCircle2, Edit3, Loader2, BrainCircuit, X, Activity, Share2, Clock, Check } from 'lucide-react';
import { GeminiFeedbackSchema, Lesson } from '../types';
import { ACHIEVEMENTS, Achievement } from './achievements';
import { saveCommunication } from '../services/communicationService';
import { saveStudentResult, getStudents } from '../services/studentService';

const READING_LIMIT_SECONDS = 900; // 15 minutes
const QUIZ_LIMIT_SECONDS = 300; // 5 minutes

export const ReadingPractice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null); // Track uploading state
  const [result, setResult] = useState<GeminiFeedbackSchema | null>(null);
  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Audio state for Student Recording
  const [supportedMimeType, setSupportedMimeType] = useState<string>('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // TTS & Custom Audio State
  const [playingSection, setPlayingSection] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [vietnameseVoices, setVietnameseVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(0.8); // Add state for playback rate

  // --- TEACHER MODE STATE ---
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [customVoiceMap, setCustomVoiceMap] = useState<Record<string, string>>({});
  const [recordingTarget, setRecordingTarget] = useState<string | null>(null);
  const [isRecordingInitializing, setIsRecordingInitializing] = useState(false);


  // --- PARTIAL RECORDING STATE (STUDENT) ---
  const [partialRecordingId, setPartialRecordingId] = useState<string | null>(null);
  const [evaluationContext, setEvaluationContext] = useState<string>('Bài đọc');
  const partialTargetRef = useRef<{ text: string, id: string, label: string } | null>(null);

  // Feedback Context State
  const [evaluatedText, setEvaluatedText] = useState<string>('');

  // --- QUIZ STATE ---
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | null>(null);

  // --- ACHIEVEMENT STATE ---
  const [newlyAwarded, setNewlyAwarded] = useState<Achievement[]>([]);
  const [showAchievementModal, setShowAchievementModal] = useState(false);

  // --- TIMER STATE ---
  // --- TIMER STATE ---
  const [readingTimeLeft, setReadingTimeLeft] = useState(READING_LIMIT_SECONDS);
  const [quizTimeLeft, setQuizTimeLeft] = useState(QUIZ_LIMIT_SECONDS);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isReadingUnlimited, setIsReadingUnlimited] = useState(false);
  const [isQuizUnlimited, setIsQuizUnlimited] = useState(false);

  // Fetch the specific lesson from the server-synced list
  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) {
        setIsLoadingLesson(false);
        return;
      }
      const allLessons = await getLessons();
      const foundLesson = allLessons.find(l => l.id === id);
      setLesson(foundLesson || null);
      setIsLoadingLesson(false);
    };
    fetchLesson();
  }, [id]);

  // Load Assignment Config
  useEffect(() => {
    if (lesson?.id) {
      const configStr = localStorage.getItem(`assignment_${lesson.id}_config`);
      if (configStr) {
        try {
          const config = JSON.parse(configStr);

          if (typeof config.readingLimit === 'number') {
            if (config.readingLimit > 0) {
              setReadingTimeLeft(config.readingLimit);
              setIsReadingUnlimited(false);
            } else {
              setIsReadingUnlimited(true);
            }
          }

          if (typeof config.quizLimit === 'number') {
            if (config.quizLimit > 0) {
              setQuizTimeLeft(config.quizLimit);
              setIsQuizUnlimited(false);
            } else {
              setIsQuizUnlimited(true);
            }
          }

        } catch (e) {
          console.error("Failed to parse assignment config", e);
        }
      }
    }
  }, [lesson?.id]);

  // Clear notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const sampleRecorderRef = useRef<MediaRecorder | null>(null);
  const sampleChunksRef = useRef<Blob[]>([]);

  const blobsRef = useRef<string[]>([]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Audio Visualizer Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Detect supported MIME type
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    const supported = types.find(type => MediaRecorder.isTypeSupported(type));
    setSupportedMimeType(supported || '');

    // Setup SpeechRecognition (Visual only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setSpokenText(prev => prev + ' ' + finalTranscript);
        }
      };

      recognitionRef.current = recognition;
    }

    // Load TTS Voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        const viVoices = voices.filter(v => v.lang.includes('vi'));
        setVietnameseVoices(viVoices);
        // Set a default voice if not already set and voices are available
        if (viVoices.length > 0 && !selectedVoiceName) {
          const preferredVoice = viVoices.find(v => ['Google Tiếng Việt', 'Microsoft HoaiMy', 'Linh'].some(n => v.name.includes(n))) || viVoices[0];
          setSelectedVoiceName(preferredVoice.name);
        }
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    audioPlayerRef.current = new Audio();

    return () => {
      window.speechSynthesis.cancel();
      blobsRef.current.forEach(url => URL.revokeObjectURL(url));
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (isTeacherMode || isTimeUp || isReadingUnlimited) return;

    // Reading Timer
    const readingTimer = setInterval(() => {
      setReadingTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(readingTimer);
          setIsTimeUp(true);
          playError();
          alert("Đã hết thời gian luyện đọc! Các em hãy nghỉ ngơi nhé.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(readingTimer);
  }, [isTeacherMode, isTimeUp, isReadingUnlimited]);

  useEffect(() => {
    if (!showQuiz || isTeacherMode || isQuizUnlimited) return;

    // Quiz Timer
    const quizTimer = setInterval(() => {
      setQuizTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(quizTimer);
          playError();
          alert("Đã hết thời gian làm bài tập!");
          setShowQuiz(false); // Close quiz on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(quizTimer);
  }, [showQuiz, isTeacherMode, isQuizUnlimited]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchCustomAudio = async () => {
      if (!lesson?.id) return;
      try {
        // Replace with your actual API endpoint
        const response = await fetch(`/api/lessons/${lesson.id}/custom-audio`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data: Record<string, string> = await response.json();
        setCustomVoiceMap(data);
      } catch (error) {
        console.error("Failed to fetch custom audio:", error);
      }
    };
    fetchCustomAudio();
  }, [lesson?.id]);

  // --- AUDIO VISUALIZER ---
  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      // Check ref directly instead of state to avoid closure issues
      if (mediaRecorderRef.current?.state !== 'recording') return;

      animationFrameRef.current = requestAnimationFrame(draw);

      analyserRef.current!.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        // Gradient color for bars
        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 150)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  // --- QUIZ LOGIC ---
  const startQuiz = () => {
    playClick();
    setShowQuiz(true);
    setCurrentQuizIndex(0);
    setQuizScore(0);
    setQuizFinished(false);
    setSelectedAnswer(null);
    setAnswerStatus(null);
    // Reset timer to full if limit exists, otherwise it doesn't matter (isQuizUnlimited is checked)
    if (!isQuizUnlimited) {
      // We need to reset to the original limit. 
      const configStr = localStorage.getItem(`assignment_${lesson?.id}_config`);
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.quizLimit > 0) setQuizTimeLeft(config.quizLimit);
        else setQuizTimeLeft(QUIZ_LIMIT_SECONDS); // Fallback
      } else {
        setQuizTimeLeft(QUIZ_LIMIT_SECONDS);
      }
    }
  };
  const handleQuizAnswer = (option: string) => {
    if (answerStatus !== null || !lesson?.questions) return;

    setSelectedAnswer(option);
    const correct = lesson.questions[currentQuizIndex].correctAnswer;

    if (option === correct) {
      setAnswerStatus('correct');
      setQuizScore(prev => prev + 1);
      playSuccess();
    } else {
      setAnswerStatus('incorrect');
      playError();
    }

    setTimeout(() => {
      if (lesson.questions && currentQuizIndex < lesson.questions.length - 1) {
        setCurrentQuizIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setAnswerStatus(null);
        setQuizTimeLeft(QUIZ_LIMIT_SECONDS);
      } else {
        setQuizFinished(true);
        playFanfare();

        const currentStudentId = localStorage.getItem('current_student_id');
        const student = getStudents().find(s => s.id === currentStudentId);

        if (student) {
          saveCommunication({
            id: Date.now().toString(),
            studentId: student.id,
            studentName: student.name,
            sender: 'PARENT',
            content: `Em ${student.name} vừa hoàn thành bài tập trắc nghiệm "${lesson?.title}" với số điểm ${quizScore + (option === correct ? 1 : 0)}/${lesson.questions?.length}.`,
            type: 'FEEDBACK',
            timestamp: Date.now(),
            read: false
          });
        }
      }
    }, 1500);
  };

  const closeQuiz = () => {
    playClick();
    setShowQuiz(false);
  };

  // --- ACHIEVEMENT LOGIC ---
  const checkAndAwardAchievements = (context: any) => {
    // Simulate fetching and updating student data
    // In a real app, this would be an API call.
    const currentStudentId = localStorage.getItem('current_student_id');
    const currentStudent = getStudents().find(s => s.id === currentStudentId);

    if (!currentStudent) return;

    const awarded: Achievement[] = [];
    ACHIEVEMENTS.forEach(achievement => {
      // Check if student already has this achievement
      if (!currentStudent.badges.includes(achievement.id)) {
        if (achievement.criteria(currentStudent, context)) {
          awarded.push(achievement);
          currentStudent.badges.push(achievement.id); // Update mock data
        }
      }
    });

    if (awarded.length > 0) {
      setNewlyAwarded(awarded);
      setTimeout(() => {
        setShowAchievementModal(true);
        playFanfare(); // Play celebratory sound
      }, 1000); // Show after a short delay
    }
  };

  // --- TEACHER MODE LOGIC ---
  const startRecordingSample = async (text: string) => {
    if (recordingTarget || isRecordingInitializing) return; // Prevent double start

    try {
      setIsRecordingInitializing(true);
      setRecordingTarget(text); // Optimistic UI update

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If user cancelled (clicked stop) while initializing, recordingTarget might be null (handled in stop logic)
      // But since we can't easily check the latest state here without refs in a simple way, 
      // we assume if we got the stream, we should start unless explicitly cancelled.
      // For now, let's proceed.

      const options = supportedMimeType ? { mimeType: supportedMimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      sampleRecorderRef.current = recorder;
      sampleChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) sampleChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(sampleChunksRef.current, { type: supportedMimeType || 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Check for empty recording
        if (blob.size < 1000) { // < 1KB is likely empty/click noise
          console.warn("Recording too short/empty");
          setRecordingTarget(null);
          return;
        }

        // New: Upload the audio instead of creating a local blob URL
        uploadAndSaveAudio(text, blob);
      };

      recorder.start();
      playClick();

    } catch (err) {
      console.error("Mic error:", err);
      alert("Không thể ghi âm. Vui lòng kiểm tra quyền microphone.");
      setRecordingTarget(null);
    } finally {
      setIsRecordingInitializing(false);
    }
  };

  const uploadAndSaveAudio = async (text: string, blob: Blob) => {
    if (!lesson?.id) return;

    const formData = new FormData();
    const ext = supportedMimeType.includes('mp4') ? 'mp4' : 'webm';
    // Create a unique filename using text and timestamp to prevent overwriting
    const safeText = text.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const fileName = `rec_${lesson.id}_${safeText}_${Date.now()}.${ext}`;

    formData.append('audioFile', blob, fileName);
    formData.append('lessonId', lesson.id);
    formData.append('text', text);

    setIsUploading(text); // Set uploading state for UI feedback

    try {
      const response = await fetch(`/api/lessons/${lesson.id}/custom-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await response.json();
      setCustomVoiceMap(prev => ({ ...prev, [text]: data.audioUrl }));
      playSuccess();
    } catch (error) {
      console.error("Upload failed:", error);
      console.error("Upload failed details:", error);
      alert(`Tải lên thất bại: ${error instanceof Error ? error.message : "Lỗi không xác định"}`);
      playError();
    } finally {
      setIsUploading(null);
      setRecordingTarget(null); // Clear recording target after upload attempt
    }
  };

  const stopRecordingSample = () => {
    if (sampleRecorderRef.current && sampleRecorderRef.current.state !== 'inactive') {
      sampleRecorderRef.current.stop();
    }
  };

  const handleTextInteraction = (text: string, sectionId: string) => {
    playClick();
    if (isTeacherMode) {
      if (recordingTarget === text) {
        if (isRecordingInitializing) {
          // User clicked stop while initializing
          setRecordingTarget(null);
          // Note: The stream triggers in startRecordingSample will still fire, but we effectively reset UI.
          // Ideally we should have an abort controller but MediaDevices doesn't support it well.
          // The recorder.start() will run, and then we might be in a weird state.
          // But since startRecordingSample sets recordingTarget(text) again...
          // Actually, let's just let stopRecordingSample handle it if recorder exists, 
          // otherwise just reset target if initializing.
        } else {
          stopRecordingSample();
        }
      } else if (recordingTarget) {
        if (!isRecordingInitializing) {
          stopRecordingSample();
        }
      } else {
        startRecordingSample(text);
      }
      return;
    }
    playContent(text, sectionId);
  };

  const playContent = (text: string, sectionId: string) => {
    window.speechSynthesis.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }

    if (playingSection === sectionId) {
      setPlayingSection(null);
      return;
    }

    setPlayingSection(sectionId);

    if (customVoiceMap[text]) {
      playAudio(customVoiceMap[text]);
      return;
    }

    if (lesson?.audioMapping?.[text]) {
      playAudio(lesson.audioMapping[text]);
      return;
    }

    playTTS(text);
  };

  const playAudio = (url: string) => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.src = url;
    audioPlayerRef.current.onended = () => setPlayingSection(null);
    audioPlayerRef.current.onerror = (e) => {
      setPlayingSection(null);
      console.error("Audio playback error:", e);
      // Optionally, show a user-facing error message
    };
    audioPlayerRef.current.play().catch(e => {
      setPlayingSection(null);
      console.error("Audio play() failed:", e);
    });
  };

  const playTTS = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.lang = 'vi-VN';
    utterance.rate = playbackRate; // Use state for playback rate

    // Find the selected voice from the available voices list
    const voiceToUse = availableVoices.find(v => v.name === selectedVoiceName);

    if (!voiceToUse) {
      alert("Không tìm thấy giọng đọc Tiếng Việt trên máy tính của bạn. Âm thanh có thể không chính xác. Vui lòng cài đặt gói ngôn ngữ Tiếng Việt (có hỗ trợ Text-to-Speech) trong phần Cài đặt của hệ điều hành.");
      setPlayingSection(null);
      return;
    }
    utterance.voice = voiceToUse;

    utterance.onend = () => setPlayingSection(null);
    utterance.onerror = (e) => {
      setPlayingSection(null);
      console.error("TTS Error:", e);
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- STUDENT RECORDING LOGIC (ROBUST) ---

  const startStudentRecording = async (partialText?: string, partialId?: string, label?: string) => {
    try {
      playClick();

      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl(null);
      }

      // Reset Transcript for clean slate on new recording
      setSpokenText('');

      if (partialText && partialId) {
        partialTargetRef.current = { text: partialText, id: partialId, label: label || 'Phần bài đọc' };
        setPartialRecordingId(partialId);
      } else {
        partialTargetRef.current = null;
        setPartialRecordingId(null);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      });

      // SETUP VISUALIZER
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const options = supportedMimeType ? { mimeType: supportedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        blobsRef.current.push(url);

        // Cleanup Audio stream & Visualizer
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        // --- CRITICAL FIX: Handle Partial vs Full Logic ---
        if (partialTargetRef.current) {
          setEvaluationContext(partialTargetRef.current.label);
          // Pass the specific partial text to evaluate, ignoring any global spokenText mismatch
          handleEvaluate(partialTargetRef.current.text, audioBlob);
          // DO NOT setPartialRecordingId(null) here. We wait for results.
        } else {
          setEvaluationContext("Toàn bộ bài học");
          setRecordedAudioUrl(url);
        }
      };

      mediaRecorder.start();

      setIsRecording(true);
      setTimeout(() => drawVisualizer(), 100);

      // Only start SpeechRecognition if we need transcription for full lesson (optional)
      // For partials, we rely more on the audio sent to Gemini
      recognitionRef.current?.start();

      setResult(null);

    } catch (err) {
      console.error("Mic error:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopStudentRecording = () => {
    playClick();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  };

  /**
   * NEW HELPER: Uploads student audio blob to the server.
   * This is similar to the teacher's `uploadAndSaveAudio` function.
   * @returns The permanent URL of the uploaded file, or null on failure.
   */
  const uploadStudentAudio = async (blob: Blob, part: 'phoneme' | 'word' | 'reading', score: number): Promise<string | null> => {
    if (!lesson?.id) return null;
    const currentStudentId = localStorage.getItem('current_student_id');
    if (!currentStudentId) {
      setNotification({ message: 'Không tìm thấy thông tin học sinh để nộp bài.', type: 'error' });
      return null;
    }

    const formData = new FormData();
    const ext = supportedMimeType.includes('mp4') ? 'mp4' : 'webm';
    // Create a unique filename using text and timestamp to prevent overwriting
    const fileName = `submission_${currentStudentId}_w${lesson.week}_${part}_${Date.now()}.${ext}`;

    formData.append('audioFile', blob, fileName);
    formData.append('studentId', currentStudentId);
    formData.append('lessonId', lesson.id);
    formData.append('week', String(lesson.week));
    formData.append('part', part);
    formData.append('score', String(score));

    try {
      // ĐÂY LÀ ENDPOINT MỚI, ĐÚNG CHO VIỆC NỘP BÀI CỦA HỌC SINH.
      // Endpoint này cần được tạo ở phía backend để nhận file và lưu vào đúng bản ghi của học sinh.
      const response = await fetch(`/api/submissions`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Lỗi không xác định từ server.' }));
        throw new Error(errorData.error || 'Server từ chối yêu cầu nộp bài.');
      }
      const data = await response.json();
      // Server nên trả về { success: true, audioUrl: '...' }
      return data.audioUrl;
    } catch (error) {
      console.error("Lỗi khi nộp bài của học sinh:", error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      setNotification({ message: `Lỗi nộp bài: ${errorMessage}`, type: 'error' });
      return null;
    }
  };
  /**
   * NEW: Saves result for a specific part (phoneme, word, reading)
   * - Creates a local audio URL for immediate playback.
   * - Updates the student's history in localStorage.
   * - Recalculates the total score.
   * NOTE: `URL.createObjectURL` is temporary. For persistent storage, the blob
   * needs to be uploaded to a server, and the returned URL should be saved.
   */
  const savePartialStudentResult = async (part: 'phoneme' | 'word' | 'reading', score: number, readingSpeed: number, audioBlob: Blob | undefined) => {
    // GIỚI HẠN KÍCH THƯỚC LƯU TRỮ TẠM THỜI
    const MAX_BLOB_SIZE_FOR_BASE64 = 3 * 1024 * 1024; // 3MB

    if (!lesson || !audioBlob) return; // Nếu không có bài học hoặc file âm thanh thì không làm gì cả

    const currentStudentId = localStorage.getItem('current_student_id');
    if (!currentStudentId) return; // Cần biết đang lưu bài cho học sinh nào

    // Cố gắng tải file lên server. Nếu thất bại, chuyển audio sang Base64 để lưu tạm.
    let audioUrlToSave: string | null = null;
    try {
      const permanentAudioUrl = await uploadStudentAudio(audioBlob, part, score);
      if (permanentAudioUrl) {
        audioUrlToSave = permanentAudioUrl;
      } else {
        // Nếu tải lên thất bại, chuyển sang Base64 nếu file không quá lớn.
        if (audioBlob.size > MAX_BLOB_SIZE_FOR_BASE64) {
          console.warn(`File ghi âm cho phần ${part} quá lớn (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB) để lưu tạm. Sẽ chỉ lưu điểm.`);
          setNotification({ message: `Ghi âm quá dài, chỉ lưu điểm số.`, type: 'error' });
          audioUrlToSave = null;
        } else {
          console.warn(`Tải file thất bại cho phần: ${part}. Sẽ lưu tạm dưới dạng Base64.`);
          audioUrlToSave = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
          });
        }
      }
    } catch (uploadError) {
      console.error(`Lỗi nghiêm trọng khi tải file cho phần ${part}:`, uploadError);
      // Ngay cả khi có lỗi nghiêm trọng, vẫn cố gắng lưu dưới dạng Base64.
      try {
        audioUrlToSave = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      } catch (base64Error) {
        console.error('Không thể chuyển đổi audio sang Base64', base64Error);
        audioUrlToSave = null; // Không thể lưu audio
      }
      setNotification({ message: `Lỗi tải file, đã lưu tạm kết quả.`, type: 'error' });
    }

    const allStudents = getStudents();
    const studentIndex = allStudents.findIndex(s => s.id === currentStudentId);
    if (studentIndex === -1) return;

    const student = allStudents[studentIndex];
    let historyRecord = student.history.find(h => h.week === lesson.week);

    const partScoreKey = `${part}Score`;
    const partAudioKey = `${part}AudioUrl`;

    if (historyRecord) {
      // Cập nhật bản ghi đã có
      (historyRecord as any)[partScoreKey] = score;
      if (audioUrlToSave) (historyRecord as any)[partAudioKey] = audioUrlToSave;
    } else {
      // Tạo bản ghi mới cho tuần này
      historyRecord = {
        week: lesson.week, score: 0, speed: 0,
        [partScoreKey]: score,
        ...(audioUrlToSave && { [partAudioKey]: audioUrlToSave }),
      };
      student.history.push(historyRecord);
    }

    // Tính lại tổng điểm (trung bình cộng của các phần đã có điểm)
    const scores = [historyRecord.phonemeScore, historyRecord.wordScore, historyRecord.readingScore].filter((s): s is number => typeof s === 'number');
    historyRecord.score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : score;
    historyRecord.speed = Math.max(Number(historyRecord.speed) || 0, readingSpeed); // Giữ lại tốc độ cao nhất

    try {
      // Lưu lại vào localStorage
      allStudents[studentIndex] = student;
      localStorage.setItem('app_students_data', JSON.stringify(allStudents));
      console.log(`[SAVE] Đã lưu thành công cho tuần ${lesson.week}. Dữ liệu mới:`, historyRecord);
      // Thông báo cho các component khác (như TeacherDashboard) để làm mới
      window.dispatchEvent(new CustomEvent('students_updated'));
    } catch (e) {
      console.error("LỖI LƯU VÀO LOCALSTORAGE:", e);
      // Đây là lỗi nghiêm trọng, có thể do localStorage đầy.
      setNotification({ message: 'Lỗi nghiêm trọng: Không thể lưu bài làm! Có thể do bộ nhớ trình duyệt đã đầy.', type: 'error' });
      // Trong trường hợp này, không dispatch event để tránh UI bị cập nhật sai.
    }
  };

  const handleEvaluate = async (overrideTargetText?: string, overrideAudioBlob?: Blob) => {
    if (!lesson) return;
    setIsProcessing(true);

    try {
      let audioBase64 = undefined;
      let blobToProcess = overrideAudioBlob;

      if (!blobToProcess && audioChunksRef.current.length > 0) {
        blobToProcess = new Blob(audioChunksRef.current, { type: supportedMimeType || 'audio/webm' });
      }

      if (blobToProcess) {
        const reader = new FileReader();
        audioBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.readAsDataURL(blobToProcess);
        });
      }

      const targetText = overrideTargetText || [...(lesson.phonemes || []), ...(lesson.vocabulary || []), ...(lesson.readingText || [])].join('. ');
      const textToGrade = overrideTargetText ? "" : spokenText;

      setEvaluatedText(targetText);

      // BƯỚC 1: GỌI AI CHẤM ĐIỂM
      const feedback = await evaluateReading(targetText, textToGrade, audioBase64, supportedMimeType);

      // BƯỚC 2: HIỂN THỊ KẾT QUẢ NGAY LẬP TỨC (Không chờ lưu file)
      setResult(feedback);

      // BƯỚC 3: LƯU KẾT QUẢ (LOGIC MỚI)
      const currentStudentId = localStorage.getItem('current_student_id');
      if (currentStudentId) {
        if (partialTargetRef.current && blobToProcess) {
          // This was a partial recording (Âm, Vần, Từ...)
          let partKey: 'phoneme' | 'word' | 'reading' | null = null;
          const label = partialTargetRef.current.label;
          if (label.includes('Âm') || label.includes('Vần')) partKey = 'phoneme';
          else if (label.includes('Từ')) partKey = 'word';
          else if (label.includes('Đoạn')) partKey = 'reading';

          if (partKey) {
            await savePartialStudentResult(partKey, feedback.score, feedback.reading_speed || 0, blobToProcess);
          }
        } else if (blobToProcess) {
          // This was a full recording, treat it as "Đoạn Văn"
          await savePartialStudentResult('reading', feedback.score, feedback.reading_speed || 0, blobToProcess);
        }
      }

      setPartialRecordingId(null); // Reset trạng thái nút ghi âm

      const student = getStudents().find(s => s.id === currentStudentId);

      if (student) {
        saveCommunication({
          id: Date.now().toString(),
          studentId: student.id,
          studentName: student.name,
          sender: 'PARENT', // Using parent/student channel
          content: `Em ${student.name} vừa hoàn thành bài đọc "${lesson?.title}" với số điểm ${feedback.score}/100.`,
          type: 'FEEDBACK',
          timestamp: Date.now(),
          read: false
        });
      }

      // Check for achievements based on score
      checkAndAwardAchievements({ score: feedback.score });

      if (feedback.score >= 80) {
        playFanfare();
      } else if (feedback.score >= 50) {
        playSuccess();
      } else {
        playError();
      }

    } catch (error) {
      console.error("Lỗi chi tiết khi chấm điểm:", error);

      let errorMessage = "Có lỗi kết nối khi chấm điểm. Vui lòng thử lại!";
      if (error instanceof Error) {
        // Cung cấp thông báo lỗi cụ thể hơn cho người dùng
        if (error.message.includes('Failed to fetch')) {
          errorMessage = "Lỗi mạng: Không thể kết nối đến server chấm điểm. Vui lòng kiểm tra kết nối internet và thử lại.";
        } else if (error.message.toLowerCase().includes('api key')) {
          errorMessage = "Lỗi Cấu Hình: API Key của dịch vụ AI bị thiếu hoặc không hợp lệ trên server. Vui lòng báo quản trị viên.";
        } else {
          // Hiển thị lỗi trực tiếp từ server nếu có
          errorMessage = `Lỗi khi chấm điểm: ${error.message}. Vui lòng thử lại.`;
        }
      }

      setNotification({ message: errorMessage, type: 'error' });
      playError();
      setPartialRecordingId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const retry = () => {
    if (isTimeUp) return; // Prevent retry if time is up
    playClick();
    setResult(null);
    setSpokenText('');
    setEvaluatedText('');
    setRecordedAudioUrl(null);
    audioChunksRef.current = [];
    partialTargetRef.current = null;
    setPartialRecordingId(null);
  };

  const RecordButton = ({ onClick, isRecording }: { onClick: () => void, isRecording: boolean }) => (
    <div className="flex flex-col items-center mt-6">
      <div className="relative">
        {/* Visualizer Canvas overlay */}
        {isRecording && (
          <canvas
            ref={canvasRef}
            width={100}
            height={40}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-80"
          />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isTimeUp) {
              alert("Đã hết thời gian!");
              return;
            }
            onClick();
          }}
          disabled={isTimeUp}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 relative z-10 ${isRecording
            ? 'bg-red-500 animate-pulse ring-4 ring-red-200'
            : isTimeUp
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-pink-400 to-rose-500 hover:ring-4 hover:ring-pink-200'
            }`}
        >
          {isRecording ? (
            <Square className="w-8 h-8 text-white fill-white" />
          ) : (
            <Mic className="w-9 h-9 text-white drop-shadow-sm" />
          )}
        </button>
      </div>

      {isRecording ? (
        <p className="mt-3 text-sm text-red-500 font-bold animate-pulse flex items-center gap-1">
          <Activity className="w-4 h-4" /> Đang ghi âm... Nhấn để Chấm điểm
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-500 font-medium">Nhấn để bắt đầu</p>
      )}
    </div>
  );

  const normalize = (str: string) => str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();

  const renderTextWithFeedback = (text: string, mispronounced: string[]) => {
    const words = text.split(/\s+/);
    const normMispronounced = mispronounced.map(w => normalize(w));

    return (
      <div className="flex flex-wrap gap-2 text-lg leading-relaxed justify-center bg-gray-50 p-4 rounded-xl border border-gray-200">
        {words.map((word, i) => {
          const cleanWord = normalize(word);
          const isError = normMispronounced.some(err => cleanWord === err || (cleanWord.includes(err) && err.length > 1));

          if (isError) {
            return (
              <span
                key={i}
                onClick={() => playContent(word, `err-ctx-${i}`)}
                className="cursor-pointer px-1.5 py-0.5 bg-red-100 text-red-600 font-bold border-b-2 border-red-400 border-dashed rounded hover:bg-red-200 transition-colors inline-flex items-center gap-1 group animate-pulse-slow"
                title="Phát âm chưa chuẩn - Bấm để nghe lại"
              >
                {word}
                <Volume2 className="w-3 h-3 opacity-50 group-hover:opacity-100" />
              </span>
            );
          }
          return <span key={i} className="text-gray-700">{word}</span>;
        })}
      </div>
    );
  };

  const handleShare = () => {
    playClick();
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Đã sao chép liên kết bài học! Bạn có thể dán vào Zalo hoặc Messenger để chia sẻ.');
      playSuccess();
    }, (err) => {
      console.error('Could not copy text: ', err);
      alert('Không thể sao chép liên kết.');
      playError();
    });
  };

  if (isLoadingLesson) {
    return <div className="p-10 text-center text-gray-500">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
      Đang tải bài học...
    </div>;
  }
  if (!lesson) return <div className="p-10 text-center">Không tìm thấy bài học</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 relative">
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

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <button
          onClick={() => {
            playClick();
            navigate('/student');
          }}
          className="flex items-center text-gray-500 hover:text-primary transition-colors font-medium self-start sm:self-auto"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Quay lại
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors shadow-sm"
        >
          <Share2 className="w-4 h-4" />
          <span className="font-medium text-sm">Chia sẻ</span>
        </button>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
          <div className="text-right">
            <span className="block text-sm font-bold text-gray-700">Chế độ Giáo viên</span>
            <span className="block text-[10px] text-gray-500">Bật để sửa giọng đọc mẫu</span>
          </div>
          <button
            onClick={() => {
              playClick();
              setIsTeacherMode(!isTeacherMode);
              setRecordingTarget(null);
              setPlayingSection(null);
            }}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${isTeacherMode ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isTeacherMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Lesson Timer Display */}
        {!isTeacherMode && !isReadingUnlimited && (
          <div className={`fixed top-20 right-4 z-40 bg-white px-4 py-2 rounded-full shadow-lg border-2 font-mono font-bold text-lg flex items-center gap-2 ${readingTimeLeft < 60 ? 'text-red-600 border-red-200 animate-pulse' : 'text-blue-600 border-blue-100'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(readingTimeLeft)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">{lesson.title}</h1>
        <p className="text-gray-500 text-lg mb-6">{lesson.description}</p>

        {isTeacherMode && (
          <div className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-start gap-3">
            <Edit3 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">Đang ở chế độ chỉnh sửa giọng đọc mẫu</p>
              <p className="text-sm mt-1">Bấm vào bất kỳ từ/câu nào bên dưới để <span className="font-bold">GHI ÂM</span> giọng của bạn cho từ đó. Bấm lần nữa để Dừng & Lưu.</p>
            </div>
          </div>
        )}

        {!isTeacherMode && (
          <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-center gap-4">
            <label htmlFor="speed" className="text-sm font-medium text-gray-600">Tốc độ đọc mẫu:</label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono">Chậm</span>
              <input
                type="range"
                id="speed"
                min="0.6" max="1.2" step="0.1"
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-xs font-mono">Nhanh</span>
            </div>
            <span className="font-bold text-primary w-10 text-center">{playbackRate.toFixed(1)}x</span>
          </div>
        )}

        {vietnameseVoices.length > 1 && !isTeacherMode && (
          <div className="mt-4 bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-center gap-4">
            <label htmlFor="voice" className="text-sm font-medium text-gray-600">Giọng đọc:</label>
            <select
              id="voice"
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              className="w-48 rounded-lg border-gray-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {vietnameseVoices.map(voice => (
                <option key={voice.name} value={voice.name}>
                  {voice.name.replace('Microsoft', '').replace('Google', '').trim()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Phonemes Section */}
        {lesson.phonemes && lesson.phonemes.length > 0 && (
          <div className="mb-8 p-8 bg-blue-50/50 rounded-2xl border-2 border-blue-200 shadow-sm relative">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-blue-800 mb-2">Âm / Vần</h3>
              <p className="text-blue-600/70 text-sm">Nghe và đọc lại các âm dưới đây</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 mb-8">
              {lesson.phonemes.map((p, i) => {
                const id = `p-${i}`;
                const hasCustom = !!customVoiceMap[p] || !!lesson.audioMapping?.[p];
                const isTarget = recordingTarget === p;
                const isUploadingTarget = isUploading === p;
                const isPlaying = playingSection === id;

                return (
                  <div key={i} className="relative group">
                    <span
                      onClick={() => handleTextInteraction(p, id)}
                      className={` 
                            relative px-8 py-4 rounded-xl shadow-sm text-4xl font-bold cursor-pointer transition-all border-2 block min-w-[100px] text-center bg-white
                            ${isTarget ? 'border-red-500 text-red-700 animate-pulse' :
                          isPlaying ? 'border-green-500 text-green-700 ring-2 ring-green-200' :
                            isUploadingTarget ? 'border-blue-500 text-blue-700' :
                              'text-gray-800 border-transparent hover:border-blue-300 hover:shadow-md'}
                        `}
                    >
                      {p}
                      <span className="absolute -top-3 -right-3 flex gap-1">
                        {isTarget && <span className="bg-red-500 text-white p-1.5 rounded-full shadow"><Mic className="w-3 h-3" /></span>}
                        {!isTarget && isPlaying && <span className="bg-green-500 text-white p-1.5 rounded-full shadow"><Volume2 className="w-3 h-3" /></span>}
                        {isUploadingTarget && <span className="bg-blue-500 text-white p-1.5 rounded-full shadow animate-spin"><Loader2 className="w-3 h-3" /></span>}
                        {!isTarget && !isPlaying && hasCustom && !isTeacherMode && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow font-bold">GV</span>}
                        {!isTarget && !isPlaying && isTeacherMode && <span className="bg-gray-200 text-gray-500 p-1 rounded-full"><Mic className="w-3 h-3" /></span>}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            {!isTeacherMode && !isRecording && (
              <RecordButton
                isRecording={partialRecordingId === 'section-phonemes'}
                onClick={() => {
                  if (partialRecordingId === 'section-phonemes') stopStudentRecording();
                  else startStudentRecording(lesson.phonemes.join('. '), 'section-phonemes', 'Phần Âm / Vần');
                }}
              />
            )}

            {partialRecordingId === 'section-phonemes' && (
              <div className="flex justify-center mt-6">
                <RecordButton
                  isRecording={true}
                  onClick={stopStudentRecording}
                />
              </div>
            )}
          </div>
        )}

        {/* Vocabulary Section */}
        {lesson.vocabulary && lesson.vocabulary.length > 0 && (
          <div className="mb-8 p-8 bg-yellow-50/50 rounded-2xl border-2 border-yellow-200 shadow-sm relative">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-yellow-800 mb-2">Từ Ngữ</h3>
              <p className="text-yellow-600/70 text-sm">Luyện đọc các từ vựng mới</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {lesson.vocabulary.map((word, i) => {
                const id = `v-${i}`;
                const hasCustom = !!customVoiceMap[word] || !!lesson.audioMapping?.[word];
                const isTarget = recordingTarget === word;
                const isUploadingTarget = isUploading === word;
                const isPlaying = playingSection === id;

                return (
                  <div
                    key={i}
                    className={` 
                        relative p-4 rounded-xl border-2 text-center cursor-pointer transition-all group bg-white shadow-sm
                        ${isTarget ? 'border-red-500 animate-pulse' :
                        isPlaying ? 'border-green-500 ring-2 ring-green-200' :
                          isUploadingTarget ? 'border-blue-500' :
                            'border-transparent hover:border-yellow-400 hover:shadow-md'}
                    `}
                    onClick={() => handleTextInteraction(word, id)}
                  >
                    <p className={`text-xl font-medium ${isTarget ? 'text-red-700' : isPlaying ? 'text-green-700' : isUploadingTarget ? 'text-blue-700' : 'text-gray-800'}`}>{word}</p>

                    <div className="absolute top-2 right-2">
                      {isTarget && <Mic className="w-4 h-4 text-red-500" />}
                      {isPlaying && <Volume2 className="w-4 h-4 text-green-500" />}
                      {!isTarget && !isPlaying && isTeacherMode && <Mic className="w-4 h-4 text-gray-400" />}
                    </div>

                    {hasCustom && !isTeacherMode && !isTarget && (
                      <span className="absolute bottom-1 right-1 bg-orange-500 text-white text-[9px] px-1.5 rounded shadow-sm">GV</span>
                    )}
                  </div>
                );
              })}
            </div>

            {!isTeacherMode && !isRecording && (
              <RecordButton
                isRecording={partialRecordingId === 'section-vocab'}
                onClick={() => {
                  if (partialRecordingId === 'section-vocab') stopStudentRecording();
                  else startStudentRecording(lesson.vocabulary.join('. '), 'section-vocab', 'Phần Từ Ngữ');
                }}
              />
            )}
            {partialRecordingId === 'section-vocab' && (
              <div className="flex justify-center mt-6">
                <RecordButton
                  isRecording={true}
                  onClick={stopStudentRecording}
                />
              </div>
            )}
          </div>
        )}

        {/* Reading Text Section */}
        {lesson.readingText && lesson.readingText.length > 0 && (
          <div className="mb-8 p-8 bg-green-50/50 rounded-2xl border-2 border-green-200 shadow-sm relative">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-green-800 mb-2">Đoạn Văn / Thơ</h3>
              <p className="text-green-600/70 text-sm">Đọc diễn cảm đoạn văn sau</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-100 text-lg leading-relaxed text-gray-800 font-medium shadow-sm mb-8">
              {lesson.readingText.map((line, i) => {
                const id = `l-${i}`;
                const hasCustom = !!customVoiceMap[line] || !!lesson.audioMapping?.[line];
                const isTarget = recordingTarget === line;
                const isUploadingTarget = isUploading === line;
                const isPlaying = playingSection === id;

                return (
                  <div
                    key={i}
                    className={` 
                        relative mb-1 px-3 py-1 rounded-lg cursor-pointer transition-all border-l-4 group
                        ${isTarget ? 'bg-red-50 border-red-500' :
                        isPlaying ? 'bg-green-50 border-green-500' :
                          isUploadingTarget ? 'bg-blue-50 border-blue-500' :
                            'hover:bg-blue-50 border-transparent hover:border-blue-300'}
                    `}
                    onClick={() => handleTextInteraction(line, id)}
                  >
                    <div className="flex justify-between items-center">
                      <p className="flex-1">{line}</p>
                      <div className="flex items-center gap-2">
                        {isTarget && <span className="text-xs text-red-500 font-bold animate-pulse flex items-center gap-1"><Mic className="w-3 h-3" /> Đang thu...</span>}
                        {isUploadingTarget && <span className="text-xs text-blue-500 font-bold animate-pulse flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...</span>}
                        {isPlaying && <Volume2 className="w-4 h-4 text-green-600" />}
                        {hasCustom && !isTeacherMode && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 font-bold">Giọng GV</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isTeacherMode && !isRecording && (
              <RecordButton
                isRecording={partialRecordingId === 'section-text'}
                onClick={() => {
                  if (partialRecordingId === 'section-text') stopStudentRecording();
                  else startStudentRecording(lesson.readingText.join('. '), 'section-text', 'Phần Đoạn Văn');
                }}
              />
            )}
            {partialRecordingId === 'section-text' && (
              <div className="flex justify-center mt-6">
                <RecordButton
                  isRecording={true}
                  onClick={stopStudentRecording}
                />
              </div>
            )}
          </div>
        )}

      </div>

      {/* Quiz Trigger Button */}
      {lesson.questions && lesson.questions.length > 0 && !isTeacherMode && (
        <div className="flex justify-center mt-8 mb-12 animate-bounce-short">
          <button
            onClick={startQuiz}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-bold text-xl"
          >
            <BrainCircuit className="w-8 h-8" />
            Làm bài tập bổ trợ
          </button>
        </div>
      )}

      {/* Processing Overlay for Partial Recording */}
      {isProcessing && partialRecordingId && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-scale-in">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="font-bold text-gray-800">Cô giáo đang chấm điểm và lưu bài...</p>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {result && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
            <div className={`p-6 text-center text-white ${result.score >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}>
              <Award className="w-16 h-16 mx-auto mb-2 text-white drop-shadow-md" />
              <h2 className="text-4xl font-extrabold drop-shadow-sm flex flex-col items-center">
                {result.score} Điểm
                <span className="text-lg font-normal opacity-90 mt-1">({evaluationContext})</span>
              </h2>
              <p className="font-medium opacity-90 text-lg mt-1">{result.score >= 80 ? 'Tuyệt vời!' : 'Cố lên nhé!'}</p>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="text-blue-900 font-bold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Nhận xét của cô giáo AI
                </h3>
                <p className="text-gray-700 italic">"{result.encouraging_comment}"</p>
              </div>

              {/* DEBUG INFO: Helps user understand why grading is good/bad or if it failed */}
              {result.teacher_notes && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-600 font-mono">
                  <strong>Debug/Teacher Notes:</strong> {result.teacher_notes}
                </div>
              )}

              {/* Enhanced Visual Feedback of Text */}
              {evaluatedText && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Chi tiết bài đọc (Bấm vào từ đỏ để nghe lại):</h4>
                  {renderTextWithFeedback(evaluatedText, result.mispronounced_words)}
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Chi tiết phát âm:</h4>
                <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 text-lg leading-relaxed text-center">
                  {evaluatedText.split(' ').map((word, index) => {
                    // Simple normalization for comparison
                    const cleanWord = word.replace(/[.,!?;:"]/g, '').toLowerCase();
                    const isMispronounced = result.mispronounced_words.some(w =>
                      w.replace(/[.,!?;:"]/g, '').toLowerCase() === cleanWord
                    );

                    return (
                      <span
                        key={index}
                        className={`inline-block mr-1 font-bold px-1 rounded ${isMispronounced
                          ? 'text-red-500 bg-red-50 decoration-wavy underline decoration-red-300'
                          : 'text-green-600'
                          }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
              </div>

              {result.spoken_text && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-2 text-xs">AI nghe được là:</h4>
                  <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
                    <p className="text-gray-600 text-sm italic">"{result.spoken_text}"</p>
                  </div>
                </div>
              )}

              {recordedAudioUrl && !partialRecordingId && (
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Nghe lại bài đọc của con:</p>
                  <audio src={recordedAudioUrl} controls className="w-full h-8" />
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={retry}
                className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Luyện lại
              </button>
              <button
                onClick={() => {
                  playClick();
                  setResult(null);
                  setRecordedAudioUrl(null);
                  setEvaluatedText('');
                }}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 shadow-sm transition-colors"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUIZ MODAL */}
      {showQuiz && lesson?.questions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in overflow-hidden relative border-4 border-purple-100">
            {!isQuizUnlimited && (
              <div className="absolute top-4 left-4 font-mono font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatTime(quizTimeLeft)}
              </div>
            )}
            <button
              onClick={closeQuiz}
              className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>

            {!quizFinished ? (
              <>
                {/* Progress Bar */}
                <div className="w-full bg-purple-100 h-2.5">
                  <div
                    className="bg-purple-500 h-2.5 transition-all duration-500"
                    style={{ width: `${((currentQuizIndex + 1) / lesson.questions.length) * 100}%` }}
                  ></div>
                </div>

                <div className="p-8">
                  <div className="mb-8 text-center">
                    <p className="text-sm font-bold text-purple-600 mb-2">
                      Câu hỏi {currentQuizIndex + 1} / {lesson.questions.length}
                    </p>
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
                      {lesson.questions[currentQuizIndex].question}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {lesson.questions[currentQuizIndex].options.map((option, idx) => {
                      const isSelected = selectedAnswer === option;
                      const isCorrect = lesson.questions?.[currentQuizIndex].correctAnswer === option;
                      const optionLetter = String.fromCharCode(65 + idx); // A, B, C...

                      let btnClass = "bg-gray-50 border-gray-200 hover:border-purple-400 hover:bg-purple-50";
                      let animationClass = "";

                      if (isSelected && answerStatus === 'correct') {
                        btnClass = "bg-green-100 border-green-500 text-green-800 ring-2 ring-green-300";
                        animationClass = "animate-pop";
                      } else if (isSelected && answerStatus === 'incorrect') {
                        btnClass = "bg-red-100 border-red-500 text-red-800 ring-2 ring-red-300";
                        animationClass = "animate-shake";
                      } else if (answerStatus !== null && isCorrect) {
                        // Show correct answer if user chose wrong
                        btnClass = "bg-green-100 border-green-500 text-green-800";
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleQuizAnswer(option)}
                          disabled={answerStatus !== null}
                          className={`w-full p-4 rounded-xl border-2 text-lg font-bold transition-all text-left flex items-center gap-4 ${btnClass} ${animationClass}`}
                        >
                          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg text-gray-500 font-mono">{optionLetter}</span>
                          <span className="flex-1">{option}</span>
                          {isSelected && answerStatus === 'correct' && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                          {isSelected && answerStatus === 'incorrect' && <AlertCircle className="w-6 h-6 text-red-600" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center">
                <div className="w-24 h-24 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <Award className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold text-purple-900 mb-2">Hoàn thành xuất sắc!</h2>
                <p className="text-xl text-gray-600 mb-8">
                  Con đã trả lời đúng <span className="text-purple-600 font-bold">{quizScore}</span> / {lesson.questions.length} câu hỏi.
                </p>
                <button
                  onClick={closeQuiz}
                  className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl text-xl hover:bg-purple-700 shadow-lg transition-transform hover:scale-105"
                >
                  Quay lại bài học
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievement Unlocked Modal */}
      {showAchievementModal && newlyAwarded.length > 0 && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl text-center p-8 relative transform transition-all scale-100 animate-scale-in">
            <div className="text-7xl mb-4 animate-bounce">{newlyAwarded[0].icon}</div>
            <h2 className="text-2xl font-bold text-yellow-600 mb-1">Thành Tích Mới!</h2>
            <p className="text-lg font-bold text-gray-800 mb-2">{newlyAwarded[0].title}</p>
            <p className="text-sm text-gray-500 mb-6">{newlyAwarded[0].description}</p>
            <button
              onClick={() => {
                playClick();
                const remaining = newlyAwarded.slice(1);
                if (remaining.length > 0) {
                  setNewlyAwarded(remaining);
                } else {
                  setShowAchievementModal(false);
                }
              }}
              className="w-full bg-yellow-500 text-white font-bold py-3 rounded-xl hover:bg-yellow-600 transition-colors"
            >
              Tuyệt vời!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
