import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, username, ... }
        next();
    } catch (err) {
        console.error("Auth Token Error:", err.message);
        res.status(401).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
    }
};

export default authMiddleware;
