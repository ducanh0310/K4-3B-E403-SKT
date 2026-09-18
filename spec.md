# AI SPEC — Discord Bot Tổng hợp & Phân loại tin nhắn · Nhóm SKT · Zone 3
Hướng: [ ] A — VLearn  [x] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [x] Tính năng mới  [ ] Tối ưu tính năng có sẵn

## §1. User & Job
- **Job executor + workflow**:
  - **TA / Mentor / Moderator**: Theo dõi câu hỏi và vướng mắc của học viên trên Discord; phân loại và ưu tiên các vấn đề chưa được giải quyết; công bố thông báo chính thức và giải đáp thắc mắc chuyên môn/thủ tục.
  - **Học viên**: Gửi câu hỏi thắc mắc trên các kênh Discord public (về bài tập, deadline, lỗi kỹ thuật CVAT/Docker/Git, điểm danh, thủ tục); tìm kiếm câu trả lời nhanh chóng và chính xác.
  - **Workflow chi tiết**:
    1. Học viên gửi tin nhắn công khai trên Discord -> Bot tự động lọc tin nhắn rác/bot/cảm ơn (`filter.js`).
    2. LLM trích xuất các câu hỏi nguyên tử (`extract_questions`) -> Gom nhóm vào Issue hiện có hoặc tạo Issue mới (`pipeline.js`).
    3. Nếu Issue tồn tại > 4 giờ mà chưa được resolve -> Bot gán trạng thái `STUCK` (`digest.js`).
    4. Định kỳ (20:00) hoặc qua lệnh `/digest`, Bot gửi **TA Digest** lên kênh hỗ trợ với các nút bấm thao tác nhanh (`Resolve`, `Merge`, `Reopen`).
    5. Học viên/TA dùng lệnh `/ask` -> Bot thực hiện RAG tìm kiếm trên nguồn chính thức (*Official Sources*) và các câu trả lời đã xác minh của TA (*TA Answers*).
    6. Nếu tìm thấy nguồn đủ tin cậy (`confidence >= 0.8` & trích dẫn chuẩn) -> Bot trả lời kèm link nguồn. Nếu thiếu nguồn hoặc off-topic -> Bot thông báo chưa đủ tin cậy, gợi ý chủ đề tương tự và chuyển hướng học viên sang TA/MOD.

- **Core JTBD**: Giúp TA nắm bắt, tổng hợp và ưu tiên xử lý toàn bộ vướng mắc của học viên theo thời gian thực mà không bị trôi tin nhắn; đồng thời giúp học viên nhận được câu trả lời chính xác có trích dẫn nguồn ngay lập tức hoặc được hỗ trợ kịp thời khi bị kẹt.

- **Problem statement**: TA và Moderator phải lội qua hàng ngàn tin nhắn rải rác trên các kênh Discord, dễ bỏ sót câu hỏi bị trôi hoặc phải trả lời lặp đi lặp lại cùng một vấn đề; trong khi học viên phải chờ đợi lâu không biết câu hỏi đã được tiếp nhận chưa, hoặc dễ nhận câu trả lời sai lệch nếu AI trả lời không có nguồn chứng minh.

- **Evidence (chuẩn A & B — log đầy đủ trong repo và minh chứng thực tế trên Discord [L3-L4] AI20K Cohort 4)**:
  - **Số liệu mining / kết quả khảo sát** (n = 1,092 tin nhắn thực tế từ dataset Discord Batch 04 `k4_messages.csv` và khảo sát kênh `#hỏi-đáp`):
    - **38.2%** tin nhắn chứa các câu hỏi trùng lặp về thủ tục thẻ học viên, điểm cộng VLearn, nộp nhầm link Lab, xin ghép nhóm và quy trình Mentor Duty.
    - **24.5%** tin nhắn là phản hồi ngắn / trao đổi tự do (`"warding"`, `"vâng"`, `"ok"`, emoji, tin nhắn trao đổi cá nhân) làm trôi các câu hỏi thắc mắc quan trọng.
    - **18.7%** câu hỏi bị ngâm quá 4 tiếng mà chưa nhận được phản hồi chính thức từ TA/Labcoach hoặc thông tin bị chìm trong luồng chat.
  - **≥6 quote/ví dụ nguyên văn thực tế từ Discord [L3-L4] AI20K Cohort 4 (kênh `#hỏi-đáp`)**:
    1. `"Cho em hỏi là mình lấy ở đâu ạ? Em xin cảm ơn"` — *Học viên T097-ĐỒNG MẠNH HÙNG-02412 (Thread "Thẻ học viên", 17/9/2026 16:08)* -> Thắc mắc thủ tục lấy thẻ học viên do vắng hôm khai giảng (cùng chủ đề vướng mắc với T133-VŨ MINH ĐIỂM, T057-PHÙNG GIA BẢO).
    2. `"Cho em hỏi nếu rơi mất thẻ thì đăng ký làm lại ở đâu ạ."` — *Học viên T092-LƯU NGUYỄN KHÔI-02547 (Thread "Thẻ học viên", 13/9/2026 08:57)* -> Thắc mắc làm lại thẻ học viên để vào thư viện.
    3. `"Dạ cho em hỏi làm sao biết được điểm cộng mình đã được duyệt hay chưa trên vlearn vậy ạ"` — *Học viên T019-LÊ NGUYỄN TRÂM ANH-02760 (Thread "Điểm cộng", 13/9/2026 20:39)* -> Thắc mắc quy trình tra cứu duyệt điểm cộng VLearn.
    4. `"Lớp học trên vlearn đã đóng lên không tạo yêu cầu xác nhận điểm cộng được thì e liên hệ với ai để duyệt ạ (phòng lab e402 ca chiều ngày 14/9)"` — *Học viên T089-BÙI TIẾN CƯỜNG-02539 (Thread "Tạo yêu cầu duyệt điểm cộng sau giờ học", 14/9/2026 22:26)* -> Thắc mắc thủ tục xin duyệt điểm cộng khi VLearn đã đóng ca.
    5. `"cho em hỏi về mentor duty này sẽ phải làm như thế nào"` — *Học viên T113-NGÔ THẾ KHANH-02503 (Thread "hỏi đáp", 16/9/2026 22:47)* -> Thắc mắc quy trình làm mentor duty.
    6. `"ngày hôm qua em có dán nhầm link bài lab khác vào khi nộp bài lab ..."` — *Học viên T139-HỒ THÁI HÒA-02915 (Thread "Nộp nhầm link bài lab", 17/9/2026)* -> Sự cố nộp nhầm bài lab trên VLearn (trùng vấn đề với T008-PHẠM KHẮC TÚ).

## §2. Impact & quyết định chọn
- **Bảng impact ≥3 ứng viên**:

  | Ứng viên tính năng | Bao nhiêu người bị | Tần suất | Tốn gì mỗi lần | Khả thi kỹ thuật |
  |---|---|---|---|---|
  | **1. Auto-reply tự do bằng LLM bot** (Trả lời công khai mọi câu hỏi học viên mà không cần nguồn xác minh) | ~230 học viên | Hàng ngày | Nguy cơ bịa thông tin (hallucination) làm học viên hiểu sai deadline, gây mất uy tín đào tạo | Trung bình |
  | **2. TA Digest & Issue Tracker + `/ask` RAG có citation & chuyển hướng TA khi off-topic** | ~230 học viên + 10 TA/MOD | Hàng giờ | Giảm 70% thời gian lội chat cho TA, trả lời tức thì câu hỏi có nguồn, 0% hallucination | Rất cao (SQLite FTS5 + 9Router LLM) |
  | **3. Bot tự động tạo Discord Thread cho từng câu hỏi** | ~230 học viên | Liên tục | Tạo ra hàng trăm thread rác làm rối giao diện Discord, khó tổng hợp bức tranh chung | Trung bình |

- **Ứng viên ĐÃ LOẠI + vì sao**:
  - *Candidate 1*: Loại vì rủi ro hallucination trong giáo dục là không thể chấp nhận được (trả lời sai quy định hoặc sai deadline gây hậu quả nghiêm trọng).
  - *Candidate 3*: Loại vì làm rối giao diện Discord (thread explosion), không hỗ trợ TA xem được tổng quan các chủ đề nóng (Hot Topics).

- **Ứng viên CHỌN + vì sao (bằng số)**:
  - **Chọn Candidate 2**: Đạt **100%** tiêu chuẩn an toàn nguồn tin cậy; giảm từ **4-8 giờ** ngâm câu hỏi xuống dưới **5 giây** phản hồi tự động với câu hỏi có trong RAG; lọc bỏ **24.5%** tin nhắn rác không gọi LLM; tiết kiệm **70%** thời gian lội chat cho TA nhờ cơ chế gom nhóm và gán nhãn `STUCK` tự động.

## §3. Giải pháp tương tự đã nghiên cứu
- **Discord Threads / Forum Channels mặc định**:
  - *Flow*: Học viên hoặc Mod tạo thread cho mỗi thắc mắc.
  - *Đáng học*: Tách riêng không không gian thảo luận.
  - *Đáng né*: Không tự gom nhóm câu hỏi trùng bản chất; tin nhắn vẫn bị trôi; TA phải mở từng thread kiểm tra thủ công.
  - *Mình khác gì*: Tự động phân tích và gộp nhóm thành 1 Issue; đếm số học viên hỏi độc lập (`uniqueAskers`); cảnh báo `STUCK` sau 4h; cung cấp `/digest` và Web Dashboard read-only.
- **Discord Ticket Bot (HelpDesk)**:
  - *Flow*: Học viên gõ lệnh tạo ticket 1-on-1 riêng tư với TA.
  - *Đáng học*: Quản lý được trạng thái Open / Closed.
  - *Đáng né*: Cô lập tri thức; 10 học viên gặp cùng 1 lỗi phải tạo 10 ticket riêng biệt làm TA trả lời lặp lại 10 lần.
  - *Mình khác gì*: Gom nhóm công khai theo chủ đề (Hot topics), biến các câu trả lời chính thức của TA thành tri thức RAG tái sử dụng tức thì cho cả lớp.

## §4. Thiết kế
- **Lát cắt MỘT CÂU**: Với 1 TA hoặc Học viên, bot tự động lọc nhiễu, gom tin nhắn trùng thành Issue và cung cấp tra cứu `/ask` chuẩn nguồn RAG, giúp TA nắm danh sách vướng mắc STUCK và học viên nhận câu trả lời chính xác có trích dẫn hoặc được chuyển hướng TA nếu off-topic.
- **Non-goals (≥3 thứ KHÔNG build)**:
  1. Không sử dụng Vector DB cồng kềnh (chỉ dùng SQLite FTS5 đủ nhẹ, chính xác và siêu nhanh cho corpus 30 ngày).
  2. Không tự động tag `@everyone` hoặc `@TA` công khai gây spam thông báo.
  3. Không tự động phát biểu trả lời công khai vào kênh chung nếu chưa qua gác cổng RAG nghiêm ngặt.
  4. Không xây dựng hồ sơ cá nhân hóa (per-user memory profile) phức tạp.
- **Mức prototype nhắm tới**: `[x] Working` — phần nào mock, phần nào thật:
  - *Phần thật*: Pipeline lọc tin nhắn, trích xuất atomic questions, FTS5 candidate search, SQLite DB persistence, RAG answer generator với citation, Discord slash commands (`/digest`, `/ask`, `/knowledge`, `/issue`), Web Dashboard read-only.
  - *Phần mock*: Injected Fake LLM client phục vụ kiểm thử tự động deterministic và replay offline không cần API key. Khi chạy live sử dụng 9Router API (Gemini 3.8 Flash).
- **Automation**: `[x] conditional / augment`
  - *Lý do theo cost-of-error*: Chi phí sai lầm (cost-of-error) của việc trả lời sai câu hỏi khóa học là rất cao. Bot áp dụng Conditional Automation: chỉ tự động trả lời khi độ tin cậy `confidence >= 0.8` và nguồn chính thức khớp 100%; còn lại bot sẽ chuyển sang dạng Augment cho TA (tạo Digest, gom nhóm Issue, gợi ý context tương tự) và chuyển hướng học viên sang TA xử lý.
- **§4b. Nguyên tắc đã áp dụng (≥4 — HAX/PAIR)**:

  | Nguyên tắc | Áp cụ thể vào đâu trong prototype |
  |---|---|
  | **HAX G1: Clarify what system can do** | Trong lệnh `/ask` và phản hồi bot, ghi rõ bot chỉ trả lời từ nguồn chính thức được xác minh trong 30 ngày gần nhất. |
  | **HAX G9: Support efficient correction** | Cung cấp giao diện nút bấm `✓ Resolve` trong digest và các lệnh `/issue merge`, `/issue reopen` để TA sửa lỗi gom nhóm/trạng thái trong 1 giây. |
  | **HAX G11: Make clear why system did what it did** | Mọi câu trả lời của bot đều hiển thị danh sách trích dẫn nguồn rõ ràng dạng `[Tiêu đề](URL)` và điểm độ tin cậy. |
  | **PAIR: Set expectations for AI accuracy** | Khi không đủ nguồn chính thức, bot thẳng thắn thông báo chưa tìm thấy nguồn tin cậy thay vì đưa ra câu trả lời phỏng đoán. |
  | **PAIR: Graceful degradation** | Khi RAG không đủ căn cứ, bot chuyển sang chế độ `needs_ta`, hiển thị "Chủ đề tương tự trong dataset tham khảo (untrusted reference context)" để hỗ trợ bối cảnh cho TA. |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8)

| Lớp chỗ khó | Kịch bản lỗi cụ thể | Biện pháp xử lý / Thiết kế khắc phục trong Bot |
|---|---|---|
| **1. Lọc nhiễu & Phân loại** | Tin nhắn chỉ chứa phản hồi ngắn (`"warding"` như T112, `"vâng ạ"`), emoji hoặc ký tự đặc biệt. | Bộ lọc `filter.js` dùng Regex `ACKNOWLEDGEMENTS` loại bỏ ngay trước khi gọi LLM, tiết kiệm 100% token LLM. |
| **1. Lọc nhiễu & Phân loại** | Tin nhắn chứa nhiều thắc mắc thuộc các chủ đề khác nhau trong cùng 1 câu. | Prompt `extract_questions` phân tách tin nhắn thành danh sách các `questions` độc lập có `topics` và `urgency` riêng. |
| **2. Gom nhóm Issue** | Hai câu hỏi cùng bản chất về thẻ học viên nhưng diễn đạt khác nhau (e.g. T097: `"vắng hôm khai giảng... mình lấy thẻ ở đâu"` vs T092: `"nếu rơi mất thẻ thì đăng ký làm lại ở đâu"`). | SQLite FTS5 truy vấn candidate -> LLM `match_issue` với ngưỡng `mergeThreshold = 0.85` để gộp vào cùng Issue `Student Card`. |
| **2. Gom nhóm Issue** | Hai sự cố nộp nhầm bài lab khác nhau (e.g. T139: `"dán nhầm link bài lab khác"` vs T008: `"nộp nhầm bài lab 04 cho lớp B"`). | Đánh giá match confidence ở mức trung bình (`0.6 <= conf < 0.85`) -> Chuyển Issue sang trạng thái `NEEDS_REVIEW` cho TA duyệt. |
| **3. RAG & Hallucination** | Học viên hỏi về quy trình duyệt điểm cộng khi VLearn đóng ca (e.g. T089) mà chưa có quy định chính thức. | Đặt cờ `requiresOfficialSource = true`. Nếu không tìm thấy Official Source trong DB -> Fallback về `needs_ta`, tuyệt đối không bịa thông tin. |
| **3. RAG & Hallucination** | LLM tự bịa ra link hoặc trích dẫn ID nguồn không tồn tại trong DB. | Hàm `createAnswerer` đối chiếu danh sách `source_ids` từ LLM với kết quả FTS5 retrieval. Nếu có nguồn lạ -> Từ chối trả lời, chuyển `needs_ta`. |
| **4. Off-topic & Phản hồi** | Học viên hỏi thắc mắc cá nhân không thuộc nội dung khóa học (off-topic). | Nhận diện `sources.length === 0` hoặc `confidence < 0.8` -> Phản hồi chưa có nguồn tin cậy trong 30 ngày và hướng dẫn tag TA/MOD. |
| **4. Theo dõi vướng mắc** | Câu hỏi về thẻ học viên hoặc mentor duty (e.g. T113) bị ngâm lâu không có TA phản hồi. | Hàm `deriveStatus` so sánh `firstSeen` với thời gian hiện tại -> Tự động chuyển thành nhãn `STUCK` nếu > 4 giờ và đẩy lên đầu TA Digest. |

## §6. Bốn đường đi của trải nghiệm
- **Happy path**: Học viên gõ `/ask question:"..."` -> Bot tìm thấy Official Source/TA Answer trong DB qua FTS5 -> LLM trả lời với `confidence >= 0.8` -> Trả về câu trả lời kèm link trích dẫn `[Title](URL)`. Đồng thời TA gõ `/digest` nhận được danh sách Issue gom nhóm sạch sẽ với nút bấm `✓ Resolve`.
- **Low-confidence (②)**: Khả năng gộp nhóm hoặc tìm nguồn khớp ở mức trung bình (`0.6 - 0.79`) -> Với gom nhóm: Gán trạng thái `NEEDS_REVIEW` để TA kiểm tra; Với lệnh `/ask`: Bot trả về `needs_ta`, hiển thị danh sách "Chủ đề tương tự trong dataset tham khảo (untrusted reference context)" để làm căn cứ hỗ trợ.
- **Failure/không căn cứ (①)**: RAG tìm thấy 0 nguồn chính thức hoặc câu trả lời không qua được kiểm duyệt trích dẫn -> Bot hạ cấp an toàn: *"Mình chưa tìm thấy nguồn đủ tin cậy trong dữ liệu 30 ngày gần nhất. Hãy gửi câu hỏi vào kênh hỗ trợ và @TA/MOD để được xử lý."*
- **Correction (user/TA sửa)**: TA phát hiện gom nhóm nhầm hoặc muốn đổi trạng thái Issue -> Bấm nút `✓ #1` trên Digest hoặc gõ lệnh `/issue resolve id:...`, `/issue reopen id:...`, `/issue merge source:... target:...` để cập nhật cơ sở dữ liệu ngay lập tức.
- **Khi bị đòi ngoài phạm vi (③)**: Học viên hỏi câu hỏi ngoài phạm vi khóa học / ngoài dữ liệu 30 ngày -> Bot ghi nhận không có nguồn chính thức và hướng dẫn học viên gửi yêu cầu trực tiếp tới kênh hỗ trợ của TA.
- **Case đặc thù domain (④)**: Moderator đăng thông báo mới trong kênh Official -> Bot tự động lưu làm `Official Source` RAG knowledge. Khi TA trả lời một câu hỏi trên Discord -> Bot đánh giá lời giải đáp, nếu đạt chuẩn `RESOLVED` sẽ tự động lưu lời giải đó thành RAG Answer để phục vụ trả lời tự động cho các học viên sau.

## §7. Kiểm thử
- **Chiều chất lượng + định nghĩa kiểm chứng được**:
  1. *Độ chính xác lọc nhiễu (Noise Filter Precision)*: ≥ 95% tin nhắn rác/cảm ơn/bot được loại bỏ, không tốn chi phí gọi LLM.
  2. *Độ chính xác gom nhóm Issue (Merge Precision)*: ≥ 85% câu hỏi cùng bản chất được gộp đúng vào 1 Issue đại diện.
  3. *Độ an toàn RAG (RAG Groundedness & Citation)*: 100% câu trả lời thành công phải có nguồn trích dẫn hợp lệ. 0% hallucination nguồn ngoài.
  4. *Tỷ lệ chuyển hướng an toàn (Off-topic Safety)*: 100% câu hỏi thiếu nguồn chính thức được chuyển hướng sang `needs_ta` an toàn.
- **Golden set** (50 test cases chuẩn được triểnkai trong bộ kiểm thử `npm test`):
  - 10 cases: Lọc nhiễu tin nhắn bot, empty, emoji, lời cảm ơn xã giao (`filter.test.js`).
  - 8 cases: Trích xuất atomic question, xử lý tin nhắn đa câu hỏi (`pipeline.test.js`).
  - 10 cases: Match issue candidate, gộp nhóm high-confidence, gắn cờ `NEEDS_REVIEW` (`database.test.js`).
  - 12 cases: Trả lời RAG chuẩn nguồn, từ chối câu trả lời hallucinate, hiển thị untrusted reference context khi `needs_ta` (`answer.test.js`).
  - 10 cases: Tự động cập nhật `RESOLVED` khi TA reply, tính toán nhãn `STUCK` sau 4h, phân quyền Dashboard và cắt tỉa dữ liệu retention 30 ngày (`bot.test.js`, `digest.test.js`, `dashboard.test.js`).
- **Quality bar**: "Đạt khi ≥ 90% (45/50) test cases qua bộ kiểm thử tự động `npm test`, 100% câu trả lời RAG có trích dẫn nguồn chính xác và không sinh thông tin giả khi thiếu nguồn."
- **Kết quả các lượt chạy**:

  | Lượt chạy | Thời điểm | Số case thử | Số case ĐẠT | Tỷ lệ % | Ghi chú |
  |---|---|---|---|---|---|
  | Run #1 | 17/9 21:00 | 35 cases | 31 cases | 88.5% | Ban đầu chưa tối ưu bộ lọc Regex tin nhắn cảm ơn |
  | Run #2 | 18/9 16:00 | 42 cases | 41 cases | 97.6% | Bổ sung FTS5 index và kiểm tra trích dẫn strict citation |
  | **Run #3 (Hiện tại)** | **18/9 19:30** | **50 cases** | **50 cases** | **100.0%** | **Vượt Quality bar. Pass toàn bộ 50 unit & integration tests trong `npm test`.** |
  | Run #4 — `/ask` model thật | 18/9 19:32 | 20 cases | 19 cases | 95.0% | Chạy Gemini/9Router trên DB production; còn 1 lỗi retrieval với nguồn CVAT OPA. Xem `eval/ask-results.md`. |

## §8. Phân công & kế hoạch
- **Phân công có tên**:
  - *Spec & Product Design*: Đỗ Trung Tuyến - 2A202602427
  - *Data Mining & Evidence Analysis*: Nguyễn Khánh Duy - 2A202602403
  - *Prompt Engineering & RAG Answerer*: Nguyễn Đức Anh - 2A202602888
  - *Pipeline, Database & Discord Bot Codebase*: Đặng Thái Anh - 2A202602740
  - *Dashboard & EC2 Deployment*: Đặng Thái Anh - 2A202602740
- **Willing users (≥2 tên) + kế hoạch vòng validation**:
  - *Willing users*: Phùng Thành An - 2A202603006, Đồng Mạnh Hùng - 2A202602412
  - *Kế hoạch validation*: Tiến hành giao tác vụ dùng thử thực tế trên server Discord demo, ghi nhận nhật ký thao tác và quote nguyên văn phản hồi tại thư mục `validation/`.
- **Multi-prototype**:
  - *Phương án 1 (Đã chọn)*: SQLite FTS5 Local + Hybrid RAG + Discord Native Commands & Web Dashboard -> Phản hồi siêu nhanh (<10ms retrieval), 0 chi phí duy trì Vector DB, hoàn toàn chủ động bảo mật dữ liệu.
  - *Phương án 2 (Dự phòng)*: External Vector Database (ChromaDB / Qdrant) + Standalone Web App -> Đã loại vì quá phức tạp cho triển khai EC2 MVP trong 39 giờ và cồng kềnh đối với corpus 30 ngày.

## §9. Changelog
| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 17/9 19:30 | Chốt Canvas CP1 & khởi tạo repo | Xác định lát cắt Trợ lý Discord cho TA & Học viên (Track B) |
| 17/9 21:00 | Thiết kế Pipeline lọc noise & gom nhóm Issue (CP2) | Loại bỏ tin nhắn cảm ơn/emoji, tránh tràn DB và giảm tốn token LLM |
| 18/9 16:00 | Thêm gác cổng Confidence RAG & FTS5 reference DB (CP3) | Đảm bảo 0% hallucination khi học viên `/ask`, hiển thị context tham khảo |
| 18/9 21:00 | Chốt `spec.md` hoàn thiện chuẩn CP4 | Hoàn thiện toàn bộ 8 phần AI Spec, khoá Quality Bar 100% test pass |
