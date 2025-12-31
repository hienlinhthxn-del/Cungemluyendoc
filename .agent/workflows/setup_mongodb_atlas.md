---
description: How to set up MongoDB Atlas and connect it to the application
---

# Hướng dẫn Cấu hình MongoDB Atlas (Dữ liệu Đám mây)

Để ứng dụng có thể lưu trữ dữ liệu vĩnh viễn trên Cloud (không bị mất khi cài lại máy hoặc chạy trên Render), bạn cần tạo một cơ sở dữ liệu MongoDB Atlas miễn phí.

## Bước 1: Đăng ký và Tạo Database
1. Truy cập [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) và đăng ký tài khoản (có thể dùng Google).
2. Chọn gói **M0 Sandbox (Free Forever)**.
3. Chọn khu vực (Region) gần Việt Nam nhất (thường là **Singapore**).
4. Nhấn **Create Deployment**.

## Bước 2: Tạo User Kết nối
1. Trong phần **Security** (menu bên trái), chọn **Database Access**.
2. Nhấn **+ Add New Database User**.
3. Điền **Username** (ví dụ: `admin`) và **Password** (hãy chọn password mạnh và LƯU LẠI).
4. Ở phần "Built-in Role", chọn **Atlas Admin** hoặc **Read and write to any database**.
5. Nhấn **Add User**.

## Bước 3: Cấu hình IP (Cho phép truy cập)
1. Chọn **Network Access** (menu bên trái).
2. Nhấn **+ Add IP Address**.
3. Chọn **Allow Access from Anywhere** (0.0.0.0/0). *Lưu ý: Cách này tiện lợi cho demo/dev. Khi chạy production thực tế có thể giới hạn IP sau.*
4. Nhấn **Confirm**.

## Bước 4: Lấy Connection String (URI)
1. Chọn **Database** (menu bên trái).
2. Nhấn nút **Connect** ở Cluster vừa tạo.
3. Chọn **Drivers**.
4. Bạn sẽ thấy một chuỗi giống như:
   `mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Copy chuỗi này.

## Bước 5: Cấu hình vào Ứng dụng
1. Mở file `.env` trong thư mục dự án của bạn (nếu chưa có, hãy tạo file `.env` ngang hàng với `package.json`).
2. Thêm dòng sau (thay `<password>` bằng mật khẩu bạn tạo ở Bước 2):
   ```
   MONGODB_URI=mongodb+srv://admin:matkhaucua@cluster0.xxxxx.mongodb.net/reading_app_db?retryWrites=true&w=majority
   ```
   *(Lưu ý: Thay `reading_app_db` là tên database bạn muốn đặt)*.

3. Khởi động lại Server. Nhìn Terminal, nếu thấy dòng `✅ Mongoose đã kết nối thành công...` là thành công!
