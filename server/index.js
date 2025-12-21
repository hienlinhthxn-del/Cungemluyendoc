import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import * as xlsx from 'xlsx';
import dotenv from 'dotenv'; // Load env vars

// Helper to load env manually if not loaded (for local dev)
if (fs.existsSync('.env')) {
    dotenv.config();
}

// Setup paths for ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("-----------------------------------------");
console.log("=== KIEM TRA PHIEN BAN MOI === (UPDATED)");
console.log("STARTING FULL SERVER (ES MODULE)...");
console.log("-----------------------------------------");

const app = express();
const PORT = process.env.PORT || 10000;

// --- 1. DATABASE & PERSISTENCE ---

// In-Memory Database (Synced to Cloudinary)
let localStudents = [];
const DB_FILE = 'reading_app_db.json';
const CLOUD_DB_PUBLIC_ID = 'reading_app_db_backup.json';

// Helper: Save DB to Cloudinary (Debounced)
let saveTimeout = null;
const saveDBToCloud = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        if (!upload) return;
        try {
            console.log("☁️ Syncing Database to Cloudinary...");
            const jsonString = JSON.stringify(localStudents, null, 2);
            // We use a data URI or temp file. Multer is for incoming requests, here we use direct upload.
            // But we can upload raw string as buffer? 
            // Better: Write to temp file then upload
            const tempPath = path.join(__dirname, 'temp_db.json');
            fs.writeFileSync(tempPath, jsonString);

            await cloudinary.uploader.upload(tempPath, {
                resource_type: 'raw',
                public_id: CLOUD_DB_PUBLIC_ID,
                overwrite: true,
                invalidate: true
            });
            console.log("✅ Database Synced to Cloudinary!");
            fs.unlinkSync(tempPath);
        } catch (e) {
            console.error("❌ Failed to sync DB to Cloud:", e.message);
        }
    }, 5000); // Debounce 5s
};

// Helper: Load DB from Cloudinary
const loadDBFromCloud = async () => {
    if (!upload) return;
    try {
        console.log("☁️ Fetching Database from Cloudinary...");
        // Get the URL
        const url = cloudinary.url(CLOUD_DB_PUBLIC_ID, { resource_type: 'raw' });
        // Fetch it
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                localStudents = data;
                console.log(`✅ Loaded ${localStudents.length} students from Cloud Backup.`);
            }
        } else {
            console.log("⚠️ No Cloud Database found (First run?), starting empty.");
        }
    } catch (e) {
        console.warn("⚠️ Could not load Cloud DB:", e.message);
    }
};

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (uri) {
            await mongoose.connect(uri);
            console.log("✅ MongoDB Connected Successfully!");
        } else {
            console.warn("⚠️ MONGODB_URI missing. ACTIVATING CLOUDINARY-DB MODE.");
            // If Cloudinary configured, try to load data
            if (process.env.CLOUDINARY_CLOUD_NAME) {
                await loadDBFromCloud();
            }
        }
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
};
connectDB();

// --- 2. CLOUDINARY CONFIG ---
// Only config if ALL credentials exist
let upload = null;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim()
    });

    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'reading-app-audio',
            resource_type: 'auto',
            format: async (req, file) => {
                // Keep original extension or fallback
                return file.originalname.split('.').pop() || 'webm';
            },
        },
    });
    upload = multer({ storage: storage });
    console.log("✅ Cloudinary Configured!");
} else {
    console.warn("⚠️ Cloudinary credentials missing. Switching to Local Disk Storage.");

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir)
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            // Get extension from original name or default to webm
            const ext = file.originalname.split('.').pop() || 'webm';
            cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext)
        }
    });

    upload = multer({ storage: storage });
}

// Serve uploads folder statically so frontend can access them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 3. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Upload Middleware wrapper to catch Multer/Cloudinary errors
const uploadMiddleware = (req, res, next) => {
    if (!upload) {
        return res.status(500).json({ error: 'Cloudinary not configured on server' });
    }
    const uploader = upload.single('audioFile');
    uploader(req, res, (err) => {
        if (err) {
            console.error("❌ Upload Middleware Error:", err);
            return res.status(500).json({
                error: 'Upload Failed',
                details: err.message
            });
        }
        next();
    });
};

// --- 4. DATA MODELS (Quick inline schema) ---
const LessonAudioSchema = new mongoose.Schema({
    lessonId: String,
    text: String,
    audioUrl: String,
    createdAt: { type: Date, default: Date.now }
});
const LessonAudio = mongoose.model('LessonAudio', LessonAudioSchema);

// --- 3. STUDENT & SCORE MANAGEMENT (MONGODB) ---
const StudentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    classId: { type: String, required: false, default: 'DEFAULT' }, // NEW: Class ID
    name: { type: String, required: true },
    completedLessons: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    readingSpeed: { type: mongoose.Schema.Types.Mixed, default: 0 }, // Number or string
    history: [{
        week: Number,
        score: Number,
        speed: mongoose.Schema.Types.Mixed,
        audioUrl: String // New field for recording
    }],
    badges: [String],
    lastPractice: { type: Date, default: Date.now }
});

const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);

// --- LESSON SCHEMA & MODEL ---
const LessonSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    week: Number,
    title: String,
    description: String,
    readingText: [String],
    phonemes: [String],
    vocabulary: [String],
    questions: [{
        id: String,
        question: String,
        options: [String],
        correctAnswer: String
    }]
});
const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', LessonSchema);



// --- FILE-BASED AUDIO MAP FALLBACK (For local run without MongoDB) ---
const AUDIO_MAP_FILE = path.join(__dirname, 'audio-map.json');

const loadAudioMap = () => {
    if (fs.existsSync(AUDIO_MAP_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(AUDIO_MAP_FILE, 'utf8'));
        } catch (e) {
            console.error("Error reading audio-map.json:", e);
            return {};
        }
    }
    return {};
};

const saveAudioMap = (data) => {
    try {
        fs.writeFileSync(AUDIO_MAP_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Error writing audio-map.json:", e);
    }
};

// --- 5. API ROUTES ---

// UPLOAD STUDENT AUDIO
app.post('/api/upload-student-audio', uploadMiddleware, (req, res) => {
    if (req.file) {
        // Cloudinary/Multer usually puts the URL in 'path' or 'secure_url'
        let fileUrl = req.file.secure_url || req.file.path; // Try secure_url first (HTTPS), then path

        // Force HTTPS for Cloudinary URLs to prevent Mixed Content errors on Render
        if (fileUrl && fileUrl.startsWith('http:') && fileUrl.includes('cloudinary.com')) {
            fileUrl = fileUrl.replace('http:', 'https:');
        }

        // If we are using local disk storage (fallback), req.file.path is a system path.
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            const filename = req.file.filename;
            fileUrl = `/uploads/${filename}`;
        }

        console.log("✅ File uploaded, URL:", fileUrl);
        res.json({ url: fileUrl });
    } else {
        res.status(400).json({ error: 'No audio file uploaded' });
    }
});

// GET All Students (Filtered by ClassId)
app.get('/api/students', async (req, res) => {
    try {
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
        if (classId && classId !== 'DEFAULT') {
            filtered = localStudents.filter(s => s.classId === classId);
        }
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE / SYNC Student
app.post('/api/students', async (req, res) => {
    try {
        const data = req.body;

        if (mongoose.connection.readyState === 1) {
            // ... MongoDB Logic (Same as before but specific fields)
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
            // Merge updates
            localStudents[idx] = { ...localStudents[idx], ...data, lastPractice: new Date() };
        } else {
            localStudents.push({ ...data, lastPractice: new Date(), history: data.history || [] });
        }

        saveDBToCloud(); // Trigger Sync
        res.json(localStudents.find(s => s.id === data.id));

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE Progress (After Lesson)
app.post('/api/students/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const { score, speed, week, lessonTitle, audioUrl } = req.body;

        if (mongoose.connection.readyState === 1) {
            const student = await Student.findOne({ id });
            if (!student) return res.status(404).json({ error: 'Student not found' });

            // Update History for this week
            const historyIndex = student.history.findIndex(h => h.week === week);
            if (historyIndex >= 0) {
                student.history[historyIndex].score = score;
                student.history[historyIndex].speed = speed;
                if (audioUrl) student.history[historyIndex].audioUrl = audioUrl;
            } else {
                student.history.push({ week, score, speed, audioUrl });
            }

            // Recalc Stats
            const totalScore = student.history.reduce((acc, h) => acc + h.score, 0);
            student.averageScore = Math.round(totalScore / student.history.length);
            student.completedLessons = student.history.length;
            student.readingSpeed = speed;
            student.lastPractice = new Date();

            await student.save();
            return res.json(student);
        }

        // Fallback: Update Local Data
        const idx = localStudents.findIndex(s => s.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Student not found in Local DB' });

        const student = localStudents[idx];
        const historyIndex = student.history.findIndex(h => h.week === week);

        if (historyIndex >= 0) {
            student.history[historyIndex].score = score;
            student.history[historyIndex].speed = speed;
            if (audioUrl) student.history[historyIndex].audioUrl = audioUrl;
        } else {
            student.history.push({ week, score, speed, audioUrl });
        }

        const totalScore = student.history.reduce((acc, h) => acc + h.score, 0);
        student.averageScore = Math.round(totalScore / student.history.length);
        student.completedLessons = student.history.length;
        student.readingSpeed = speed;
        student.lastPractice = new Date();

        localStudents[idx] = student;
        saveDBToCloud(); // Sync
        res.json(student);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Student
app.delete('/api/students/:id', async (req, res) => {
    try {
        await Student.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- IMPORT STUDENTS FROM EXCEL ---
const uploadTemp = multer({ dest: 'uploads/temp/' });
app.post('/api/students/import', uploadTemp.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log("📂 Processing Excel file:", req.file.path);
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let count = 0;
        const classId = req.body.classId || '1A3';

        console.log(`📊 Found ${data.length} rows. Target Class: ${classId}`);

        for (const row of data) {
            // Flexible column names
            const name = row['Họ và tên'] || row['Name'] || row['Tên'] || row['Họ tên'] || row['student_name'];
            if (!name) continue;

            const studentId = `s${Date.now()}${Math.floor(Math.random() * 1000)}`;

            const newStudent = {
                id: studentId,
                name: String(name).trim(),
                classId: classId,
                completedLessons: 0,
                averageScore: 0,
                readingSpeed: 0,
                history: [],
                lastPractice: new Date(),
                badges: []
            };


            if (mongoose.connection.readyState === 1) {
                await Student.create(newStudent);
            } else {
                // Fallback: Add to Local DB
                localStudents.push(newStudent);
            }
            count++;
        }

        // Sync if in fallback mode
        if (mongoose.connection.readyState !== 1) {
            saveDBToCloud();
        }

        // Cleanup temp file
        try { fs.unlinkSync(req.file.path); } catch (e) {
            console.error("Warning: Could not delete temp file", e);
        }

        console.log(`✅ Imported ${count} students successfully.`);
        res.json({ success: true, count, message: `Thêm thành công ${count} học sinh!` });


    } catch (error) {
        console.error("❌ Import Failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- LESSON MANAGEMENT ROUTES ---

// GET All Lessons
app.get('/api/lessons', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json([]);
        const lessons = await Lesson.find().sort({ week: 1 });
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE / UPDATE Lesson
app.post('/api/lessons', async (req, res) => {
    try {
        const lessonData = req.body;
        // Upsert based on lesson ID
        const lesson = await Lesson.findOneAndUpdate(
            { id: lessonData.id },
            { $set: lessonData },
            { new: true, upsert: true }
        );
        res.json(lesson);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Lesson
app.delete('/api/lessons/:id', async (req, res) => {
    try {
        await Lesson.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health Check & Debug Info
app.get('/api/health', (req, res) => {
    const isMongoUriSet = !!process.env.MONGODB_URI;
    const isCloudinarySet = !!process.env.CLOUDINARY_CLOUD_NAME;

    res.json({
        status: 'ok',
        environment: {
            mongo_uri_configured: isMongoUriSet,
            cloudinary_configured: isCloudinarySet,
            node_env: process.env.NODE_ENV || 'development'
        },
        mongo_status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        // Show which storage is active
        storage_mode: isCloudinarySet ? 'CLOUDINARY (Persistent)' : 'DISK (Ephemeral/Temporary)',
        // Debug tips
        message: !isMongoUriSet
            ? '⚠️ WARNING: MONGODB_URI is not set. Data will be lost when server restarts!'
            : '✅ Persistence configured correctly.'
    });
});

// Upload Audio Route
app.post('/api/lessons/:lessonId/custom-audio', uploadMiddleware, async (req, res) => {
    try {
        console.log("📥 Upload Request Received for:", req.body.text);
        console.log("📁 File info:", req.file);

        if (!req.file) {
            console.error("❌ No file in request");
            return res.status(400).json({ error: 'No audio file received' });
        }

        const { lessonId } = req.params;
        const { text } = req.body;

        // Force HTTPS for Cloudinary
        let audioUrl = req.file.secure_url || req.file.path;
        if (audioUrl && audioUrl.startsWith('http:') && audioUrl.includes('cloudinary.com')) {
            audioUrl = audioUrl.replace('http:', 'https:');
        }

        console.log("✅ Cloudinary URL generated:", audioUrl);

        // Save to DB (or JSON fallback)
        if (mongoose.connection.readyState === 1) {
            await LessonAudio.findOneAndUpdate(
                { lessonId, text },
                { audioUrl },
                { upsert: true, new: true }
            );
            console.log("✅ Saved to MongoDB");
        } else {
            console.warn("⚠️ MongoDB not connected, skipping DB save. Saving to audio-map.json");
            const map = loadAudioMap();
            if (!map[lessonId]) map[lessonId] = {};
            map[lessonId][text] = audioUrl;
            saveAudioMap(map);
        }

        res.json({ audioUrl, text });
    } catch (error) {
        console.error("❌ Processing Error:", error);
        res.status(500).json({ error: 'Server processing failed', details: error.message });
    }
});

// Get Audio Mapping Route
app.get('/api/lessons/:lessonId/custom-audio', async (req, res) => {
    try {
        const { lessonId } = req.params;

        // Prioritize Mongo if connected
        if (mongoose.connection.readyState === 1) {
            const audios = await LessonAudio.find({ lessonId });
            // Convert to map: { "text": "url" }
            const audioMap = audios.reduce((acc, curr) => {
                acc[curr.text || ""] = curr.audioUrl;
                return acc;
            }, {});
            return res.json(audioMap);
        }

        // Fallback to local JSON map
        console.log(`⚠️ MongoDB disconnected. reading from audio-map.json for lesson ${lessonId}`);
        const map = loadAudioMap();
        res.json(map[lessonId] || {});
    } catch (error) {
        console.error("Fetch Audio Error:", error);
        res.status(500).json({ error: 'Failed to fetch audio' });
    }
});

// --- DEBUG ROUTE: Check Cloudinary Connection ---
app.get('/api/test-cloudinary', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return res.status(500).json({
                status: 'error',
                message: 'Missing Environment Variables',
                env: {
                    cloud_name: !!process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: !!process.env.CLOUDINARY_API_KEY,
                    api_secret: !!process.env.CLOUDINARY_API_SECRET
                }
            });
        }

        // Try to ping Cloudinary by verifying credentials
        const result = await cloudinary.api.ping();
        res.json({
            status: 'success',
            message: 'Cloudinary Connected Successfully!',
            details: result
        });
    } catch (error) {
        console.error("Cloudinary Test Error:", error);
        res.status(500).json({
            status: 'error',
            message: 'Cloudinary Connection Failed',
            error: error.message
        });
    }
});


// --- 5. DATA RECOVERY (Restore DB from Cloudinary Files) ---
app.post('/api/admin/recover-from-cloud', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return res.status(400).json({ error: 'Cloudinary not configured' });
        }

        console.log("🔄 STARTING RECOVERY from Cloudinary...");

        // 1. Fetch all files from Cloudinary (Check both 'image' default and 'video' for audio)
        let resources = [];
        const resourceTypes = ['image', 'video', 'raw']; // Audio often falls under video or raw in Cloudinary

        for (const type of resourceTypes) {
            let nextCursor = null;
            try {
                do {
                    const result = await cloudinary.api.resources({
                        resource_type: type,
                        type: 'upload',
                        prefix: 'reading-app-audio/', // Folder prefix
                        max_results: 500,
                        next_cursor: nextCursor
                    });
                    resources = [...resources, ...result.resources];
                    nextCursor = result.next_cursor;
                } while (nextCursor);
            } catch (e) {
                console.warn(`Skipping resource type ${type}:`, e.message);
            }
        }

        console.log(`📂 Found ${resources.length} files on Cloudinary.`);

        let restoredCount = 0;

        // 2. Loop through files and match to students
        for (const file of resources) {
            // Filename format: "reading-app-audio/student_ID_wWEEK.EXT"
            const publicId = file.public_id; // "reading-app-audio/student_s123456789_w14"
            const parts = publicId.split('/').pop().split('_');

            // Expected parts: ["student", "s123456789", "w14"]
            if (parts.length >= 3 && parts[0] === 'student') {
                const studentId = parts[1];
                const weekStr = parts[2]; // "w14"
                const week = parseInt(weekStr.replace('w', ''));

                if (!studentId || isNaN(week)) continue;

                // Construct HTTPS URL
                const audioUrl = file.secure_url;

                // LOGIC SPLIT: MONGO vs LOCAL
                if (mongoose.connection.readyState === 1) {
                    // --- MONGO DB MODE ---
                    let student = await Student.findOne({ id: studentId });

                    if (!student) {
                        student = new Student({
                            id: studentId,
                            name: `Học sinh (Khôi phục ${studentId.substr(-4)})`,
                            classId: 'RECOVERED',
                            completedLessons: 0,
                            averageScore: 0,
                            history: []
                        });
                        console.log(`➕ Created missing student: ${studentId}`);
                    }

                    // Update History
                    const historyIndex = student.history.findIndex(h => h.week === week);
                    if (historyIndex === -1) {
                        student.history.push({
                            week: week,
                            score: 0,
                            speed: 0,
                            audioUrl: audioUrl
                        });
                        restoredCount++;
                    } else if (!student.history[historyIndex].audioUrl) {
                        student.history[historyIndex].audioUrl = audioUrl;
                        restoredCount++;
                    }

                    student.completedLessons = student.history.length;
                    await student.save();
                } else {
                    // --- LOCAL / CLOUDINARY DB MODE ---
                    let idx = localStudents.findIndex(s => s.id === studentId);
                    if (idx === -1) {
                        localStudents.push({
                            id: studentId,
                            name: `Học sinh (Khôi phục ${studentId.substr(-4)})`,
                            classId: 'RECOVERED',
                            completedLessons: 0,
                            averageScore: 0,
                            history: [],
                            lastPractice: new Date()
                        });
                        idx = localStudents.length - 1;
                        console.log(`➕ Created missing student (Local): ${studentId}`);
                    }

                    const student = localStudents[idx];
                    const historyIndex = student.history.findIndex(h => h.week === week);

                    if (historyIndex === -1) {
                        student.history.push({ week, score: 0, speed: 0, audioUrl });
                        restoredCount++;
                    } else if (!student.history[historyIndex].audioUrl) {
                        student.history[historyIndex].audioUrl = audioUrl;
                        restoredCount++;
                    }

                    student.completedLessons = student.history.length;
                    localStudents[idx] = student;
                }
            }
        }

        // 3. Sync if needed
        if (mongoose.connection.readyState !== 1 && restoredCount > 0) {
            saveDBToCloud();
        }

        console.log(`✅ Recovery Complete. Restored/Linked ${restoredCount} items.`);
        res.json({
            success: true,
            totalFiles: resources.length,
            restoredCount: restoredCount,
            message: `Tìm thấy ${resources.length} file. Đã khôi phục liên kết cho ${restoredCount} bài đọc.`
        });

    } catch (error) {
        console.error("Recovery Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- 6. SERVE FRONTEND ---
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    console.log("Serving frontend from:", distPath);
    app.use(express.static(distPath));
    // SPA Fallback
    app.get(/.*/, (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
} else {
    // Default Home for API-only mode
    app.get('/', (req, res) => {
        res.send('Server is running (API mode). Frontend not found.');
    });
}


// WRAP STARTUP IN ASYNC TO WAIT FOR DB/DATA LOAD
const startServer = async () => {
    console.log("⏳ Initializing Data Connection...");
    await connectDB();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 FULL SERVER running on port ${PORT}`);
        console.log(`👉 Local: http://localhost:${PORT}`);
    });
};

startServer();

