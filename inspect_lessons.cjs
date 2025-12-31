
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

const LessonSchema = new mongoose.Schema({
    id: String,
    week: Number,
    title: String,
    grade: Number
}, { strict: false });

const Lesson = mongoose.model('Lesson', LessonSchema);

async function inspect() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");

        const count = await Lesson.countDocuments();
        console.log(`Total lessons in DB: ${count}`);

        const allLessons = await Lesson.find({}, { title: 1, week: 1, grade: 1, id: 1 }).sort({ week: 1 });
        console.log("Lessons List:");
        allLessons.forEach(l => {
            console.log(`- ID: ${l.id}, Week: ${l.week}, Title: ${l.title}${l.grade ? ', Grade: ' + l.grade : ''}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

inspect();
