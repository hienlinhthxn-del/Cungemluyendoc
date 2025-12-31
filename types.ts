
export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT'
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface Lesson {
  id: string;
  week: number;
  title: string;
  description: string;
  phonemes: string[];    // E.g., ['a', 'b', 'c']
  vocabulary: string[];  // E.g., ['ba ba', 'bè bè']
  readingText: string[]; // Lines of the poem or paragraph
  // Optional: Map text to a specific audio URL (mp3/wav)
  audioMapping?: { [text: string]: string };
  // Optional: Supplemental exercises
  questions?: QuizQuestion[];
}

export interface ReadingResult {
  score: number;
  feedback: string;
  mispronouncedWords: string[];
  audioUrl?: string; // In a real app, this would be a blob URL
  timestamp: Date;
}

export interface WeeklyStats {
  week: number;
  score: number;
  speed: string | number; // Words per minute or status
  audioUrl?: string; // Recording URL
  readingAudioUrl?: string;
  wordAudioUrl?: string;
  phonemeAudioUrl?: string;
  readingScore?: number;
  wordScore?: number;
  sentenceScore?: number;
  exerciseScore?: number;
  phonemeScore?: number;
}

export interface StudentStats {
  id: string;
  name: string;
  classId?: string; // Optional class ID for grouping
  completedLessons: number;
  averageScore: number; // calculated or latest
  readingSpeed?: string | number; // latest
  history: WeeklyStats[]; // Track progress over weeks
  lastPractice: Date;
  badges: string[];
}

export interface GeminiFeedbackSchema {
  score: number;
  mispronounced_words: string[];
  encouraging_comment: string;
  teacher_notes: string;
  spoken_text?: string; // The text Gemini heard from the audio
  reading_speed?: number;
}

export interface Class {
  id: string; // Unique Class Code
  name: string; // Display Name
  teacherName?: string;
  createdAt?: Date;
}
