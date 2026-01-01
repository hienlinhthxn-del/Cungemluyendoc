import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    // Evaluation inside middleware ensures process.env is ready
    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        console.warn(`[AUTH] Missing Token for ${req.method} ${req.originalUrl}`);
        return res.status(401).json({ error: 'Không có quyền truy cập. Vui lòng đăng nhập.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error(`[AUTH] Token Invalid for ${req.method} ${req.originalUrl}:`, error.message);
        return res.status(401).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
    }
};

export default authMiddleware;
