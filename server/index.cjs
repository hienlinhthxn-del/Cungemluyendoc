
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- MONGODB SETUP ---
const MONGO_URI = process.env.MONGODB_URI;
let isMongoConnected = false;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log("✅ Đã kết nối MongoDB thành công!");
            isMongoConnected = true;
        })
        .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));
} else {
    console.log("⚠️ Không tìm thấy MONGODB_URI trong .env");
}

// Define Schema for storing audio mapping
// Structure: One document per audio file mapping
const AudioMappingSchema = new mongoose.Schema({
    lessonId: { type: String, required: true }, // e.g., "lesson-1"
    text: { type: String, required: true },     // e.g., "Hello world"
    url: { type: String, required: true }       // e.g., "https://res.cloudinary..."
});

// Create compound index to ensure unique text per lesson
AudioMappingSchema.index({ lessonId: 1, text: 1 }, { unique: true });

const AudioMapping = mongoose.model('AudioMapping', AudioMappingSchema);


// --- STATIC FOLDERS ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
app.use('/uploads', express.static(UPLOADS_DIR));


// --- CLOUDINARY SETUP ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// Storage configuration
let storage;
if (useCloudinary) {
    console.log('Using Cloudinary Storage');
    storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: 'cung-em-luyen-doc/uploads',
            resource_type: 'auto',
        },
    });
} else {
    console.log('Using Local Disk Storage');
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, UPLOADS_DIR);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, Date.now() + ext);
        }
    });
}

const upload = multer({ storage: storage });


// --- API ROUTES ---

// API: Get custom audio mapping for a lesson
app.get('/api/lessons/:id/custom-audio', async (req, res) => {
    const { id } = req.params;

    if (isMongoConnected) {
        try {
            // Fetch all mappings for this lesson
            const results = await AudioMapping.find({ lessonId: id });

            // Convert array to object: { "text": "url" } for frontend
            const map = {};
            results.forEach(item => {
                map[item.text] = item.url;
            });

            return res.json(map);
        } catch (error) {
            console.error("Error fetching from Mongo:", error);
            // Fallback to empty if error
            return res.json({});
        }
    } else {
        // Fallback to local JSON if Mongo not connected (Legacy support)
        const DB_FILE = path.join(__dirname, 'audio-map.json');
        if (fs.existsSync(DB_FILE)) {
            const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            return res.json(db[id] || {});
        }
        return res.json({});
    }
});

// API: Upload custom audio for a specific text in a lesson
app.post('/api/lessons/:id/custom-audio', upload.single('audioFile'), async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const file = req.file;

    if (!file || !text) {
        return res.status(400).json({ error: 'Missing file or text' });
    }

    // Determine URL
    let audioUrl;
    if (file.path && file.path.startsWith('http')) {
        audioUrl = file.path;
    } else {
        audioUrl = `/uploads/${file.filename}`;
    }

    if (isMongoConnected) {
        try {
            // Update or Insert into MongoDB
            await AudioMapping.findOneAndUpdate(
                { lessonId: id, text: text },
                { url: audioUrl },
                { upsert: true, new: true }
            );
            return res.json({ success: true, audioUrl });
        } catch (error) {
            console.error("Error saving to Mongo:", error);
            return res.status(500).json({ error: 'Database error' });
        }
    } else {
        // Legacy JSON file fallback
        const DB_FILE = path.join(__dirname, 'audio-map.json');
        let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};

        if (!db[id]) db[id] = {};
        db[id][text] = audioUrl;

        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        return res.json({ success: true, audioUrl });
    }
});

// Serve static frontend files
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
