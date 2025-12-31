import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema({
    id: { type: String, required: true }, // Not unique globally anymore
    teacherId: { type: String, required: false, default: null }, // null for Global Default lessons
    week: Number,
    title: String,
    description: String,
    readingText: [String],
    phonemes: [String],
    vocabulary: [String],
    questions: [{
        id: String,
        question: String,
        options: [String],
        correctAnswer: String
    }]
}, { timestamps: true });

// Compound unique index: A teacher can have only one version of a lesson ID
LessonSchema.index({ id: 1, teacherId: 1 }, { unique: true });

export default mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);