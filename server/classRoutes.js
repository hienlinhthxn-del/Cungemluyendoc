import express from 'express';
import mongoose from 'mongoose';
import ClassModel from './Class.js';

const router = express.Router();

export default (localClasses, saveClassesToCloud) => {
    /**
     * Checks if a class with the given ID already exists.
     * @param {string} classId - The ID of the class to check.
     * @returns {Promise<boolean>} - True if the class exists, false otherwise.
     */
    const classExists = async (classId) => {
        if (mongoose.connection.readyState === 1) {
            return !!await ClassModel.findOne({ id: classId });
        }
        return localClasses.some(c => c.id === classId);
    };

    // GET All Classes
    router.get('/', async (req, res) => {
        if (mongoose.connection.readyState === 1) {
            const classes = await ClassModel.find().sort({ createdAt: -1 });
            return res.json(classes);
        }
        // Fallback
        res.json(localClasses);
    });

    // CREATE Class
    router.post('/', async (req, res) => {
        const { id, name, teacherName } = req.body;
        
        if (!id || !name) {
            return res.status(400).json({ error: 'Mã lớp và Tên lớp là bắt buộc' });
        }

        const newClass = {
            id,
            name,
            teacherName: teacherName || 'Giáo viên',
            createdAt: new Date()
        };

        if (await classExists(id)) {
            return res.status(400).json({ error: 'Mã lớp đã tồn tại' });
        }

        if (mongoose.connection.readyState === 1) {
            const created = await ClassModel.create(newClass);
            return res.json(created);
        }

        // Fallback
        localClasses.unshift(newClass);
        saveClassesToCloud();
        res.json(newClass);
    });

    return router;
};