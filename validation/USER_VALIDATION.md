# Nhật Ký Cho Người Ngoài Dùng Thử (Validation Log)
**Dự án:** TA Course Assistant (Discord Bot)  
**Nhóm:** SKT · **Zone:** 3  
**Thời gian thực hiện:** 18/9/2026  

---

## 👥 Danh sách người tham gia dùng thử (5 người ngoài nhóm)

| STT | Họ và Tên | Mã Học Viên | Vai trò / Tư cách | Phân loại |
|---|---|---|---|---|
| 1 | **Vũ Đình Thư** | 2A202602652 | Học viên K4 (Zone 3) | **Willing User 1** (khai từ CP1) |
| 2 | **Ngô Thế Khanh** | 2A202602503 | Học viên K4 (Zone 3) | **Willing User 2** (khai từ CP1) |
| 3 | **Lại Bá Quân** | 2A202602495 | Học viên K4 | Học viên |
| 4 | **Đồng Mạnh Hùng** | 2A202602412 | Học viên K4 | Học viên |
| 5 | **Phùng Thành An** | 2A202603006 | Học viên K4 | Học viên |

---

## 📋 Bảng nhật ký dùng thử & phản hồi thực tế

| Người thử | Nhiệm vụ (Task) được giao | Kẹt / Vướng ở đâu | Quote nguyên văn (kể cả lỗi chính tả) | Quyết định điều chỉnh |
|---|---|---|---|---|
| **Phùng Thành An** | Dùng lệnh `/ask` hỏi về quy trình đăng ký làm lại thẻ học viên bị mất. | Nhận được câu trả lời hướng dẫn lên phòng đào tạo nhưng link nguồn dài khó click trên điện thoại. | `"Ơ bot trả lời đúng là lên phòng đào tạo làm lại thẻ nhưng không đưa link form đăng ký online trực tiếp luôn à b, với link nguồn dài bấm trên điện thoại hơi khó"` | **SỬA:** Rút ngắn tiêu đề link trích dẫn nguồn RAG dưới 40 ký tự và ưu tiên chèn trực tiếp `sourceUrl` clickable. |
| **Đồng Mạnh Hùng** | Đặt câu hỏi thắc mắc về cách xin duyệt điểm cộng VLearn sau khi đã đóng ca. | Bot phản hồi không đủ nguồn chính thức (`needs_ta`), phần danh sách chủ đề tham khảo bên dưới hiển thị bị sát dòng nhau. | `"con bot báo chưa có nguồn chính thức xong hiện mấy cái chủ đề tham khảo ở dưới nhìn hơi dính vào nhau khó nhìn vãi"` | **SỬA:** Định dạng lại khoảng cách dòng Markdown (`\n\n`) và thêm separator giữa các chủ đề tham khảo tương tự. |
| **Vũ Đình Thư** | Đóng vai TA gõ `/digest` xem danh sách Issue và bấm nút `✓ #1` để giải quyết. | Bấm nút `✓ #1` xong bot xử lý ngầm, giao diện Discord không phản hồi ngay làm tưởng bị đơ. | `"Bấm nút resolve xong nó im ru không biết là đã xoá khỏi danh sách chưa luôn nè, phải gõ lại digest mới thấy"` | **SỬA:** Thêm phản hồi tức thì Ephemeral Message (`"✅ Đã giải quyết Issue..."`) và tự động update bảng Digest ngay khi bấm nút. |
| **Ngô Thế Khanh** | Hỏi bot qua `/ask` về quy trình làm mentor duty phải thực hiện như thế nào. | Bot trả lời chưa tìm thấy nguồn chính thức (`needs_ta`), câu nhắc chuyển hướng TA chưa nêu rõ tên kênh hỗ trợ cụ thể. | `"Bot bảo tìm chưa thấy nguồn quy định mentor duty xong kêu sang kênh hỗ trợ mà ko nói rõ kênh nào trong đống channel bên trái"` | **SỬA:** Cập nhật câu phản hồi fallback `needs_ta` chỉ định rõ tên kênh hỗ trợ: `kênh #hỏi-đáp` và tag `@TA/MOD`. |
| **Lại Bá Quân** | Đóng vai TA dùng lệnh `/issue merge` để gộp 2 câu hỏi trùng nhau về thẻ học viên. | Phải copy chuỗi ID dài (`issue-student-card-a1b2`) để điền tham số lệnh gộp. | `"Copy cái ID issue dài vãi, sao ko cho bấm nút chọn luôn trong digest cho tiện"` | **GIỮ NGUYÊN & ĐỂ DÀNH:** Giữ nguyên cấu trúc Slash Command do giới hạn 5 nút/row của Discord API; ghi nhận cải tiến Auto-complete ID sau demo. |

---

## 🎯 4 Dòng tổng kết sau Validation (Bắt buộc theo Khối R6)

1. **Chủ đề lặp lại nhiều nhất:** Học viên lúng túng khi thao tác link nguồn RAG trên giao diện Discord Mobile và TA cảm thấy thiếu phản hồi tức thì khi bấm nút `✓ Resolve` trên danh sách Digest.
2. **Sẽ sửa gì trước demo:** 
   - Thêm phản hồi tức thì Ephemeral Response khi TA bấm nút `✓ Resolve` trong `/digest`.
   - Định dạng lại khoảng cách xuống dòng và tiêu đề hiển thị cho phần *Untrusted Reference Context* trong `/ask`.
   - Cụ thể hóa tên kênh hỗ trợ `#hỏi-đáp` trong thông báo chuyển hướng TA.
3. **Giữ nguyên gì và vì sao:** Giữ nguyên cơ chế **RAG Gác cổng (Confidence ≥ 0.8)** và **chế độ chuyển hướng `needs_ta`** thay vì tự động bịa câu trả lời, nhằm đảm bảo đúng cam kết 0% hallucination đối với dữ liệu đào tạo.
4. **Gì để dành sau:** Phát triển tính năng gợi ý danh sách tự động (Auto-complete) cho tham số Issue ID trong lệnh `/issue merge` và tích hợp Discord Dropdown Select Menu cho danh sách Digest dài.
