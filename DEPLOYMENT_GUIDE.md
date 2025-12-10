# Hướng dẫn đưa ứng dụng lên Internet và Lưu trữ Dữ liệu Lâu dài

Để đảm bảo ứng dụng chạy ổn định và **không bị mất file ghi âm** khi server khởi động lại, bạn cần sử dụng dịch vụ lưu trữ đám mây Cloudinary (Miễn phí).

## Bước 1: Tạo tài khoản Cloudinary (Để lưu file)
1. Truy cập [Cloudinary.com](https://cloudinary.com/) và đăng ký tài khoản miễn phí.
2. Tại trang **Dashboard**, bạn sẽ thấy thông tin "Product Environment Credentials" bao gồm:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
   *(Lưu lại 3 thông tin này)*

## Bước 2: Tạo dịch vụ trên Render
1. Truy cập [Render.com](https://render.com) và chọn **"New +"** -> **"Web Service"**.
2. Chọn repository chứa mã nguồn của bạn.
3. Điền các thông tin:
   - **Name**: Tên ứng dụng (ví dụ: `cung-em-luyen-doc`).
   - **Region**: Singapore.
   - **Runtime**: **Node**.
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free.

## Bước 3: Cấu hình Biến Môi Trường (Environment Variables) - QUAN TRỌNG
Để kích hoạt tính năng lưu file lâu dài, bạn cần thêm các biến môi trường trên Render.
1. Tại trang quản lý dịch vụ trên Render, chọn tab **"Environment"**.
2. Nhấn **"Add Environment Variable"** và thêm lần lượt 3 biến sau (lấy từ bước 1):

   | Key | Value (Ví dụ) |
   | --- | --- |
   | `CLOUDINARY_CLOUD_NAME` | `tên_cloud_của_bạn` |
   | `CLOUDINARY_API_KEY` | `1234567890` |
   | `CLOUDINARY_API_SECRET` | `abc-xyz-bit-mat` |

3. Nhấn **"Save Changes"**. Server sẽ tự động khởi động lại.

---

### Lưu ý về Cơ sở dữ liệu (Database)
Hiện tại ứng dụng sử dụng file `audio-map.json` để nhớ "bài học nào dùng file âm thanh nào". File này vẫn nằm trên server.
- Nếu bạn sử dụng Cloudinary như hướng dẫn trên: Các **file âm thanh** (mp3/wav) sẽ **được lưu vĩnh viễn** trên Cloudinary.
- Tuy nhiên: Nếu server Render khởi động lại, file `audio-map.json` có thể bị reset về trạng thái ban đầu. Điều này có nghĩa là ứng dụng có thể "quên" mất liên kết đến file âm thanh dù file đó vẫn còn trên Cloudinary.
- **Giải pháp tạm thời**: Với nhu cầu học tập cá nhân/nhóm nhỏ, bạn có thể chấp nhận việc phải thiết lập lại các bài học tùy chỉnh nếu server bị reset (server Render gói Free sẽ reset nếu không có ai truy cập trong thời gian dài).
