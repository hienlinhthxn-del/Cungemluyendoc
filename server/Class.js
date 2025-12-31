import mongoose from 'mongoose';

const ClassSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Class Code (e.g., "1A3_2024")
    name: { type: String, required: true }, // Display Name (e.g., "Lớp 1A3")
    teacherName: { type: String, default: 'Giáo viên' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: false }, // Required=false for backward compatibility initially
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Class || mongoose.model('Class', ClassSchema);