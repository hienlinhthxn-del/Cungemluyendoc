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

// Routes are now defined within the exported function below

export default (uploadMiddleware, LessonAudio) => {
    // GET All Lessons
    router.get('/', async (req, res) => {
        const { classId } = req.query;
        let teacherId = null;

        // Identify teacherId
        if (classId) {
            // STUDENT VIEW: Find class to get teacher
            if (mongoose.connection.readyState === 1) {
                const cls = await ClassModel.findOne({ id: classId });
                if (cls) teacherId = cls.teacherId;
            }
        } else {
            // TEACHER VIEW: Try to get from auth token
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const jwt = (await import('jsonwebtoken')).default;
                    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                    const decoded = jwt.verify(token, JWT_SECRET);
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
                return res.json(finalLessons.sort((a, b) => (a.week || 0) - (b.week || 0)));
            } catch (e) {
                console.error("Mongo GET error:", e);
            }
        }

        // Local Fallback
        const localLessons = getLocalLessons();
        res.json(localLessons.sort((a, b) => (a.week || 0) - (b.week || 0)));
    });

    // CUSTOM AUDIO: GET
    router.get('/:lessonId/custom-audio', async (req, res) => {
        try {
            const { lessonId } = req.params;
            let teacherId = null;

            const authHeader = req.headers.authorization;
            const { classId } = req.query;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const jwt = (await import('jsonwebtoken')).default;
                    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
                    const decoded = jwt.verify(token, JWT_SECRET);
                    teacherId = decoded.id;
                } catch (e) { }
            } else if (classId && mongoose.connection.readyState === 1) {
                const cls = await ClassModel.findOne({ id: classId });
                if (cls && cls.teacherId) {
                    teacherId = cls.teacherId.toString();
                    console.log(`[GET_AUDIO] Identified Teacher: ${teacherId} from Class: ${classId}`);
                }
            }

            if (mongoose.connection.readyState === 1) {
                const query = {
                    lessonId,
                    $or: [{ teacherId: null }, { teacherId }]
                };
                console.log(`[GET_AUDIO] Querying MongoDB - Lesson: ${lessonId}, Teacher: ${teacherId}`);
                const audios = await LessonAudio.find(query);
                console.log(`[GET_AUDIO] Found ${audios.length} recordings.`);
                const audioMap = audios.reduce((acc, curr) => {
                    acc[curr.text || ""] = curr.audioUrl;
                    return acc;
                }, {});
                return res.json(audioMap);
            }

            res.json({}); // Default empty if not in Mongo (local fallback can be added if needed)
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // CUSTOM AUDIO: POST (Teacher Only)
    router.post('/:lessonId/custom-audio', authMiddleware, uploadMiddleware, async (req, res) => {
        try {
            const { lessonId } = req.params;
            const { text } = req.body;
            const teacherId = req.user.id;

            if (!req.file) return res.status(400).json({ error: 'No audio file received' });

            let audioUrl;
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

            if (req.file.path && (req.file.path.startsWith('http') || req.file.path.startsWith('https'))) {
                audioUrl = req.file.path.replace('http:', 'https:');
            } else if (req.file.secure_url) {
                audioUrl = req.file.secure_url.replace('http:', 'https:');
            } else if (cloudName && (req.file.path?.includes('reading-app-audio') || req.file.filename?.includes('reading-app-audio'))) {
                // If it's Cloudinary (relative path or filename), fix it
                const path = (req.file.path || req.file.filename).replace(/^\/uploads\//, '');
                audioUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${path}`;
            } else {
                audioUrl = `/uploads/${req.file.filename}`;
            }

            if (mongoose.connection.readyState === 1) {
                console.log(`[POST_AUDIO] Saving to MongoDB - Lesson: ${lessonId}, Text: ${text}, Teacher: ${teacherId}`);
                const saved = await LessonAudio.findOneAndUpdate(
                    { lessonId, text, teacherId },
                    { audioUrl },
                    { upsert: true, new: true }
                );
                console.log(`[POST_AUDIO] Save result: ${!!saved}`);
            }

            console.log(`[POST_AUDIO] Returning URL: ${audioUrl}`);
            res.json({ audioUrl, text });
        } catch (error) {
            res.status(500).json({ error: 'Upload failed', details: error.message });
        }
    });

    // CREATE / UPDATE Lesson (Teacher Only)
    router.post('/', authMiddleware, async (req, res) => {
        const lessonData = { ...req.body };
        const teacherId = req.user.id;

        delete lessonData._id;
        delete lessonData.__v;

        if (mongoose.connection.readyState === 1) {
            try {
                const lesson = await Lesson.findOneAndUpdate(
                    { id: lessonData.id, teacherId },
                    { $set: { ...lessonData, teacherId } },
                    { new: true, upsert: true, setDefaultsOnInsert: true }
                );
                return res.json(lesson);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        } else {
            const lessons = getLocalLessons();
            const idx = lessons.findIndex(l => l.id === lessonData.id);
            if (idx >= 0) lessons[idx] = { ...lessons[idx], ...lessonData };
            else lessons.push(lessonData);
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
                const result = await Lesson.deleteOne({ id: lessonId, teacherId });
                if (result.deletedCount === 0) {
                    return res.status(403).json({ error: "Bạn không có quyền xóa bài này." });
                }
                return res.json({ success: true });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        } else {
            const lessons = getLocalLessons();
            const newLessons = lessons.filter(l => l.id !== lessonId);
            saveLocalLessons(newLessons);
            res.json({ success: true });
        }
    });

    return router;
};
