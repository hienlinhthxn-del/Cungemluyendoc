import mongoose from 'mongoose';

const LessonAudioSchema = new mongoose.Schema({
    lessonId: String,
    teacherId: { type: String, required: false, default: null }, // Link to a specific teacher
    text: String,
    audioUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const LessonAudio = mongoose.model('LessonAudio', LessonAudioSchema);

export default LessonAudio;
