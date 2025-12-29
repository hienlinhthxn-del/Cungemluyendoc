import express from 'express';
import mongoose from 'mongoose';
import Lesson from './Lesson.js';

const router = express.Router();

// GET All Lessons
router.get('/', async (req, res) => {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const lessons = await Lesson.find().sort({ week: 1 });
    res.json(lessons);
});

// CREATE / UPDATE Lesson
router.post('/', async (req, res) => {
    const lessonData = req.body;
    const lesson = await Lesson.findOneAndUpdate(
        { id: lessonData.id },
        { $set: lessonData },
        { new: true, upsert: true }
    );
    res.json(lesson);
});

// DELETE Lesson
router.delete('/:id', async (req, res) => {
    await Lesson.deleteOne({ id: req.params.id });
    res.json({ success: true });
});

export default router;