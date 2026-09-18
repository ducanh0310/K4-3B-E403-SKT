# Hướng dẫn sử dụng TA Course Assistant

Cập nhật: 18/09/2026

## 1. Truy cập nhanh

### Discord

Vào server Discord đã cài bot **TA Course Assistant**, sau đó gõ `/` để xem các lệnh:

- `/ask`: hỏi bot bằng RAG.
- `/knowledge add`: TA thêm nguồn đã xác minh.
- `/digest`: TA xem danh sách vấn đề cần xử lý.
- `/issue`: TA cập nhật hoặc gom issue.

### Dashboard read-only

- Dashboard live: mở URL được lưu trong `outputs/discord-ta-dashboard-access.txt` trên máy triển khai.
- Dataset demo: thêm `/demo` vào cuối URL dashboard.
- Username dashboard: `ta`.
- Password dashboard: xem trong file access phía trên; không gửi password qua Discord.

Quick Tunnel có thể đổi URL sau khi Cloudflare Tunnel restart. URL hiện tại luôn được lưu trên EC2 tại:

```text
/home/ubuntu/apps/discord-ta-bot/data/cloudflare-tunnel-url.txt
```

## 2. Hướng dẫn cho học viên

### Hỏi bot

Sử dụng:

```text
/ask question:<câu hỏi>
```

Ví dụ:

```text
/ask question:Lab 2 deadline và quy định nộp muộn như thế nào?
```

```text
/ask question:CVAT bị OPA policy bundle error thì sửa thế nào?
```

```text
/ask question:Làm sao sử dụng bot và khi nào bot chuyển câu hỏi cho TA?
```

Câu trả lời `/ask` là **ephemeral**, chỉ người gửi lệnh nhìn thấy.

### Hai loại kết quả

**Có đủ nguồn tin cậy:** bot trả lời và hiển thị mục **Nguồn**. Nguồn hợp lệ gồm thông báo chính thức hoặc câu trả lời TA đã giải quyết issue.

**Không đủ nguồn:** bot không đoán. Bot yêu cầu gửi câu hỏi vào kênh hỗ trợ và `@TA/MOD`. Nếu dataset cũ có vấn đề tương tự, bot hiển thị chúng dưới nhãn **dataset tham khảo — không phải nguồn chính thức**.

### Cách đặt câu hỏi tốt

- Nêu rõ tên bài, hệ thống hoặc lỗi: `Lab 2`, `CVAT`, `Docker`, `VLearn`.
- Dán thông báo lỗi chính xác nếu có.
- Cho biết đã thử gì: restart Docker, đăng nhập lại, đổi trình duyệt.
- Nếu có hai vấn đề khác nhau, nên hỏi thành hai lệnh `/ask` riêng.

## 3. Hướng dẫn cho TA/Mod

Các lệnh quản trị yêu cầu quyền Discord `Manage Messages` hoặc `Administrator`.

### Thêm nguồn RAG đã xác minh

```text
/knowledge add title:<tiêu đề> content:<nội dung> url:<link HTTPS>
```

Ví dụ:

```text
/knowledge add
title: Lab 2 deadline
content: Lab 2 phải nộp trên LMS trước 23:59 ngày 25/09/2026. Không nhận bài qua email.
url: https://example.com/lab-2-announcement
```

Quy tắc:

- Chỉ thêm nội dung TA/BTC đã xác minh.
- Không đưa thông tin cá nhân, token hoặc password vào knowledge.
- `url` là tùy chọn nhưng nếu nhập phải dùng HTTPS.
- Nếu chính sách thay đổi, thêm nguồn mới có nội dung và link mới nhất.

### Xem digest

```text
/digest
```

Digest ưu tiên:

- Issue `STUCK` quá 4 giờ.
- Issue có nhiều học viên khác nhau cùng hỏi.
- Issue thiếu nguồn chính thức.
- Issue đang `OPEN` hoặc `NEEDS_REVIEW`.

### Cập nhật issue

Đánh dấu đã xử lý:

```text
/issue resolve id:<issue-id>
```

Mở lại issue:

```text
/issue reopen id:<issue-id>
```

Gom hai issue trùng nhau:

```text
/issue merge source:<issue-id-cần-nhập> target:<issue-id-giữ-lại>
```

TA cũng có thể dùng nút `✓` trong digest để resolve nhanh issue.

### Tự động học từ câu trả lời TA

Khi TA trả lời trực tiếp vào message của học viên và hệ thống xác định câu trả lời đã giải quyết vấn đề:

1. Issue được chuyển sang `RESOLVED`.
2. Nội dung trả lời TA được lưu thành knowledge.
3. Các câu hỏi tương tự sau đó có thể được `/ask` trả lời kèm nguồn Discord.

## 4. Đọc dashboard

Dashboard hoàn toàn read-only, không sửa dữ liệu.

- `/`: dữ liệu Discord live.
- `/demo`: dataset K4 tham khảo.
- `Issue đang mở`: tổng issue chưa resolve.
- `Issue bị kẹt`: chưa giải quyết sau ngưỡng 4 giờ.
- `Câu hỏi đang theo dõi`: số atomic question thuộc các issue hiện tại.
- `Mở Discord`: đi tới message đại diện của issue.
- `Nguồn chính thức`: mở evidence đã được gắn với issue.

Các trạng thái:

- `OPEN`: chưa có hướng xử lý rõ ràng.
- `DISCUSSING`: đang được trao đổi.
- `RESOLVED`: đã giải quyết.
- `NEEDS_REVIEW`: bot chưa chắc việc gom nhóm, cần TA kiểm tra.
- `STUCK`: chưa giải quyết quá 4 giờ.

## 5. Dataset và RAG

Bot sử dụng hai tầng dữ liệu:

1. **Trusted knowledge:** thông báo official, `/knowledge add` và câu trả lời TA đã resolve. Dữ liệu này được phép dùng để trả lời.
2. **Reference dataset:** dữ liệu demo K4 gồm khoảng 1.089 message, 479 question và 215 issue. Dữ liệu này chỉ dùng để tìm chủ đề tương tự, không dùng làm bằng chứng kết luận.

RAG hiện dùng SQLite FTS để tìm kiếm nhanh. Chưa cần vector database ở quy mô hiện tại.

## 6. Retention 30 ngày

`CONTEXT_RETENTION_DAYS=30` áp dụng cho cả live DB và demo/reference DB.

Bot tự prune:

- Khi service khởi động.
- Một lần khi bước sang ngày mới.

Dữ liệu quá 30 ngày bị xóa khỏi context hoạt động:

- Raw messages.
- Atomic questions.
- Issues và liên kết nguồn.
- Câu trả lời TA đã index.
- LLM cache.

Dataset ngày 12–14/09/2026 vẫn còn hiệu lực tại ngày 18/09/2026 vì chưa quá 30 ngày.

## 7. Workflow khuyến nghị

### Học viên

```text
Hỏi bằng /ask
→ Có nguồn: nhận câu trả lời và citation
→ Thiếu nguồn: đăng câu hỏi vào kênh hỗ trợ và tag TA/MOD
```

### TA cuối ngày

```text
/digest
→ Xử lý STUCK và chủ đề nóng
→ Bấm link mở đúng message Discord
→ Trả lời trực tiếp học viên
→ Resolve hoặc merge issue
→ Thêm chính sách mới bằng /knowledge add
```

## 8. Xử lý lỗi thường gặp

### Không thấy slash command

- Gõ lại `/` và tìm `ask`, `digest`, `issue`, `knowledge`.
- Kiểm tra bot còn online trong server.
- Kiểm tra bot có quyền `Use Application Commands`.

### `/knowledge`, `/digest` hoặc `/issue` báo không có quyền

Tài khoản cần `Manage Messages` hoặc `Administrator` trong đúng server đã cấu hình.

### Bot luôn chuyển sang TA

Knowledge chưa có nguồn phù hợp. TA cần thêm nguồn bằng `/knowledge add` hoặc trả lời và resolve một issue tương tự.

### Dashboard yêu cầu đăng nhập lại

Đây là Basic Auth bình thường. Lấy username/password từ file access trên máy local.

### Dashboard URL không truy cập được

Quick Tunnel có thể đã đổi URL sau restart. Kiểm tra file access local hoặc file `cloudflare-tunnel-url.txt` trên EC2.

### Bot trả về lỗi xử lý

Kiểm tra service:

```bash
sudo systemctl status discord-ta-bot.service
journalctl -u discord-ta-bot.service -n 100 --no-pager
```
