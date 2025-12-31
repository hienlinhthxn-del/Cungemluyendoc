import mongoose from 'mongoose';

const CommunicationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    studentId: { type: String, required: false }, // If null, broadcast message
    studentName: { type: String, required: false },
    sender: { type: String, enum: ['TEACHER', 'PARENT'], required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['HOMEWORK', 'NOTE', 'FEEDBACK'], required: true },
    timestamp: { type: Number, required: true },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, required: false }
});

export default mongoose.model('Communication', CommunicationSchema);
