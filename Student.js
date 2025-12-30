import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    classId: { type: String, required: false, default: 'DEFAULT' },
    name: { type: String, required: true },
    completedLessons: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    readingSpeed: { type: mongoose.Schema.Types.Mixed, default: 0 },
    history: [{
        week: Number,
        score: Number, // Điểm tổng kết của tuần
        speed: mongoose.Schema.Types.Mixed,
        
        // URL audio cho bài đọc chính (giữ lại để tương thích)
        audioUrl: String,

        // Điểm và audio chi tiết cho từng phần
        phonemeScore: Number,
        phonemeAudioUrl: String,
        wordScore: Number,
        wordAudioUrl: String,
        readingScore: Number, // Điểm cho phần đọc đoạn văn
        readingAudioUrl: String,
        exerciseScore: Number, // Điểm cho phần bài tập trắc nghiệm
    }],
    badges: [String],
    lastPractice: { type: Date, default: Date.now }
});

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);