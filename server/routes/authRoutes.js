import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Teacher from '../models/Teacher.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// JWT_SECRET is accessed via process.env where needed to ensure latest value
const getJwtSecret = () => process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// --- LOCAL STORAGE FALLBACK ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEACHER_DB_FILE = path.join(__dirname, '../teachers_db.json');

const getLocalTeachers = () => {
    if (fs.existsSync(TEACHER_DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(TEACHER_DB_FILE, 'utf8'));
        } catch (e) {
            console.error("Error reading local teacher DB:", e);
            return [];
        }
    }
    return [];
};

const saveLocalTeacher = (teacherData) => {
    try {
        const teachers = getLocalTeachers();
        teachers.push(teacherData);
        fs.writeFileSync(TEACHER_DB_FILE, JSON.stringify(teachers, null, 2), 'utf8');
        return teacherData;
    } catch (e) {
        console.error("Error saving local teacher DB:", e);
        throw e;
    }
};

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, email } = req.body;
        console.log(`📝 Register request: ${username}`);

        // Check DB Connection State
        if (mongoose.connection.readyState === 1) {
            // --- MONGODB MODE ---
            const existing = await Teacher.findOne({ username });
            if (existing) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const teacher = new Teacher({
                username,
                password: hashedPassword,
                fullName,
                email
            });

            await teacher.save();
            console.log("✅ Registered in MongoDB");
        } else {
            // --- LOCAL FILE MODE ---
            console.warn("⚠️ MongoDB disconnected. Using local file storage for Teacher.");
            const teachers = getLocalTeachers();
            const existing = teachers.find(t => t.username === username);
            if (existing) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newTeacher = {
                _id: 'local_' + Date.now(),
                username,
                password: hashedPassword,
                fullName,
                email,
                createdAt: new Date()
            };

            saveLocalTeacher(newTeacher);
            console.log("✅ Registered in Local File");
        }

        res.json({ success: true, message: 'Đăng ký thành công!' });
    } catch (e) {
        console.error("Register Error:", e);
        res.status(500).json({ error: 'Lỗi server: ' + e.message });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`🔑 Login request: ${username}`);

        let teacher = null;

        if (mongoose.connection.readyState === 1) {
            teacher = await Teacher.findOne({ username });
        } else {
            console.warn("⚠️ MongoDB disconnected. Checking local file storage.");
            const teachers = getLocalTeachers();
            teacher = teachers.find(t => t.username === username);
        }

        // Check user
        if (!teacher) return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

        // Check password
        const validPass = await bcrypt.compare(password, teacher.password);
        if (!validPass) return res.status(400).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

        // Generate Token
        const token = jwt.sign(
            { id: teacher._id, username: teacher.username },
            getJwtSecret(),
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: teacher._id,
                username: teacher.username,
                fullName: teacher.fullName
            }
        });
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: 'Lỗi server: ' + e.message });
    }
});

export default router;
