import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
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

// --- 1. DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.warn("⚠️ MONGODB_URI is missing. Database features will be disabled.");
            return;
        }
        await mongoose.connect(uri);
        console.log("✅ MongoDB Connected Successfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
};
connectDB();

// --- 2. CLOUDINARY CONFIG ---
// Only config if credentials exist
let upload = null;
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
        api_key: process.env.CLOUDINARY_API_KEY.trim(),
        api_secret: process.env.CLOUDINARY_API_SECRET.trim()
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

// --- 5. API ROUTES ---

// UPLOAD STUDENT AUDIO
app.post('/api/upload-student-audio', uploadMiddleware, (req, res) => {
    if (req.file) {
        let fileUrl = req.file.path;

        // If we are using local disk storage, req.file.path is a system path.
        // We need to convert it to a URL accessible by the frontend.
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            // Assuming the file is in 'uploads/' and we are serving it via /uploads
            // We construct a relative URL (or absolute if needed)
            const filename = req.file.filename;
            // Use relative path so it works with proxy/tunnel if needed, 
            // but absolute URL is safer for some clients. Let's use relative for now.
            fileUrl = `/uploads/${filename}`;
        }

        res.json({ url: fileUrl });
    } else {
        res.status(400).json({ error: 'No audio file uploaded' });
    }
});

// GET All Students
app.get('/api/students', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            // Fallback if DB not connected
            return res.json([]);
        }
        const students = await Student.find().sort({ lastPractice: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE / SYNC Student
app.post('/api/students', async (req, res) => {
    try {
        const { id, name, completedLessons, averageScore, readingSpeed, history, badges } = req.body;

        // Prepare update data. undefined fields won't overwrite existing unless specified.
        const updateData = { name };
        if (completedLessons !== undefined) updateData.completedLessons = completedLessons;
        if (averageScore !== undefined) updateData.averageScore = averageScore;
        if (readingSpeed !== undefined) updateData.readingSpeed = readingSpeed;
        if (history !== undefined) updateData.history = history;
        if (badges !== undefined) updateData.badges = badges;

        const student = await Student.findOneAndUpdate(
            { id: id },
            {
                $set: updateData,
                $setOnInsert: { lastPractice: new Date() }
            },
            { new: true, upsert: true }
        );
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE Progress (After Lesson)
app.post('/api/students/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const { score, speed, week, lessonTitle, audioUrl } = req.body;

        const student = await Student.findOne({ id });
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Update History for this week
        const historyIndex = student.history.findIndex(h => h.week === week);
        if (historyIndex >= 0) {
            // Update existing week record (keep highest score?)
            // For now, overwrite with latest attempt
            student.history[historyIndex].score = score;
            student.history[historyIndex].speed = speed;
            if (audioUrl) student.history[historyIndex].audioUrl = audioUrl; // Save URL
        } else {
            student.history.push({ week, score, speed, audioUrl });
        }

        // Recalc Stats
        const totalScore = student.history.reduce((acc, h) => acc + h.score, 0);
        student.averageScore = Math.round(totalScore / student.history.length);
        student.completedLessons += 1; // Increment count
        student.readingSpeed = speed; // Current speed
        student.lastPractice = new Date();

        await student.save();
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

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
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
        const audioUrl = req.file.path; // Cloudinary URL

        console.log("✅ Cloudinary URL generated:", audioUrl);

        // Save to DB
        if (mongoose.connection.readyState === 1) {
            await LessonAudio.findOneAndUpdate(
                { lessonId, text },
                { audioUrl },
                { upsert: true, new: true }
            );
            console.log("✅ Saved to MongoDB");
        } else {
            console.warn("⚠️ MongoDB not connected, skipping DB save");
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
        if (mongoose.connection.readyState !== 1) {
            return res.json({}); // Return empty if no DB
        }
        const audios = await LessonAudio.find({ lessonId });
        // Convert to map: { "text": "url" }
        const audioMap = audios.reduce((acc, curr) => {
            acc[curr.text || ""] = curr.audioUrl;
            return acc;
        }, {});
        res.json(audioMap);
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FULL SERVER running on port ${PORT}`);
});
