# COASTAL ECOFARM (bản mô phỏng)

## Chạy trên máy
1. Đặt `index.html`, `style.css`, `script.js` cùng một thư mục.
2. Nhấp đúp `index.html` để mở bằng trình duyệt (cần mạng để tải phông Montserrat; không có mạng vẫn chạy với phông dự phòng).

## Chỉnh dữ liệu
- Ngưỡng cảnh báo: đối tượng `TH` đầu `script.js` (giá trị DEMO, không phải giới hạn kỹ thuật đã xác minh).
- Số liệu ban đầu: hàm `initData()`. Lịch việc được tạo một lần và lưu trong localStorage; nút "Đặt lại dữ liệu" xóa và tạo lại.

## Xử lý sự cố
- Không thấy dữ liệu đổi: kiểm tra nút "Tạm dừng".
- Lịch cũ không đổi sau khi sửa code: bấm "Đặt lại dữ liệu".

## Triển khai miễn phí
Đẩy thư mục lên GitHub rồi bật GitHub Pages (Settings → Pages).

## Lưu ý
Dữ liệu hoàn toàn mô phỏng. Việc nuôi tôm hoặc đào kênh trong rừng phòng hộ cần kiểm tra phân loại rừng, quy hoạch, giấy phép và quy định hiện hành.
