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
import 'express-async-errors'; // Quan trọng: Phải import trước các route của bạn

// Import modular routes
import studentRoutes from './studentRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import classRoutes from './classRoutes.js';

// --- GLOBAL ERROR HANDLERS ---
// These should be at the top to catch errors early.
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1); // Mandatory exit
});

// Import Models
import Student from '../Student.js';
import Lesson from './Lesson.js';
import ClassModel from './Class.js';

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
const PORT = process.env.PORT || 10001;

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
        // Only sync if Cloudinary is configured
        if (!process.env.CLOUDINARY_CLOUD_NAME) return;

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
                await loadClassesFromCloud();
            }
        }
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
};

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
            public_id: (req, file) => {
                // Use original filename (without extension) to make it recoverable
                // Cloudinary will add suffix if not unique, but base name is preserved
                return file.originalname.split('.')[0];
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

// --- 4. DATA MODELS (Quick inline schema) ---
const LessonAudioSchema = new mongoose.Schema({
    lessonId: String,
    text: String,
    audioUrl: String,
    createdAt: { type: Date, default: Date.now }
});
const LessonAudio = mongoose.model('LessonAudio', LessonAudioSchema);

// In-Memory Classes (Synced to Cloudinary/File)
let localClasses = [
    { id: '1A3', name: 'Lớp 1A3', teacherName: 'Cô giáo', createdAt: new Date() }
];

const CLOUD_CLASSES_DB_PUBLIC_ID = 'reading_app_classes_backup.json';

// Helper: Save Classes to Cloudinary (Debounced)
let saveClassesTimeout = null;
const saveClassesToCloud = () => {
    if (saveClassesTimeout) clearTimeout(saveClassesTimeout);
    saveClassesTimeout = setTimeout(async () => {
        // Only sync if Cloudinary is configured
        if (!process.env.CLOUDINARY_CLOUD_NAME) return;

        try {
            console.log("☁️ Syncing Classes to Cloudinary...");
            const jsonString = JSON.stringify(localClasses, null, 2);
            const tempPath = path.join(__dirname, 'temp_classes.json');
            fs.writeFileSync(tempPath, jsonString);

            await cloudinary.uploader.upload(tempPath, {
                resource_type: 'raw',
                public_id: CLOUD_CLASSES_DB_PUBLIC_ID,
                overwrite: true,
                invalidate: true
            });
            console.log("✅ Classes Synced to Cloudinary!");
            fs.unlinkSync(tempPath);
        } catch (e) {
            console.error("❌ Failed to sync Classes to Cloud:", e.message);
        }
    }, 5000); // Debounce 5s
};

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
app.use('/api/students', studentRoutes(localStudents, saveDBToCloud));

app.use('/api/lessons', lessonRoutes);

app.use('/api/classes', classRoutes(localClasses, saveClassesToCloud));

// Route để học sinh nộp bài
app.post('/api/submissions', uploadMiddleware, async (req, res) => {
    const { studentId, week, part } = req.body;
    const audioFile = req.file;

    if (!studentId || !week || !part || !audioFile) {
        return res.status(400).json({ error: 'Missing required submission data.' });
    }

    let audioUrl = audioFile.path; // Default for local storage
    if (audioFile.secure_url) { // Cloudinary gives secure_url
        audioUrl = audioFile.secure_url.startsWith('http:')
            ? audioFile.secure_url.replace('http:', 'https:')
            : audioFile.secure_url;
    }

    const useMongo = mongoose.connection.readyState === 1;
    const audioUrlKey = `${part}AudioUrl`;

    try {
        if (useMongo) {
            const student = await Student.findOne({ id: studentId });
            if (!student) return res.status(404).json({ error: 'Student not found' });

            let historyRecord = student.history.find(h => h.week === Number(week));
            if (historyRecord) {
                historyRecord[audioUrlKey] = audioUrl;
            } else {
                student.history.push({ week: Number(week), score: 0, speed: 0, [audioUrlKey]: audioUrl });
            }
            await student.save();
        } else {
            const studentIndex = localStudents.findIndex(s => s.id === studentId);
            if (studentIndex === -1) return res.status(404).json({ error: 'Student not found' });

            const student = localStudents[studentIndex];
            let historyRecord = student.history.find(h => h.week === Number(week));
            if (historyRecord) {
                historyRecord[audioUrlKey] = audioUrl;
            } else {
                student.history.push({ week: Number(week), score: 0, speed: 0, [audioUrlKey]: audioUrl });
            }
            saveDBToCloud();
        }
        res.status(201).json({ success: true, audioUrl });
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
if (fs.existsSync(distPath)) {
    console.log("Serving frontend from:", distPath);
    app.use(express.static(distPath));
    // SPA Fallback
    app.get(/.*/, (req, res, next) => {
        // Nếu yêu cầu bắt đầu bằng /api/, hãy để nó đi qua.
        // Nếu không có route API nào khớp, Express sẽ tự động trả về lỗi 404.
        if (req.path.startsWith('/api/')) {
            return next();
        }
        // Đối với tất cả các yêu cầu GET khác, trả về file index.html chính.
        // Điều này cho phép React Router ở phía giao diện xử lý URL.
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Default Home for API-only mode
    app.get('/', (req, res) => {
        res.send('Server is running (API mode). Frontend not found.');
    });
}


// WRAP STARTUP IN ASYNC TO WAIT FOR DB/DATA LOAD
const startServer = async () => {
    try {
        console.log("⏳ Initializing Data Connection...");
        await connectDB();

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 FULL SERVER running on port ${PORT}`);
            console.log(`👉 Local: http://localhost:${PORT}`);
        });
        
        server.on('error', (e) => {
            console.error("Server Error:", e);
        });
    } catch (err) {
        console.error("Start Server Error:", err);
    }
};

startServer().catch(err => console.error("Unhandled Startup Error:", err));

process.on('exit', (code) => console.log(`Process exiting with code: ${code}`));
process.on('SIGINT', () => { console.log('SIGINT received'); process.exit(); });
