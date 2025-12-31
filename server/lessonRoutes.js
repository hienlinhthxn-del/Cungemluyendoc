import express from 'express';
import mongoose from 'mongoose';
import Lesson from './Lesson.js';
import ClassModel from './Class.js';
import authMiddleware from './middleware/authMiddleware.js';
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
// Supports:
// 1. ?classId=... (For students: fetch their teacher's lessons or global)
// 2. Auth Header (For teachers: fetch their custom lessons or global)
router.get('/', async (req, res) => {
    const { classId } = req.query;
    let teacherId = null;

    // Identify teacherId
    if (classId) {
        // STUDENT VIEW: Find class to get teacher
        if (mongoose.connection.readyState === 1) {
            const cls = await ClassModel.findOne({ id: classId });
            if (cls) teacherId = cls.teacherId;
        } else {
            // Local fallback logic for class lookup can be added if needed
        }
    } else {
        // TEACHER VIEW: Try to get from auth token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const jwt = (await import('jsonwebtoken')).default;
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                teacherId = decoded.id;
            } catch (e) {
                // Ignore token errors for GET
            }
        }
    }

    if (mongoose.connection.readyState === 1) {
        try {
            // 1. Get Teacher's custom lessons
            const teacherLessons = teacherId ? await Lesson.find({ teacherId }).sort({ week: 1 }) : [];

            // 2. Get Global Default lessons (teacherId: null)
            const globalLessons = await Lesson.find({ teacherId: null }).sort({ week: 1 });

            // 3. Merge: Teacher lessons override Global ones by ID
            const lessonMap = new Map();
            globalLessons.forEach(l => lessonMap.set(l.id, l));
            teacherLessons.forEach(l => lessonMap.set(l.id, l));

            const finalLessons = Array.from(lessonMap.values());
            console.log(`📡 Returning ${finalLessons.length} lessons (Teacher: ${teacherId || 'Global'})`);
            return res.json(finalLessons.sort((a, b) => (a.week || 0) - (b.week || 0)));
        } catch (e) {
            console.error("Mongo GET error:", e);
        }
    }

    // Local Fallback
    const localLessons = getLocalLessons();
    res.json(localLessons.sort((a, b) => (a.week || 0) - (b.week || 0)));
});

// CREATE / UPDATE Lesson (Teacher Only)
router.post('/', authMiddleware, async (req, res) => {
    const lessonData = { ...req.body };
    const teacherId = req.user.id;

    // Sanitize data: remove Mongo internal fields to avoid conflicts during upsert
    delete lessonData._id;
    delete lessonData.__v;

    if (mongoose.connection.readyState === 1) {
        try {
            console.log(`[SAVE] Lesson ${lessonData.id} for Teacher ${teacherId}`);
            // Update or Create for THIS teacher
            const lesson = await Lesson.findOneAndUpdate(
                { id: lessonData.id, teacherId },
                { $set: { ...lessonData, teacherId } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return res.json(lesson);
        } catch (e) {
            console.error("Mongo POST error:", e);
            // Check for unique index constraint errors (most likely 'id' index from old schema)
            if (e.code === 11000) {
                return res.status(500).json({
                    error: "Lỗi xung đột dữ liệu: Có thể chỉ mục 'id' cũ vẫn còn tồn tại. Vui lòng liên hệ hỗ trợ hoặc thử dùng một ID khác.",
                    details: e.message
                });
            }
            res.status(500).json({ error: e.message });
        }
    } else {
        // Fallback (Not multi-tenant friendly for local files, but kept for compatibility)
        const lessons = getLocalLessons();
        const idx = lessons.findIndex(l => l.id === lessonData.id);
        if (idx >= 0) {
            lessons[idx] = { ...lessons[idx], ...lessonData };
        } else {
            lessons.push(lessonData);
        }
        saveLocalLessons(lessons);
        res.json(lessonData);
    }
});

// DELETE Lesson
router.delete('/:id', authMiddleware, async (req, res) => {
    const teacherId = req.user.id;
    const lessonId = req.params.id;

    if (mongoose.connection.readyState === 1) {
        try {
            // Only allow deleting lessons owned by this teacher
            const result = await Lesson.deleteOne({ id: lessonId, teacherId });
            if (result.deletedCount === 0) {
                return res.status(403).json({ error: "Bạn không có quyền xóa bài này hoặc bài học mặc định." });
            }
            return res.json({ success: true });
        } catch (e) {
            console.error("Mongo DELETE error:", e);
            res.status(500).json({ error: e.message });
        }
    } else {
        // Fallback
        const lessons = getLocalLessons();
        const newLessons = lessons.filter(l => l.id !== lessonId);
        saveLocalLessons(newLessons);
        res.json({ success: true });
    }
});

export default router;
