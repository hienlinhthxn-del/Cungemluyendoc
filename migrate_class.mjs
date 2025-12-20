import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env
if (fs.existsSync('.env')) {
    dotenv.config();
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reading-app';

const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    classId: { type: String, required: false },
    name: { type: String, required: true },
    // other fields irrelevant for this operation
}, { strict: false });

const Student = mongoose.model('Student', StudentSchema);

const migrate = async () => {
    try {
        await mongoose.connect(uri);
        console.log("Connected to DB...");

        // Update all students where classId is missing or null
        const result = await Student.updateMany(
            {
                $or: [
                    { classId: { $exists: false } },
                    { classId: null },
                    { classId: 'DEFAULT' }
                ]
            },
            { $set: { classId: '1A3' } }
        );

        console.log(`Updated ${result.modifiedCount} students to class '1A3'.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
