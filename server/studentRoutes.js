import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import Student from '../Student.js'; // Import from root directory

const router = express.Router();

// Middleware for excel upload
const uploadDir = 'uploads/temp/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const uploadTemp = multer({ dest: uploadDir });

// This function needs access to the in-memory DB if used.
// We pass it during router setup.
export default (localStudents, saveDBToCloud) => {

    // --- IMPORT STUDENTS FROM EXCEL (Placed first to avoid route conflicts) ---
    router.post('/import', uploadTemp.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(sheet);
            const classId = req.body.classId || '1A3';

            const studentsToCreate = [];
            for (const row of data) {
                // Support various column names
                const name = row['Họ và tên'] || row['Name'] || row['Tên'] || row['Họ tên'] || row['student_name'];
                if (!name) continue;

                studentsToCreate.push({
                    id: `s${Date.now()}${Math.floor(Math.random() * 1000)}`,
                    name: String(name).trim(),
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

            // Clean up file
            try { fs.unlinkSync(req.file.path); } catch (e) { console.error("Warning: Could not delete temp file", e); }

            res.json({ success: true, count: studentsToCreate.length, message: `Thêm thành công ${studentsToCreate.length} học sinh!` });
        } catch (error) {
            console.error("Import Error:", error);
            res.status(500).json({ error: "Lỗi xử lý file Excel: " + error.message });
        }
    });

    /**
     * A helper function to encapsulate the logic for updating a student's progress.
     * This avoids code duplication between MongoDB and local fallback modes.
     * @param {object} student - The student object (either a Mongoose document or a plain JS object).
     * @param {object} progressData - An object containing { score, speed, weekNum, audioUrl }.
     * @returns The updated student object.
     */
    const updateStudentProgress = (student, { score, speed, weekNum, phonemeScore, wordScore, readingScore, exerciseScore }) => {
        // Đảm bảo 'history' luôn là một mảng để tránh lỗi.
        if (!Array.isArray(student.history)) {
            student.history = [];
        }

        const historyIndex = student.history.findIndex(h => h.week === weekNum);

        const progressUpdate = {
            score,
            speed,
            phonemeScore,
            wordScore,
            readingScore,
            exerciseScore
        };

        if (historyIndex >= 0) {
            // Hợp nhất điểm mới với dữ liệu cũ (ví dụ: các URL audio đã có)
            Object.assign(student.history[historyIndex], progressUpdate);
        } else {
            student.history.push({ week: weekNum, ...progressUpdate });
        }

        // Đảm bảo h.score là một số khi tính tổng để tránh kết quả NaN.
        const totalScore = student.history.reduce((acc, h) => acc + (h.score || 0), 0);
        student.averageScore = student.history.length > 0 ? Math.round(totalScore / student.history.length) : 0;
        student.completedLessons = student.history.length;
        student.readingSpeed = speed;
        student.lastPractice = new Date();
        return student;
    };

    // GET All Students (Filtered by ClassId)
    router.get('/', async (req, res) => {
        if (mongoose.connection.readyState === 1) {
            const classId = req.query.classId;
            let filter = {};
            if (classId) {
                if (classId === 'DEFAULT') {
                    filter = { $or: [{ classId: 'DEFAULT' }, { classId: { $exists: false } }, { classId: null }] };
                } else {
                    filter = { classId };
                }
            }
            const students = await Student.find(filter).sort({ lastPractice: -1 });
            return res.json(students);
        }

        // Fallback: Return Local Data
        let filtered = localStudents;
        const classId = req.query.classId;

        if (classId) {
            if (classId === 'DEFAULT') {
                filtered = localStudents.filter(s => !s.classId || s.classId === 'DEFAULT');
            } else {
                filtered = localStudents.filter(s => s.classId === classId);
            }
        }

        res.json(filtered);
    });

    // CREATE / SYNC Student
    router.post('/', async (req, res) => {
        const data = req.body;

        if (mongoose.connection.readyState === 1) {
            const updateData = { ...data };
            delete updateData.id;
            const student = await Student.findOneAndUpdate(
                { id: data.id },
                {
                    $set: updateData,
                    $setOnInsert: { lastPractice: new Date() }
                },
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

        saveDBToCloud(); // Trigger Sync
        res.json(localStudents.find(s => s.id === data.id));
    });

    // UPDATE Progress (After Lesson)
    router.post('/:id/progress', async (req, res) => {
        try {
            const { id } = req.params;
            const progressData = {
                score: req.body.score,
                speed: req.body.speed,
                weekNum: Number(req.body.week) || 0,
                // Lấy các điểm thành phần
                phonemeScore: req.body.phonemeScore,
                wordScore: req.body.wordScore,
                readingScore: req.body.readingScore,
                exerciseScore: req.body.exerciseScore,
            };

            if (mongoose.connection.readyState === 1) {
                let student = await Student.findOne({ id });
                if (!student) {
                    console.log(`⚠️ Auto-creating temporary student record for ID: ${id} (MongoDB Mode)`);
                    student = new Student({ id: id, name: "Học sinh " + id, history: [] });
                }
                student = updateStudentProgress(student, progressData);
                await student.save();
                return res.json(student);
            }

            // Fallback: Update Local Data
            let idx = localStudents.findIndex(s => s.id === id);

            if (idx === -1) {
                console.log(`⚠️ Auto-creating temporary student record for ID: ${id} (Local Mode)`);
                const newStudent = { id: id, name: "Học sinh " + id, classId: 'DEFAULT', completedLessons: 0, averageScore: 0, history: [], lastPractice: new Date() };
                localStudents.push(newStudent);
                idx = localStudents.length - 1;
            }

            localStudents[idx] = updateStudentProgress(localStudents[idx], progressData);
            saveDBToCloud(); // Sync
            res.json(localStudents[idx]);

        } catch (error) {
            console.error(`❌ Lỗi khi cập nhật tiến độ cho học sinh ${req.params.id}:`, error);
            res.status(500).json({ error: 'Không thể cập nhật tiến độ học sinh.', details: error.message });
        }
    });

    // DELETE Student
    router.delete('/:id', async (req, res) => {
        if (mongoose.connection.readyState === 1) {
            await Student.deleteOne({ id: req.params.id });
            return res.json({ success: true });
        }

        // Fallback for local mode
        const studentId = req.params.id;
        const initialLength = localStudents.length;
        localStudents = localStudents.filter(s => s.id !== studentId);

        if (localStudents.length < initialLength) {
            saveDBToCloud(); // Sync to cloud if a student was actually deleted
        }

        res.json({ success: true });
    });

    // --- IMPORT STUDENTS FROM EXCEL ---


    return router;
};