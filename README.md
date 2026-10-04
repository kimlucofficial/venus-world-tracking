# Venus World Development Tracker

Discord bot quản lý công việc/source/bug/vote cho VTeam + Helper. Node.js 20, discord.js v14, MySQL Railway.

## Quyền
- Owner bypass
- VTeam role
- Helper role
- Các role khác không dùng được command/button của bot.

## Kênh
- `TRACKER_CHANNEL_ID`: tất cả task + bug + dashboard-related tracking.
- Vote dùng chung `TRACKER_CHANNEL_ID`; không cần kênh vote riêng.
- Không có announce channel, changelog channel hoặc bug channel riêng.

## Railway Variables
Copy `.env.example` và tạo Variables tương ứng trong Railway.

**Không commit bot token/database password lên GitHub.**

Required:
- DISCORD_BOT_TOKEN
- DATABASE_URL
- CLIENT_ID
- GUILD_ID
- OWNER_ID
- ROLE_VTEAM_ID
- ROLE_HELPER_ID
- TRACKER_CHANNEL_ID

Optional:
- TIMEZONE (default Australia/Melbourne)

## Deploy Railway
1. Reset Discord bot token nếu token cũ từng được chia sẻ ở nơi không an toàn.
2. Push folder này lên GitHub.
3. Railway → New Project → Deploy from GitHub.
4. Add MySQL service.
5. Trong bot service, add/reference `DATABASE_URL` của MySQL service.
6. Add Discord variables từ `.env.example`.
7. Start command: `npm start`.
8. Bot tự tạo MySQL tables và tự đăng ký slash commands vào guild khi start.

## Discord Bot permissions
Invite bot với scopes:
- `bot`
- `applications.commands`

Bot permissions tối thiểu:
- View Channels
- Send Messages
- Embed Links
- Read Message History
- Use External Emojis

Nếu muốn bot xóa card khi `/xoaviec`, cấp thêm `Manage Messages`.

## Lệnh
### Công việc
- `/taoviec`
- `/suaviec`
- `/xoaviec`
- `/phancong`
- `/tiendo`
- `/trangthai`
- `/hoanthanh`
- `/thongtin`
- `/lichsu`
- `/danhsach`
- `/capnhat`

### Bug
- `/baoloi`
- `/nhanloi`
- `/dasualoi`
- `/molailoi`

### Vote
- `/taobinhchon`
- `/dongbinhchon`
- `/danhsachbinhchon`

### Tổng quan
- `/bangtheodoi`
- `/deadline`
- `/thanhvien`

## ID tự động
- Task: `VNS-0001`, `VNS-0002`, ...
- Bug: `BUG-0001`, ...
- Vote: `VOTE-0001`, ...

## Tracker behavior
Task card được đăng một lần vào tracker. Các lệnh tiến độ/phân công/trạng thái/hoàn thành chỉnh trực tiếp card cũ. Mọi thay đổi được lưu trong `task_history` và xem bằng `/lichsu`.

Buttons vẫn hoạt động sau restart vì custom ID được xử lý động, không phụ thuộc collector trong RAM.
