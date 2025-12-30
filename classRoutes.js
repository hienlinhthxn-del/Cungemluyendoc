import express from 'express';
import mongoose from 'mongoose';
import ClassModel from '../models/Class.js';

const router = express.Router();

export default (localClasses, saveClassesToCloud) => {
    const useMongo = (req, res, next) => {
        req.useMongo = mongoose.connection.readyState === 1;
        next();
    };

    // GET /api/classes
    router.get('/', useMongo, async (req, res) => {
        if (req.useMongo) {
            const classes = await ClassModel.find({});
            res.json(classes);
        } else {
            res.json(localClasses);
        }
    });

    // POST /api/classes
    router.post('/', useMongo, async (req, res) => {
        const classData = req.body;
        if (!classData.id || !classData.name) {
            return res.status(400).json({ error: 'Class ID and Name are required' });
        }

        try {
            if (req.useMongo) {
                const existing = await ClassModel.findOne({ id: classData.id });
                if (existing) return res.status(409).json({ error: 'Class ID already exists' });
                
                const newClass = new ClassModel(classData);
                await newClass.save();
                res.status(201).json(newClass);
            } else {
                const existing = localClasses.find(c => c.id === classData.id);
                if (existing) return res.status(409).json({ error: 'Class ID already exists' });

                localClasses.push(classData);
                saveClassesToCloud();
                res.status(201).json(classData);
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to create class' });
        }
    });

    return router;
};