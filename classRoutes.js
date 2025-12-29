import express from 'express';
import mongoose from 'mongoose';
import ClassModel from '../models/Class.js';
import Joi from 'joi';

const router = express.Router();

export default (localClasses, saveClassesToCloud) => {
    // GET All Classes
    router.get('/', async (req, res) => {
        if (mongoose.connection.readyState === 1) {
            const classes = await ClassModel.find().sort({ createdAt: -1 });
            return res.json(classes);
        }
        // Fallback
        res.json(localClasses);
    });

    // CREATE Class
    router.post('/', async (req, res) => {
        // 1. Định nghĩa schema validation
        const schema = Joi.object({
            id: Joi.string().alphanum().min(3).max(10).required().messages({
                'string.base': 'Mã lớp phải là một chuỗi ký tự',
                'string.alphanum': 'Mã lớp chỉ được chứa chữ và số',
                'string.min': 'Mã lớp phải có ít nhất 3 ký tự',
                'any.required': 'Mã lớp là bắt buộc'
            }),
            name: Joi.string().min(3).required().messages({
                'any.required': 'Tên lớp là bắt buộc'
            }),
            teacherName: Joi.string().allow('')
        });

        // 2. Kiểm tra dữ liệu đầu vào
        const { error, value } = schema.validate(req.body);
        if (error) {
            // Trả về lỗi validation chi tiết
            return res.status(400).json({ error: error.details[0].message });
        }

        const newClass = {
            ...value,
            teacherName: value.teacherName || 'Giáo viên',
            createdAt: new Date()
        };

        if (mongoose.connection.readyState === 1) {
            const existing = await ClassModel.findOne({ id: value.id });
            if (existing) {
                return res.status(400).json({ error: 'Mã lớp đã tồn tại' });
            }
            const created = await ClassModel.create(newClass);
            return res.json(created);
        }

        // Fallback
        if (localClasses.some(c => c.id === value.id)) {
            return res.status(400).json({ error: 'Mã lớp đã tồn tại' });
        }
        
        localClasses.unshift(newClass);
        saveClassesToCloud();
        res.json(newClass);
    });

    return router;
};