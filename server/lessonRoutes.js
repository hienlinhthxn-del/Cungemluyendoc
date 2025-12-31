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
    let mongoLessons = [];
    let source = 'none';

    // 1. Try to get from MongoDB
    if (mongoose.connection.readyState === 1) {
        try {
            mongoLessons = await Lesson.find().sort({ week: 1 });
            source = 'mongodb';
        } catch (e) {
            console.error("Mongo GET error:", e);
        }
    }

    // 2. Get local/default lessons
    const localLessons = getLocalLessons();

    // 3. AUTO-MIGRATION / SYNC LOGIC
    // If we have MongoDB but it's missing some lessons found in local/default
    if (mongoose.connection.readyState === 1 && localLessons.length > 0) {
        const mongoIds = new Set(mongoLessons.map(l => l.id));
        const missingLessons = localLessons.filter(l => !mongoIds.has(l.id));

        if (missingLessons.length > 0) {
            console.log(`🔄 Syncing ${missingLessons.length} missing lessons to MongoDB...`);
            try {
                // Insert missing lessons one by one to avoid bulk insert issues with existing IDs (though filter should handle it)
                for (const lesson of missingLessons) {
                    await Lesson.findOneAndUpdate(
                        { id: lesson.id },
                        { $set: lesson },
                        { upsert: true, new: true }
                    );
                }
                // Re-fetch to get the complete list
                mongoLessons = await Lesson.find().sort({ week: 1 });
                console.log(`✅ Sync complete. Total lessons: ${mongoLessons.length}`);
            } catch (syncError) {
                console.error("❌ Auto-sync error:", syncError);
            }
        }
    }

    // 4. Return the best available data
    let finalLessons = (mongoLessons && mongoLessons.length > 0) ? mongoLessons : localLessons;

    console.log(`📡 Returning ${finalLessons.length} lessons (Source: ${source})`);
    res.json(finalLessons.sort((a, b) => (a.week || 0) - (b.week || 0)));
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