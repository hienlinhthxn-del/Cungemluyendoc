import express from 'express';
import mongoose from 'mongoose';
import ClassModel from './Class.js';
import authMiddleware from './middleware/authMiddleware.js';

const router = express.Router();

export default (localClasses, saveClassesToCloud) => {

    // Helper to check ownership or existence
    const classExists = async (classId) => {
        if (mongoose.connection.readyState === 1) {
            return !!await ClassModel.findOne({ id: classId });
        }
        return localClasses.some(c => c.id === classId);
    };

    // Apply Auth Middleware to ALL routes
    router.use(authMiddleware);

    // GET Classes (Scoped to Teacher)
    router.get('/', async (req, res) => {
        const teacherId = req.user.id;

        if (mongoose.connection.readyState === 1) {
            try {
                // Only find classes belonging to this teacher
                const classes = await ClassModel.find({ teacherId }).sort({ createdAt: -1 });
                return res.json(classes);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        // Fallback for local mode (Not truly secure for multi-tenant, but filtering for demo)
        // In a real local-only scenario, we might not have teacherId linked in JSON. 
        // We will return ALL classes if simpler, or try to filter if we added teacherId to JSON.
        res.json(localClasses.filter(c => c.teacherId === teacherId));
    });

    // CREATE Class
    router.post('/', async (req, res) => {
        const { id, name, teacherName } = req.body;
        const teacherId = req.user.id;

        if (!id || !name) {
            return res.status(400).json({ error: 'Mã lớp và Tên lớp là bắt buộc' });
        }

        const newClass = {
            id,
            name,
            teacherName: teacherName || 'Giáo viên',
            teacherId, // Assign current teacher
            createdAt: new Date()
        };

        if (await classExists(id)) {
            return res.status(400).json({ error: 'Mã lớp đã tồn tại' });
        }

        if (mongoose.connection.readyState === 1) {
            try {
                const created = await ClassModel.create(newClass);
                return res.json(created);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        // Fallback
        localClasses.unshift(newClass);
        saveClassesToCloud();
        res.json(newClass);
    });

    return router;
};