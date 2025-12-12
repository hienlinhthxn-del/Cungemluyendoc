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
console.log("STARTING FULL SERVER (ES MODULE)...");
console.log("Node Version:", process.version);
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
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'reading-app-audio',
            resource_type: 'auto',
        },
    });
    upload = multer({ storage: storage });
    console.log("✅ Cloudinary Configured!");
} else {
    console.warn("⚠️ Cloudinary credentials missing. File uploads will fail.");
    // Fallback multer (memory storage) just to prevent crash
    upload = multer({ storage: multer.memoryStorage() });
}

// --- 3. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- 4. DATA MODELS (Quick inline schema) ---
const LessonAudioSchema = new mongoose.Schema({
    lessonId: String,
    text: String,
    audioUrl: String,
    createdAt: { type: Date, default: Date.now }
});
const LessonAudio = mongoose.model('LessonAudio', LessonAudioSchema);

// --- 5. API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
    });
});

// Upload Audio Route
app.post('/api/lessons/:lessonId/custom-audio', upload.single('audioFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }
        const { lessonId } = req.params;
        const { text } = req.body;
        const audioUrl = req.file.path; // Cloudinary URL

        // Save to DB
        if (mongoose.connection.readyState === 1) {
            await LessonAudio.findOneAndUpdate(
                { lessonId, text },
                { audioUrl },
                { upsert: true, new: true }
            );
        }

        res.json({ audioUrl, text });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: 'Upload failed' });
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
