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
        score: Number,
        speed: mongoose.Schema.Types.Mixed,
        audioUrl: String
    }],
    badges: [String],
    lastPractice: { type: Date, default: Date.now }
});

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);