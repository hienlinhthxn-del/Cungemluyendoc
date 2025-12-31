import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    settings: {
        theme: { type: String, default: 'light' },
        notifications: { type: Boolean, default: true }
    }
});

export default mongoose.model('Teacher', teacherSchema);
