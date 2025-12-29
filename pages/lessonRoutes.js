import express from 'express';
import mongoose from 'mongoose';
import Lesson from '../models/Lesson.js';

const router = express.Router();

const useMongo = (req, res, next) => {
    req.useMongo = mongoose.connection.readyState === 1;
    next();
};

// GET /api/lessons
router.get('/', useMongo, async (req, res) => {
    if (req.useMongo) {
        const lessons = await Lesson.find({}).sort({ week: 1 });
        res.json(lessons);
    } else {
        console.warn("GET /api/lessons not implemented for local mode.");
        res.json([]);
    }
});

// POST /api/lessons
router.post('/', useMongo, async (req, res) => {
    if (req.useMongo) {
        const lessonData = req.body;
        const lesson = await Lesson.findOneAndUpdate(
            { id: lessonData.id },
            lessonData,
            { new: true, upsert: true }
        );
        res.status(201).json(lesson);
    } else {
        res.status(501).json({ error: 'Not implemented for local mode' });
    }
});

// DELETE /api/lessons/:id
router.delete('/:id', useMongo, async (req, res) => {
    if (req.useMongo) {
        const { id } = req.params;
        await Lesson.deleteOne({ id });
        res.status(200).json({ message: 'Lesson deleted' });
    } else {
        res.status(501).json({ error: 'Not implemented for local mode' });
    }
});

export default router;