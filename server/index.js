import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Setup paths for ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SIMPLIFIED SERVER FOR DEBUGGING ---
console.log("-----------------------------------------");
console.log("STARTING SERVER (ES MODULE)...");
console.log("Node Version:", process.version);
console.log("Current Directory:", process.cwd());
console.log("-----------------------------------------");

const app = express();
const PORT = process.env.PORT || 10000; // Render usually gives 10000

// Basic Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Cùng Em Luyện Đọc</h1>
            <h2 style="color: green;">Server is Running Successfully!</h2>
            <p>Node Version: ${process.version}</p>
            <p>Database: Temporarily Disabled for Debugging</p>
        </div>
    `);
});

// Serve frontend if it exists
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
   // Serve frontend if it exists
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    console.log("Serving frontend from:", distPath);
    app.use(express.static(distPath));
    
    app.get('(.*)', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
} else {
    console.log("Frontend not found");
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
