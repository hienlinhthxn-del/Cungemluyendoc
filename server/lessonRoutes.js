import express from 'express';
import mongoose from 'mongoose';
import Lesson from './Lesson.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_LESSONS } from './data/defaultLessons.js';

const router = express.Router();

// --- LOCAL STORAGE FALLBACK ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LESSON_DB_FILE = path.join(__dirname, '../lessons_db.json');

const getLocalLessons = () => {
    let lessons = [];
    if (fs.existsSync(LESSON_DB_FILE)) {
        try {
            lessons = JSON.parse(fs.readFileSync(LESSON_DB_FILE, 'utf8'));
        } catch (e) {
            console.error("Error reading local lesson DB:", e);
        }
    }

    // Seed if empty (First run in offline mode)
    if (!lessons || lessons.length === 0) {
        lessons = [...DEFAULT_LESSONS];
        saveLocalLessons(lessons); // Persist immediately
    }
    return lessons;
};

const saveLocalLessons = (lessons) => {
    try {
        fs.writeFileSync(LESSON_DB_FILE, JSON.stringify(lessons, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving local lesson DB:", e);
    }
};

// GET All Lessons
router.get('/', async (req, res) => {
    if (mongoose.connection.readyState === 1) {
        try {
            const lessons = await Lesson.find().sort({ week: 1 });
            return res.json(lessons);
        } catch (e) {
            console.error("Mongo GET error, falling back:", e);
        }
    }

    // Fallback
    console.warn("⚠️ MongoDB disconnected. Reading local lessons.");
    const lessons = getLocalLessons().sort((a, b) => (a.week || 0) - (b.week || 0));
    res.json(lessons);
});

// CREATE / UPDATE Lesson
router.post('/', async (req, res) => {
    const lessonData = req.body;

    if (mongoose.connection.readyState === 1) {
        try {
            const lesson = await Lesson.findOneAndUpdate(
                { id: lessonData.id },
                { $set: lessonData },
                { new: true, upsert: true }
            );
            return res.json(lesson);
        } catch (e) {
            console.error("Mongo POST error, falling back:", e);
        }
    }

    // Fallback
    console.warn("⚠️ MongoDB disconnected. Saving lesson locally.");
    const lessons = getLocalLessons();
    const idx = lessons.findIndex(l => l.id === lessonData.id);

    if (idx >= 0) {
        lessons[idx] = { ...lessons[idx], ...lessonData };
    } else {
        lessons.push(lessonData);
    }

    saveLocalLessons(lessons);
    res.json(lessonData);
});

// DELETE Lesson
router.delete('/:id', async (req, res) => {
    if (mongoose.connection.readyState === 1) {
        try {
            await Lesson.deleteOne({ id: req.params.id });
            return res.json({ success: true });
        } catch (e) {
            console.error("Mongo DELETE error, falling back:", e);
        }
    }

    // Fallback
    console.warn("⚠️ MongoDB disconnected. Deleting lesson locally.");
    const lessons = getLocalLessons();
    const newLessons = lessons.filter(l => l.id !== req.params.id);
    saveLocalLessons(newLessons);
    res.json({ success: true });
});

export default router;