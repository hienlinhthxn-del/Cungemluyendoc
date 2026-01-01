import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv'; // Load env vars
if (fs.existsSync('.env')) {
    dotenv.config();
}

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import * as xlsx from 'xlsx';

// Import modular routes
import studentRoutes from './studentRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import classRoutes from './classRoutes.js';
import authMiddleware from './middleware/authMiddleware.js';

// --- GLOBAL ERROR HANDLERS ---
// These should be at the top to catch errors early.
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
    // Crash the process. This is safer than continuing in an unknown state.
    // It will make Render show the error in the logs instead of hanging.
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    process.exit(1); // Mandatory exit
});

// Import Models
import Student from '../Student.js';
import Lesson from './Lesson.js';
import ClassModel from './Class.js';
import Communication from './models/Communication.js';
import authRoutes from './routes/authRoutes.js';
import LessonAudio from './models/LessonAudio.js';
import { DEFAULT_LESSONS } from './data/defaultLessons.js';

// JWT_SECRET is accessed via this helper to ensure we always get the latest env value
const getJwtSecret = () => process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// Setup paths for ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DEBUG: Print critical environment variables at startup ---
console.log("--- Environment Variable Check (Render Debug) ---");
console.log(`- MONGODB_URI is set: ${!!process.env.MONGODB_URI}`);
// Log only a small, non-sensitive part of the URI to confirm it's there
console.log(`- MONGODB_URI value (first 5 chars): ${process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 5) + '...' : 'Not Set'}`);
console.log(`- CLOUDINARY_CLOUD_NAME is set: ${!!process.env.CLOUDINARY_CLOUD_NAME}`);
console.log("-------------------------------------------------");

console.log("-----------------------------------------");
console.log("=== KIEM TRA PHIEN BAN MOI === (UPDATED)");
console.log("STARTING FULL SERVER (ES MODULE)...");
console.log("-----------------------------------------");

const app = express();
const PORT = process.env.PORT || 10001;

// --- 1. DATABASE & PERSISTENCE ---

// In-Memory Database (Synced to Cloudinary)
// In-Memory Database (Synced to Cloudinary)
// Declarations moved to line ~280 to group with persistence logic
// let localStudents = []; 
// const DB_FILE = 'reading_app_db.json';
// const CLOUD_DB_PUBLIC_ID = 'reading_app_db_backup.json';

// --- Generic Helper to Debounce Cloudinary JSON Uploads ---
// --- Generic Helper to Debounce Cloudinary JSON Uploads & Local Save ---
const createDebouncedUploader = (publicId, getDataFn, entityName, localFilename) => {
    let timeoutId = null;
    return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
            const data = getDataFn();
            const jsonString = JSON.stringify(data, null, 2);

            // 1. SAVE TO LOCAL FILE (Always, as primary or backup)
            if (localFilename) {
                try {
                    const localPath = path.join(__dirname, '..', localFilename);
                    fs.writeFileSync(localPath, jsonString, 'utf8');
                    console.log(`💾 Saved ${entityName} to local file: ${localFilename}`);
                } catch (e) {
                    console.error(`❌ Failed to save ${entityName} locally:`, e.message);
                }
            }

            // 2. SYNC TO CLOUDINARY (If Configured)
            if (process.env.CLOUDINARY_CLOUD_NAME) {
                try {
                    console.log(`☁️ Syncing ${entityName} to Cloudinary...`);

                    // Use upload_stream to avoid writing a temporary file to disk
                    await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            { resource_type: 'raw', public_id: publicId, overwrite: true, invalidate: true },
                            (error, result) => {
                                if (error) return reject(error);
                                resolve(result);
                            }
                        );
                        uploadStream.end(jsonString);
                    });

                    console.log(`✅ ${entityName} Synced to Cloudinary!`);
                } catch (e) {
                    console.error(`❌ Failed to sync ${entityName} to Cloud:`, e.message);
                }
            }
        }, 2000); // Debounce
    };
};

// Helper: Load DB from Cloudinary
const loadDBFromCloud = async () => {
    // Only sync if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) return;

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

const seedDefaultLessons = async () => {
    try {
        const count = await Lesson.countDocuments({ teacherId: null });
        console.log(`🌱 Checking database lessons (Global count: ${count})...`);

        for (const defaultLesson of DEFAULT_LESSONS) {
            const existing = await Lesson.findOne({ id: defaultLesson.id, teacherId: null });
            if (!existing) {
                const newLesson = new Lesson({ ...defaultLesson, teacherId: null });
                await newLesson.save();
                console.log(`   + Added missing lesson: ${defaultLesson.id} (Week ${defaultLesson.week})`);
            }
        }
        console.log("✅ Seeding check complete.");
    } catch (e) {
        console.error("❌ Seeding failed:", e.message);
    }
};

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (uri) {
            // --- Logic kết nối nâng cao với các trình theo dõi sự kiện ---
            // Các trình theo dõi này sẽ giúp chúng ta gỡ lỗi khi mất kết nối.
            mongoose.connection.on('connected', () => {
                console.log('✅ Mongoose đã kết nối thành công với cơ sở dữ liệu.');
            });

            mongoose.connection.on('error', (err) => {
                console.error('❌ Lỗi kết nối Mongoose sau khi kết nối ban đầu:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ Mất kết nối Mongoose. Ứng dụng sẽ cố gắng kết nối lại.');
            });

            // Đối với Mongoose 6+, hầu hết các tùy chọn được xử lý mặc định.
            // Các tùy chọn này có thể giúp ổn định trên các nền tảng đám mây.
            const options = {
                serverSelectionTimeoutMS: 30000, // Tiếp tục cố gắng chọn máy chủ trong 30 giây
                socketTimeoutMS: 45000, // Đóng socket sau 45 giây không hoạt động
            };

            await mongoose.connect(uri, options);
            // Trình theo dõi sự kiện 'connected' bây giờ sẽ ghi lại thông báo thành công.

            // --- SEED DATA ---
            await seedDefaultLessons();

            // --- INDEX CLEANUP (One-time for multi-tenancy migration) ---
            try {
                // Check if the old 'id_1' index exists and drop it
                const indexes = await Lesson.collection.indexes();
                const hasOldIndex = indexes.some(idx => idx.name === 'id_1' || (idx.key.id === 1 && Object.keys(idx.key).length === 1));
                if (hasOldIndex) {
                    console.log("🧹 Dropping old 'id_1' unique index to support multi-tenancy...");
                    await Lesson.collection.dropIndex('id_1').catch(e => console.log("   (Index id_1 might have already been dropped or named differently)"));
                }
            } catch (e) {
                console.warn("⚠️ Could not cleanup legacy indexes:", e.message);
            }

            // --- DATA CLEANUP: Fix malformed URLs (one-time) ---
            try {
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                console.log("🛠️ Checking for malformed audio URLs...");

                const fixUrl = (url) => {
                    if (!url) return url;
                    // Case 1: /uploads/http... (already handled but keep for safety)
                    if (url.startsWith('/uploads/http')) {
                        return url.replace(/^\/uploads\//, '').replace('http:', 'https:');
                    }
                    // Case 2: /uploads/reading-app-audio/... (The current culprit)
                    if (url.startsWith('/uploads/reading-app-audio/') && cloudName) {
                        const path = url.replace(/^\/uploads\//, '');
                        return `https://res.cloudinary.com/${cloudName}/video/upload/${path}`;
                    }
                    return url;
                };

                // 1. Fix LessonAudio
                const badAudios = await LessonAudio.find({
                    $or: [
                        { audioUrl: { $regex: /^\/uploads\/http/ } },
                        { audioUrl: { $regex: /^\/uploads\/reading-app-audio/ } }
                    ]
                });
                if (badAudios.length > 0) {
                    console.log(`   - Found ${badAudios.length} malformed LessonAudio URLs. Fixing...`);
                    for (const doc of badAudios) {
                        const old = doc.audioUrl;
                        doc.audioUrl = fixUrl(doc.audioUrl);
                        if (old !== doc.audioUrl) await doc.save();
                    }
                }

                // 2. Fix Student History
                const studentsWithBadUrls = await Student.find({
                    "history": {
                        $elemMatch: {
                            $or: [
                                { audioUrl: { $regex: /^\/uploads\/(http|reading-app-audio)/ } },
                                { phonemeAudioUrl: { $regex: /^\/uploads\/(http|reading-app-audio)/ } },
                                { wordAudioUrl: { $regex: /^\/uploads\/(http|reading-app-audio)/ } },
                                { readingAudioUrl: { $regex: /^\/uploads\/(http|reading-app-audio)/ } }
                            ]
                        }
                    }
                });

                if (studentsWithBadUrls.length > 0) {
                    console.log(`   - Found ${studentsWithBadUrls.length} students with malformed URLs. Fixing history...`);
                    for (const student of studentsWithBadUrls) {
                        let changed = false;
                        student.history = student.history.map(h => {
                            const fields = ['audioUrl', 'phonemeAudioUrl', 'wordAudioUrl', 'readingAudioUrl'];
                            fields.forEach(f => {
                                const old = h[f];
                                h[f] = fixUrl(h[f]);
                                if (old !== h[f]) changed = true;
                            });
                            return h;
                        });
                        if (changed) {
                            student.markModified('history');
                            await student.save();
                        }
                    }
                }
                console.log("✅ Data cleanup complete.");
            } catch (e) {
                console.warn("⚠️ Data cleanup failed:", e.message);
            }
        } else {
            console.warn("⚠️ MONGODB_URI missing. ACTIVATING CLOUDINARY-DB MODE.");
            // If Cloudinary configured, try to load data
            if (process.env.CLOUDINARY_CLOUD_NAME) {
                await loadDBFromCloud();
                await loadClassesFromCloud();
            }
        }
    } catch (error) {
        console.error("❌ Lỗi kết nối MongoDB ban đầu:", error);
        // Re-throw the error to ensure the startup process knows about the failure.
        throw error;
    }
};

// --- 2. CLOUDINARY CONFIG ---
// Only config if ALL credentials exist
let upload = null;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// --- DEBUG: Check if environment variables are loaded ---
console.log("--- Cloudinary Env Var Check ---");
console.log(`- CLOUDINARY_CLOUD_NAME is set: ${!!cloudName}`);
console.log(`- CLOUDINARY_API_KEY is set:    ${!!apiKey}`);
console.log(`- CLOUDINARY_API_SECRET is set: ${!!apiSecret}`);
console.log("--------------------------------");

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
            public_id: (req, file) => {
                // Use original filename (without extension) + timestamp to ensure uniqueness
                const name = file.originalname.split('.')[0];
                return `${name}_${Date.now()}`;
            }
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

// --- 4. DATA MODELS ---
// LessonAudio model is now imported from ./models/LessonAudio.js

// In-Memory Database (Synced to Cloudinary & Local File)
let localStudents = [];
const DB_FILE = 'reading_app_db.json'; // Public ID
const CLOUD_DB_PUBLIC_ID = 'reading_app_db_backup.json';
const LOCAL_DB_FILENAME = 'students_db.json'; // Local Filename

// In-Memory Classes (Synced to Cloudinary & Local File)
let localClasses = [];


const CLOUD_CLASSES_DB_PUBLIC_ID = 'reading_app_classes_backup.json';
const LOCAL_CLASSES_FILENAME = 'classes_db.json';

// --- DATA LOADING LOGIC ---
const loadLocalData = () => {
    // 1. Students
    const studentPath = path.join(__dirname, '..', LOCAL_DB_FILENAME);
    if (fs.existsSync(studentPath)) {
        try {
            localStudents = JSON.parse(fs.readFileSync(studentPath, 'utf8'));
            console.log(`📂 Loaded ${localStudents.length} students from local file.`);
        } catch (e) {
            console.error("Error loading local students:", e);
        }
    }

    // 2. Classes
    const classPath = path.join(__dirname, '..', LOCAL_CLASSES_FILENAME);
    if (fs.existsSync(classPath)) {
        try {
            localClasses = JSON.parse(fs.readFileSync(classPath, 'utf8'));
            console.log(`📂 Loaded ${localClasses.length} classes from local file.`);
        } catch (e) {
            console.error("Error loading local classes:", e);
        }
    }
};

// Initial Load
loadLocalData();

// Create specific uploader instances using the generic helper
const saveDBToCloud = createDebouncedUploader(CLOUD_DB_PUBLIC_ID, () => localStudents, 'Student Database', LOCAL_DB_FILENAME);
const saveClassesToCloud = createDebouncedUploader(CLOUD_CLASSES_DB_PUBLIC_ID, () => localClasses, 'Classes Database', LOCAL_CLASSES_FILENAME);

// Helper: Load Classes from Cloudinary
const loadClassesFromCloud = async () => {
    // Only sync if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) return;

    try {
        console.log("☁️ Fetching Classes from Cloudinary...");
        const url = cloudinary.url(CLOUD_CLASSES_DB_PUBLIC_ID, { resource_type: 'raw' });
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                localClasses = data;
                console.log(`✅ Loaded ${localClasses.length} classes from Cloud Backup.`);
            }
        } else {
            console.log("⚠️ No Cloud Classes found, using default.");
        }
    } catch (e) {
        console.warn("⚠️ Could not load Cloud Classes:", e.message);
    }
};



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
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes(localStudents, saveDBToCloud, localClasses));

app.use('/api/lessons', lessonRoutes(uploadMiddleware, LessonAudio));

app.use('/api/classes', classRoutes(localClasses, saveClassesToCloud));

// --- COMMUNICATION ROUTES (New) ---
const COMM_FILE = path.join(__dirname, 'communication-data.json');
const getLocalComms = () => {
    if (fs.existsSync(COMM_FILE)) {
        try { return JSON.parse(fs.readFileSync(COMM_FILE, 'utf8')); } catch (e) { return []; }
    }
    return [];
};
const saveLocalComms = (data) => {
    try { fs.writeFileSync(COMM_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { console.error(e); }
};

app.get('/api/communications', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            // MongoDB Connected
            const comms = await Communication.find({}).sort({ timestamp: -1 });
            return res.json(comms);
        } else {
            // Local fallback
            return res.json(getLocalComms().sort((a, b) => b.timestamp - a.timestamp));
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/communications', async (req, res) => {
    try {
        const commData = req.body;
        if (!commData.content) return res.status(400).json({ error: "Missing content" });

        if (mongoose.connection.readyState === 1) {
            const newComm = new Communication(commData);
            await newComm.save();
            return res.json(newComm);
        } else {
            const list = getLocalComms();
            list.push(commData);
            saveLocalComms(list);
            return res.json(commData);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Route để học sinh nộp bài
app.post('/api/submissions', uploadMiddleware, async (req, res) => {
    const { studentId, week, part, score } = req.body; // Thêm 'score'
    const audioFile = req.file;

    if (!studentId || !week || !part || !audioFile) {
        return res.status(400).json({ error: 'Missing required submission data.' });
    }

    let audioUrl;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (audioFile.path && (audioFile.path.startsWith('http') || audioFile.path.startsWith('https'))) {
        audioUrl = audioFile.path.replace('http:', 'https:');
    } else if (audioFile.secure_url) {
        audioUrl = audioFile.secure_url.replace('http:', 'https:');
    } else if (cloudName && (audioFile.path?.includes('reading-app-audio') || audioFile.filename?.includes('reading-app-audio'))) {
        // If it's Cloudinary (relative path or filename), fix it
        const path = (audioFile.path || audioFile.filename).replace(/^\/uploads\//, '');
        audioUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${path}`;
    } else {
        // Local Disk Storage fallback
        audioUrl = `/uploads/${audioFile.filename}`;
    }

    console.log(`[SUBMISSION] Final Audio URL: ${audioUrl}`);

    // --- DEBUGGING STEP: Log the connection state right before use ---
    console.log(`[SUBMISSION] API called. Checking DB connection state...`);
    console.log(`- mongoose.connection.readyState: ${mongoose.connection.readyState} (1 = connected, 0 = disconnected)`);
    // --- END DEBUGGING STEP ---

    const useMongo = mongoose.connection.readyState === 1;
    const audioUrlKey = `${part}AudioUrl`;
    const scoreKey = `${part}Score`;

    try {
        if (useMongo) {
            const student = await Student.findOne({ id: studentId });
            if (!student) return res.status(404).json({ error: 'Student not found' });

            let historyRecord = student.history.find(h => h.week === Number(week));
            if (historyRecord) {
                historyRecord[audioUrlKey] = audioUrl; // Cập nhật audio
                if (score !== undefined) {
                    historyRecord[scoreKey] = Number(score); // Cập nhật điểm thành phần

                    // --- TÍNH LẠI ĐIỂM TRUNG BÌNH (Server Calculation) ---
                    // Lấy các điểm thành phần hiện tại (hoặc vừa được cập nhật)
                    const pScore = scoreKey === 'phonemeScore' ? Number(score) : historyRecord.phonemeScore;
                    const wScore = scoreKey === 'wordScore' ? Number(score) : historyRecord.wordScore;
                    const rScore = scoreKey === 'readingScore' ? Number(score) : historyRecord.readingScore;

                    // Chỉ tính trung bình trên các phần ĐÃ CÓ ĐIỂM
                    const availableScores = [pScore, wScore, rScore].filter(s => s !== undefined && s !== null);
                    if (availableScores.length > 0) {
                        const newTotal = Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length);
                        historyRecord.score = newTotal;
                    }
                }
            } else {
                student.history.push({
                    week: Number(week),
                    score: Number(score) || 0, // Điểm ban đầu
                    speed: 0,
                    [audioUrlKey]: audioUrl,
                    [scoreKey]: Number(score)
                });
            }
            await student.save();
        } else {
            const studentIndex = localStudents.findIndex(s => s.id === studentId);
            if (studentIndex === -1) return res.status(404).json({ error: 'Student not found' });

            const student = localStudents[studentIndex];
            let historyRecord = student.history.find(h => h.week === Number(week));
            if (historyRecord) {
                historyRecord[audioUrlKey] = audioUrl; // Cập nhật audio
                if (score !== undefined) historyRecord[scoreKey] = Number(score); // Cập nhật điểm
            } else {
                student.history.push({ week: Number(week), score: 0, speed: 0, [audioUrlKey]: audioUrl, [scoreKey]: Number(score) });
            }
            saveDBToCloud();
        }
        res.status(201).json({
            success: true,
            audioUrl,
            part,
            score: Number(score)
        });
    } catch (error) {
        console.error('Error saving submission:', error);
        res.status(500).json({ error: 'Failed to save submission.' });
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

// Submissions and Communications routes remain in index.js for now.
// Custom lesson audio routes have been refactored into lessonRoutes.js.

// --- 4. DEBUG & HEALTH UTILS ---
app.get('/api/debug-files', (req, res) => {
    try {
        const uploadDir = path.join(__dirname, 'uploads');
        const exists = fs.existsSync(uploadDir);
        let files = [];
        if (exists) {
            files = fs.readdirSync(uploadDir);
        }
        res.json({
            uploadDir,
            exists,
            node_env: process.env.NODE_ENV,
            __dirname,
            files: files.slice(-20) // show last 20 files
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/test-cloudinary', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return res.json({
                status: 'local_mode',
                message: 'Cloudinary not configured (Local Mode)',
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


// --- 5. DATA RECOVERY HELPERS ---
const recoveryService = {
    /** Fetches all resources from a Cloudinary folder, handling pagination. */
    async fetchAllCloudinaryResources(prefix) {
        let resources = [];
        const resourceTypes = ['video', 'raw', 'image']; // Search in this order
        for (const type of resourceTypes) {
            let nextCursor = null;
            try {
                do {
                    const result = await cloudinary.api.resources({
                        resource_type: type, type: 'upload', prefix, max_results: 500, next_cursor: nextCursor
                    });
                    resources = [...resources, ...result.resources];
                    nextCursor = result.next_cursor;
                } while (nextCursor);
            } catch (e) {
                console.warn(`Skipping resource type ${type}:`, e.message);
            }
        }
        return resources;
    },

    /** Parses a resource to find studentId and week. */
    parseResourceForStudent(resource) {
        const filename = resource.public_id.split('/').pop();
        const originalName = resource.original_filename || "";
        const regex = /student_([a-zA-Z0-9_-]+)_w(\d+)/;

        let match = filename.match(regex) || (originalName && originalName.match(regex));
        if (!match) return null;

        return { studentId: match[1], week: parseInt(match[2]) };
    },

    /** Updates or creates a student record with the recovered audio URL. */
    async updateStudentWithAudio(studentId, week, audioUrl, localStudents) {
        let wasUpdated = false;
        if (mongoose.connection.readyState === 1) {
            let student = await Student.findOne({ id: studentId });
            if (!student) {
                const blockedIdsString = process.env.RECOVERY_BLOCKED_IDS || '';
                if (blockedIdsString.split(',').includes(studentId)) return false;
                student = new Student({ id: studentId, name: `Học sinh (Khôi phục ${studentId.substr(-4)})`, classId: 'RECOVERED', history: [] });
            }

            const historyIndex = student.history.findIndex(h => h.week === week);
            if (historyIndex === -1) {
                student.history.push({ week, score: 0, speed: 0, audioUrl });
                wasUpdated = true;
            } else if (!student.history[historyIndex].audioUrl) {
                student.history[historyIndex].audioUrl = audioUrl;
                wasUpdated = true;
            }
            if (wasUpdated) {
                student.completedLessons = student.history.length;
                await student.save();
            }
        } else {
            // Local mode
            let idx = localStudents.findIndex(s => s.id === studentId);
            if (idx === -1) {
                localStudents.push({ id: studentId, name: `Học sinh (Khôi phục ${studentId.substr(-4)})`, classId: 'RECOVERED', history: [], lastPractice: new Date() });
                idx = localStudents.length - 1;
            }
            const student = localStudents[idx];
            const historyIndex = student.history.findIndex(h => h.week === week);
            if (historyIndex === -1) {
                student.history.push({ week, score: 0, speed: 0, audioUrl });
                wasUpdated = true;
            } else if (!student.history[historyIndex].audioUrl) {
                student.history[historyIndex].audioUrl = audioUrl;
                wasUpdated = true;
            }
            if (wasUpdated) {
                student.completedLessons = student.history.length;
                localStudents[idx] = student;
            }
        }
        return wasUpdated;
    }
};

app.post('/api/admin/recover-from-cloud', async (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(400).json({ error: 'Cloudinary not configured' });
    }

    console.log("🔄 STARTING RECOVERY from Cloudinary...");
    const resources = await recoveryService.fetchAllCloudinaryResources('reading-app-audio/');
    console.log(`📂 Found ${resources.length} files on Cloudinary.`);

    let restoredCount = 0;
    const unmatchedFiles = [];

    for (const file of resources) {
        const match = recoveryService.parseResourceForStudent(file);
        if (match) {
            const updated = await recoveryService.updateStudentWithAudio(match.studentId, match.week, file.secure_url, localStudents);
            if (updated) restoredCount++;
        } else {
            const debugStr = `${file.public_id.split('/').pop()}${file.original_filename ? ' (' + file.original_filename + ')' : ''}`;
            if (unmatchedFiles.length < 5) unmatchedFiles.push(debugStr);
        }
    }

    if (mongoose.connection.readyState !== 1 && restoredCount > 0) {
        saveDBToCloud();
    }

    console.log(`✅ Recovery Complete. Restored/Linked ${restoredCount} items.`);
    let msg = `Tìm thấy ${resources.length} file. Đã khôi phục liên kết cho ${restoredCount} bài đọc.`;
    if (restoredCount === 0 && unmatchedFiles.length > 0) {
        msg += ` (Mẫu file lạ: ${unmatchedFiles.join(', ')}...)`;
    }

    res.json({
        success: true,
        totalFiles: resources.length,
        restoredCount: restoredCount,
        message: msg
    });
});

// --- 6. LOST & FOUND (List all Cloudinary files) ---
app.get('/api/admin/cloudinary-files', async (req, res) => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return res.status(500).json({ error: 'Cloudinary not configured' });
        }

        const nextCursor = req.query.next_cursor || null;

        // Fetch 'video' (audio) and 'raw' and 'image' mixed? 
        // Cloudinary API doesn't allow mixed resource_type in one call easily unless using 'search' (advanced).
        // For simplicity, we'll fetch 'video' which covers most audio uploads from this app.
        // If user says "still missing", we might add a toggle for 'raw'.

        const result = await cloudinary.api.resources({
            resource_type: 'video', // Most audios are webm/mp4 -> video
            type: 'upload',
            prefix: 'reading-app-audio/',
            max_results: 50,
            next_cursor: nextCursor,
            sort_by: 'created_at',
            direction: 'desc'
        });

        res.json({
            files: result.resources.map(f => ({
                public_id: f.public_id,
                url: f.secure_url,
                created_at: f.created_at,
                format: f.format,
                size: f.bytes
            })),
            next_cursor: result.next_cursor
        });

    } catch (error) {
        console.error("Fetch Files Error:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- 6. SERVE FRONTEND ---
const distPath = path.join(__dirname, '../dist');
const isProduction = process.env.NODE_ENV === 'production';

// In production, the 'dist' folder is required. If it's missing, fail fast.
if (isProduction && !fs.existsSync(distPath)) {
    console.error('❌ FATAL: Frontend build directory "dist" not found.');
    console.error(`   - Path checked: ${distPath}`);
    console.error('   - This is a production environment (NODE_ENV=production).');
    console.error('   - Please ensure your frontend is built (e.g., "npm run build") and the output is in the "dist" folder before starting the server.');
    console.error('   - The build command should run as part of your deployment process.');
    process.exit(1); // Exit immediately, causing the deployment to fail.
}

if (fs.existsSync(distPath)) { // This will be true in production (due to the check above) or if built locally.
    console.log("✅ Serving frontend from:", distPath);
    app.use(express.static(distPath));
    // SPA Fallback: Serve index.html for any route that is NOT /api/ and NOT /uploads/
    app.get(/^(?!\/(api|uploads)\/).*$/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // This block now only runs in non-production environments where 'dist' is not found.
    console.warn('⚠️ Frontend build directory "dist" not found. Server running in API-only mode.');
    console.warn('   - This is expected during development if you are using a separate dev server (like Vite).');
    app.get('/', (req, res) => {
        res.send('Server is running in development (API-only mode). Access the frontend via its dev server (e.g., http://localhost:5173).');
    });
}


const startServer = () => {
    // Bắt đầu lắng nghe các yêu cầu HTTP ngay lập tức.
    // Điều này cho phép các health check của Render thành công ngay cả khi kết nối DB bị chậm.
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 SERVER PROCESS IS UP and listening on port ${PORT}`);
        console.log(`👉 Local: http://localhost:${PORT}`);

        // Bây giờ, kết nối với cơ sở dữ liệu trong nền.
        // Máy chủ đã chạy và có thể phục vụ các yêu cầu cơ bản.
        console.log("⏳ Initializing Data Connection in the background...");
        connectDB().catch(err => {
            console.error("Lỗi kết nối DB trong nền sau khi máy chủ khởi động:", err);
            // Tùy thuộc vào yêu cầu, bạn có thể muốn xử lý lỗi này
            // hoặc thậm chí tắt máy chủ nếu DB là tối quan trọng.
        });
    });

    server.on('error', (e) => {
        console.error("Lỗi Máy chủ:", e);
        // Ví dụ: nếu cổng đã được sử dụng.
        process.exit(1);
    });
};

startServer();

process.on('exit', (code) => console.log(`Process exiting with code: ${code}`));
process.on('SIGINT', () => { console.log('SIGINT received'); process.exit(); });
