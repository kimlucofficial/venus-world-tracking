# Venus Tracker — Single Board

Bản này dùng **một message duy nhất** trong `TRACKER_CHANNEL_ID` cho toàn bộ tracker.

## Cách hoạt động

- `/bangtheodoi` tạo/cập nhật bảng công khai.
- Công việc, bug và vote **không tạo card/message riêng**.
- Tạo mới hoặc cập nhật tiến độ/trạng thái/phân công sẽ edit lại đúng bảng chung.
- Các nút thao tác nằm dưới cùng bảng:
  - Tạo việc
  - Quản lý việc
  - Báo lỗi
  - Xử lý lỗi
  - Tạo vote
  - Bình chọn
  - Làm mới
- `Quản lý việc`, `Xử lý lỗi`, `Bình chọn` mở input để nhập ID (`VNS-0001`, `BUG-0001`, `VOTE-0001`) rồi hiện bảng điều khiển riêng tư cho người thao tác.
- Khi deploy bản này, bot tự xóa các card task/bug/vote cũ mà phiên bản trước đã tạo, giữ lại bảng tracker chung.

## Railway Variables

```env
DISCORD_BOT_TOKEN=
DATABASE_URL=${{MySQL.MYSQL_URL}}
CLIENT_ID=1556204770123849788
GUILD_ID=1531743806070984815
OWNER_ID=510847279490662400
ROLE_VTEAM_ID=531744066218229830
ROLE_HELPER_ID=1535493904000876614
TRACKER_CHANNEL_ID=1556182195981385819
TIMEZONE=Australia/Melbourne
```

> Reset token Discord cũ nếu token đã từng được chia sẻ công khai.

## Run

```bash
npm install
npm start
```

Database MySQL Railway được tạo bảng tự động khi bot khởi động.
