import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import jwt from 'jsonwebtoken'; // Added for manual token check
import Student from '../Student.js';
import ClassModel from './Class.js'; // Added for ownership check

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// Middleware for excel upload
const uploadDir = 'uploads/temp/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const uploadTemp = multer({ dest: uploadDir });

export default (localStudents, saveDBToCloud, localClasses) => {

    // Helper: Identify User (Optional Auth)
    const identifyUser = (req) => {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return null;
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return null;
        }
    };

    // --- IMPORT STUDENTS FROM EXCEL ---
    router.post('/import', uploadTemp.single('file'), async (req, res) => {
        try {
            const user = identifyUser(req);
            if (!user) return res.status(401).json({ error: 'Vui lòng đăng nhập để import.' });

            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const classId = req.body.classId;
            if (!classId) return res.status(400).json({ error: 'Class ID is required' });

            // Validate Class Ownership
            if (mongoose.connection.readyState === 1) {
                const cls = await ClassModel.findOne({ id: classId, teacherId: user.id });
                if (!cls) return res.status(403).json({ error: 'Bạn không có quyền thêm vào lớp này.' });
            } else {
                const cls = localClasses.find(c => c.id === classId && c.teacherId === user.id);
                if (!cls) return res.status(403).json({ error: 'Bạn không có quyền thêm vào lớp này (Local).' });
            }

            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);

            const studentsToCreate = [];
            for (const row of data) {
                // ... (Name parsing logic kept same)
                let name = row['Họ và tên'] || row['Name'] || row['Tên'] || row['Họ tên'] || row['student_name'];
                if (!name) {
                    const keys = Object.keys(row);
                    for (const key of keys) {
                        const lowerKey = key.toLowerCase();
                        if ((lowerKey.includes('tên') || lowerKey.includes('name')) && !lowerKey.includes('stt')) {
                            name = row[key];
                            if (name) break;
                        }
                    }
                }
                if (!name) {
                    const values = Object.values(row);
                    if (values[1] && typeof values[1] === 'string' && isNaN(Number(values[1])) && values[1].length > 2) {
                        name = values[1];
                    }
                    else if (values[0] && typeof values[0] === 'string' && isNaN(Number(values[0])) && values[0].length > 2) {
                        name = values[0];
                    }
                }
                if (!name) continue;
                name = String(name).trim();
                if (name.length < 2) continue;

                studentsToCreate.push({
                    id: `s${Date.now()}${Math.floor(Math.random() * 1000)}`,
                    name: name,
                    classId: classId,
                    completedLessons: 0, averageScore: 0, readingSpeed: 0, history: [], lastPractice: new Date(), badges: []
                });
            }

            if (studentsToCreate.length > 0) {
                if (mongoose.connection.readyState === 1) {
                    await Student.insertMany(studentsToCreate);
                } else {
                    localStudents.push(...studentsToCreate);
                }
            }

            if (mongoose.connection.readyState !== 1) saveDBToCloud();
            try { fs.unlinkSync(req.file.path); } catch (e) { }

            res.json({ success: true, count: studentsToCreate.length, message: `Thêm thành công ${studentsToCreate.length} học sinh!` });
        } catch (error) {
            console.error("Import Error:", error);
            res.status(500).json({ error: "Lỗi xử lý file excel: " + error.message });
        }
    });

    // Helper update progress
    const updateStudentProgress = (student, { score, speed, weekNum, phonemeScore, wordScore, readingScore, exerciseScore }) => {
        if (!Array.isArray(student.history)) student.history = [];
        const historyIndex = student.history.findIndex(h => h.week === weekNum);
        const progressUpdate = { score, speed, phonemeScore, wordScore, readingScore, exerciseScore };

        if (historyIndex >= 0) {
            Object.assign(student.history[historyIndex], progressUpdate);
        } else {
            student.history.push({ week: weekNum, ...progressUpdate });
        }

        const totalScore = student.history.reduce((acc, h) => acc + (h.score || 0), 0);
        student.averageScore = student.history.length > 0 ? Math.round(totalScore / student.history.length) : 0;
        student.completedLessons = student.history.length;
        student.readingSpeed = speed;
        student.lastPractice = new Date();
        return student;
    };

    // GET All Students (Scoped)
    router.get('/', async (req, res) => {
        const user = identifyUser(req); // Optional Auth
        const classId = req.query.classId;

        // CASE 1: Authenticated Teacher
        if (user) {
            let allowedClassIds = [];

            // Get all classes for this teacher
            if (mongoose.connection.readyState === 1) {
                const classes = await ClassModel.find({ teacherId: user.id });
                allowedClassIds = classes.map(c => c.id);
            } else {
                allowedClassIds = localClasses.filter(c => c.teacherId === user.id).map(c => c.id);
            }

            if (classId) {
                // If requesting specific class, verify ownership
                if (classId !== 'DEFAULT' && !allowedClassIds.includes(classId)) {
                    // Fallback: If 'DEFAULT' or some legacy behavior is needed?
                    // Strict mode: Deny
                    return res.status(403).json({ error: 'Bạn không có quyền xem lớp này.' });
                }

                // Get students of that class
                if (mongoose.connection.readyState === 1) {
                    return res.json(await Student.find({ classId }).sort({ lastPractice: -1 }));
                } else {
                    return res.json(localStudents.filter(s => s.classId === classId));
                }
            } else {
                // No classId -> Return ALL students of ALL classes owned by teacher
                if (mongoose.connection.readyState === 1) {
                    return res.json(await Student.find({ classId: { $in: allowedClassIds } }).sort({ lastPractice: -1 }));
                } else {
                    return res.json(localStudents.filter(s => allowedClassIds.includes(s.classId)));
                }
            }
        }

        // CASE 2: Anonymous (Student App)
        // MUST provide classId
        if (!classId) {
            return res.status(400).json({ error: 'Vui lòng cung cấp Mã Lớp (Class ID) để xem danh sách học sinh.' });
        }

        // Return only students of that class
        if (mongoose.connection.readyState === 1) {
            return res.json(await Student.find({ classId }).sort({ lastPractice: -1 }));
        } else {
            return res.json(localStudents.filter(s => s.classId === classId));
        }
    });

    // CREATE / SYNC Student
    // Only Teacher can create
    router.post('/', async (req, res) => {
        const user = identifyUser(req);
        if (!user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });

        const data = req.body;

        // Ownership Check
        if (data.classId && data.classId !== 'DEFAULT') {
            const isOwner = mongoose.connection.readyState === 1
                ? await ClassModel.findOne({ id: data.classId, teacherId: user.id })
                : localClasses.some(c => c.id === data.classId && c.teacherId === user.id);

            if (!isOwner) return res.status(403).json({ error: 'Lớp không tồn tại hoặc bạn không có quyền.' });
        }


        if (mongoose.connection.readyState === 1) {
            const updateData = { ...data };
            delete updateData.id;
            const student = await Student.findOneAndUpdate(
                { id: data.id },
                { $set: updateData, $setOnInsert: { lastPractice: new Date() } },
                { new: true, upsert: true }
            );
            return res.json(student);
        }

        // Fallback: Update Local Data
        const idx = localStudents.findIndex(s => s.id === data.id);
        if (idx >= 0) {
            localStudents[idx] = { ...localStudents[idx], ...data, lastPractice: new Date() };
        } else {
            localStudents.push({ ...data, lastPractice: new Date(), history: data.history || [] });
        }

        saveDBToCloud();
        res.json(localStudents.find(s => s.id === data.id));
    });

    // UPDATE Progress (Student Side - No strict auth required usually, or token optional)
    // For now, leaving as is (Open) or check ownership if we want strictness.
    // Assuming students submit without login for now.
    router.post('/:id/progress', async (req, res) => {
        try {
            const { id } = req.params;
            const progressData = {
                score: req.body.score,
                speed: req.body.speed,
                weekNum: Number(req.body.week) || 0,
                phonemeScore: req.body.phonemeScore,
                wordScore: req.body.wordScore,
                readingScore: req.body.readingScore,
                exerciseScore: req.body.exerciseScore,
            };

            if (mongoose.connection.readyState === 1) {
                let student = await Student.findOne({ id });
                if (!student) { // Auto-create? Only if needed.
                    // For strict multi-tenancy, maybe disable auto-create? 
                    // But legacy code had it. Keeping it for now.
                    console.log(`⚠️ Auto-creating (Mongo): ${id}`);
                    student = new Student({ id: id, name: "Học sinh " + id, history: [] });
                }
                student = updateStudentProgress(student, progressData);
                await student.save();
                return res.json(student);
            }

            // Fallback
            let idx = localStudents.findIndex(s => s.id === id);
            if (idx === -1) {
                // Auto create
                console.log(`⚠️ Auto-creating (Local): ${id}`);
                const newStudent = { id: id, name: "Học sinh " + id, classId: 'DEFAULT', completedLessons: 0, averageScore: 0, history: [], lastPractice: new Date() };
                localStudents.push(newStudent);
                idx = localStudents.length - 1;
            }

            localStudents[idx] = updateStudentProgress(localStudents[idx], progressData);
            saveDBToCloud();
            res.json(localStudents[idx]);

        } catch (error) {
            console.error(`❌ Progress Error ${req.params.id}:`, error);
            res.status(500).json({ error: 'Error updating progress.' });
        }
    });

    // DELETE Student
    // Only Teacher
    router.delete('/:id', async (req, res) => {
        const user = identifyUser(req);
        if (!user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });

        if (mongoose.connection.readyState === 1) {
            // Validate student belongs to a class owned by teacher
            const student = await Student.findOne({ id: req.params.id });
            if (student) {
                const cls = await ClassModel.findOne({ id: student.classId, teacherId: user.id });
                if (!cls && student.classId !== 'DEFAULT') { // Allow deleting legacy/default if needed? Better safe than sorry.
                    return res.status(403).json({ error: 'Bạn không có quyền xóa học sinh này.' });
                }
            }
            await Student.deleteOne({ id: req.params.id });
            return res.json({ success: true });
        }

        // Fallback
        const student = localStudents.find(s => s.id === req.params.id);
        if (student) {
            const isOwner = localClasses.some(c => c.id === student.classId && c.teacherId === user.id);
            if (!isOwner && student.classId !== 'DEFAULT') {
                return res.status(403).json({ error: 'Bạn không có quyền xóa học sinh này (Local).' });
            }
        }

        const studentId = req.params.id;
        const initialLength = localStudents.length;
        localStudents = localStudents.filter(s => s.id !== studentId);

        if (localStudents.length < initialLength) saveDBToCloud();
        res.json({ success: true });
    });

    return router;
};