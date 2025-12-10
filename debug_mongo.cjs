
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
console.log("--- DEBUG KẾT NỐI MONGODB ---");
// Mask password for display but show structure
const maskedUri = uri ? uri.replace(/:([^:@]+)@/, ':****@') : "UNDEFINED";
console.log("URI (Đã che mật khẩu):", maskedUri);

if (!uri) {
    console.log("❌ LỖI: Không tìm thấy MONGODB_URI trong .env");
    process.exit(1);
}

if (uri.includes('<') || uri.includes('>')) {
    console.log("❌ LỖI CÚ PHÁP: URI vẫn chứa dấu giữ chỗ '<' hoặc '>'");
    console.log("   Bạn cần xóa cả dấu < và > đi.");
    console.log("   Ví dụ sai: ...: <matkhau> @...");
    console.log("   Ví dụ đúng: ...: matkhau @...");
    process.exit(1);
}

console.log("Đang thử kết nối... (Chờ 5s)");

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log("✅ KẾT NỐI THÀNH CÔNG RỰC RỠ!");
        process.exit(0);
    })
    .catch(err => {
        console.log("❌ KẾT NỐI THẤT BẠI.");
        console.log("Code:", err.codeName || err.code);
        console.log("Message:", err.message);
        process.exit(1);
    });
