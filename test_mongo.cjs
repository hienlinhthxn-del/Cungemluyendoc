
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
console.log("--- BẮT ĐẦU KIỂM TRA KẾT NỐI MONGODB ---");
console.log("URI đang dùng (đã ẩn mật khẩu):", uri.replace(/:([^:@]+)@/, ':****@'));

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
        console.log("✅ KẾT NỐI THÀNH CÔNG! (Mật khẩu và Cấu hình mạng đều đúng)");
        process.exit(0);
    })
    .catch(err => {
        console.log("❌ KẾT NỐI THẤT BẠI.");
        console.log("Tên lỗi:", err.name);
        console.log("Mã lỗi:", err.codeName || err.code);
        console.log("Chi tiết:", err.message);

        if (err.message.includes('bad auth')) {
            console.log("=> GỢI Ý: Sai Tên đăng nhập hoặc Mật khẩu.");
        } else if (err.message.includes('querySrv')) {
            console.log("=> GỢI Ý: Lỗi phân giải tên miền (DNS). Có thể do mạng chặn DNS SRV.");
        } else if (err.message.includes('ETIMEOUT')) {
            console.log("=> GỢI Ý: Không kết nối được tới máy chủ. Có thể chưa Add IP '0.0.0.0/0' trong Network Access.");
        }
        process.exit(1);
    });
