import mongoose from 'mongoose';

const LessonSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
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
});

export default mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);