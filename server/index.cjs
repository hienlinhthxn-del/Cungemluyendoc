
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// --- TEMPORARY DEBUG MODE ---
// require('dotenv').config(); // Already loaded at top
// ... keeping imports ...

// ... (existing code commented out for debugging) ...

// SIMPLIFIED STARTUP
const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
    res.send('<h1>Cùng Em Luyện Đọc - Server is Running!</h1><p>Database & Cloudinary are temporarily disabled for debugging.</p>');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DEBUG SERVER STARTED on port ${PORT}`);
});

