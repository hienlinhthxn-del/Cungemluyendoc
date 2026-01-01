
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ClassModel from './Class.js';
import LessonAudio from './models/LessonAudio.js';
import Teacher from './models/Teacher.js';

dotenv.config();

const runDebug = async () => {
    console.log("--- STARTING DB DEBUG ---");
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("No MONGODB_URI found!");
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log("Connected to DB.");

        // 1. DUMP CLASSES
        const classes = await ClassModel.find({});
        console.log(`\n=== DUMPING CLASSES (${classes.length}) ===`);
        classes.forEach(c => {
            console.log(`Class: "${c.name}" | ID: "${c.id}" (Type: ${typeof c.id}) | TeacherID: ${c.teacherId} (Type: ${typeof c.teacherId})`);
        });

        // 2. DUMP AUDIOS (Sample)
        const audios = await LessonAudio.find({}).limit(20);
        console.log(`\n=== DUMPING AUDIOS (First 20) ===`);
        audios.forEach(a => {
            console.log(`Audio: "${a.text}" | Lesson: ${a.lessonId} | TeacherID: ${a.teacherId} (Type: ${typeof a.teacherId}) | URL: ${a.audioUrl.slice(-30)}`);
        });

        // 3. DUMP TEACHERS
        const teachers = await Teacher.find({});
        console.log(`\n=== DUMPING TEACHERS (${teachers.length}) ===`);
        teachers.forEach(t => {
            console.log(`Teacher: "${t.username}" | ID: ${t._id}`);
        });

    } catch (err) {
        console.error("Debug Error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("--- END DB DEBUG ---");
    }
};

runDebug();
