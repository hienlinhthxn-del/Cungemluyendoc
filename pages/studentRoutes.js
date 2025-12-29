import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import * as xlsx from 'xlsx';
import Student from '../models/Student.js';

const router = express.Router();

// This function will be the default export.
// It's a factory that creates the router with the necessary dependencies.
export default (localStudents, saveDBToCloud) => {

    // Middleware to check if using MongoDB or local mode
    const useMongo = (req, res, next) => {
        req.useMongo = mongoose.connection.readyState === 1;
        next();
    };

    // GET /api/students - Get all students
    router.get('/', useMongo, async (req, res) => {
        const classId = req.query.classId;
        try {
            if (req.useMongo) {
                const query = classId && classId !== 'ALL' && classId !== 'DEFAULT' ? { classId } : {};
                const students = await Student.find(query);
                res.json(students);
            } else {
                const filtered = classId && classId !== 'ALL' && classId !== 'DEFAULT'
                    ? localStudents.filter(s => s.classId === classId)
                    : localStudents;
                res.json(filtered);
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to fetch students' });
        }
    });

    // POST /api/students - Create or Update a student
    router.post('/', useMongo, async (req, res) => {
        const studentData = req.body;
        if (!studentData.id) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        try {
            if (req.useMongo) {
                const student = await Student.findOneAndUpdate(
                    { id: studentData.id },
                    studentData,
                    { new: true, upsert: true }
                );
                res.status(201).json(student);
            } else {
                const index = localStudents.findIndex(s => s.id === studentData.id);
                if (index > -1) {
                    localStudents[index] = { ...localStudents[index], ...studentData };
                } else {
                    localStudents.push(studentData);
                }
                saveDBToCloud();
                res.status(201).json(studentData);
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to save student' });
        }
    });

    // DELETE /api/students/:id - Delete a student
    router.delete('/:id', useMongo, async (req, res) => {
        const { id } = req.params;
        try {
            if (req.useMongo) {
                const result = await Student.deleteOne({ id });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Student not found' });
                }
                res.status(200).json({ message: 'Student deleted' });
            } else {
                const initialLength = localStudents.length;
                const updatedStudents = localStudents.filter(s => s.id !== id);
                if (updatedStudents.length === initialLength) {
                    return res.status(404).json({ error: 'Student not found' });
                }
                // Re-assign the array
                localStudents.length = 0;
                Array.prototype.push.apply(localStudents, updatedStudents);
                saveDBToCloud();
                res.status(200).json({ message: 'Student deleted' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to delete student' });
        }
    });

    // POST /api/students/:id/progress - Update progress from Lost & Found
    router.post('/:id/progress', useMongo, async (req, res) => {
        const { id } = req.params;
        const { week, ...progressData } = req.body;

        if (!week) {
            return res.status(400).json({ error: 'Week is required' });
        }

        try {
            if (req.useMongo) {
                const student = await Student.findOne({ id });
                if (!student) return res.status(404).json({ error: 'Student not found' });

                const historyIndex = student.history.findIndex(h => h.week === week);
                if (historyIndex > -1) {
                    Object.assign(student.history[historyIndex], progressData);
                } else {
                    student.history.push({ week, score: 0, speed: 0, ...progressData });
                }
                await student.save();
                res.json(student);
            } else {
                const studentIndex = localStudents.findIndex(s => s.id === id);
                if (studentIndex === -1) return res.status(404).json({ error: 'Student not found' });
                
                const student = localStudents[studentIndex];
                const historyIndex = student.history.findIndex(h => h.week === week);
                if (historyIndex > -1) {
                    Object.assign(student.history[historyIndex], progressData);
                } else {
                    student.history.push({ week, score: 0, speed: 0, ...progressData });
                }
                saveDBToCloud();
                res.json(student);
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to update progress' });
        }
    });

    // POST /api/students/import - Import students from Excel
    const upload = multer({ storage: multer.memoryStorage() });
    router.post('/import', upload.single('file'), useMongo, async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
        if (!req.body.classId) return res.status(400).json({ error: 'Class ID is required.' });

        const classId = req.body.classId;
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        const newStudents = data.slice(1).map((row, i) => ({
            id: `s${Date.now()}_${i}`,
            name: String(row[0] || '').trim(),
            classId: classId,
            completedLessons: 0, averageScore: 0, readingSpeed: 0, history: [], lastPractice: new Date(), badges: []
        })).filter(s => s.name);

        if (req.useMongo) {
            if (newStudents.length > 0) await Student.insertMany(newStudents);
        } else {
            localStudents.push(...newStudents);
            saveDBToCloud();
        }

        res.json({ success: true, message: `Đã nhập thành công ${newStudents.length} học sinh vào lớp ${classId}.` });
    });

    return router;
};