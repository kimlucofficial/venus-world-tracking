import { SlashCommandBuilder } from 'discord.js';

const statusChoices = [
  ['Chờ làm','pending'], ['Đang làm','doing'], ['Đang test','testing'], ['Cần chỉnh sửa','revise'], ['Bị block','blocked'], ['Hoàn thành','done'], ['Đã hủy','cancelled']
].map(([name,value])=>({name,value}));
const priorityChoices = [
  {name:'Thấp',value:'low'},{name:'Vừa',value:'normal'},{name:'Cao',value:'high'},{name:'Khẩn cấp',value:'urgent'}
];
const severityChoices = [
  {name:'Minor',value:'minor'},{name:'Normal',value:'normal'},{name:'Major',value:'major'},{name:'Critical',value:'critical'}
];

export const commands = [
  new SlashCommandBuilder().setName('taoviec').setDescription('Tạo công việc mới')
    .addStringOption(o=>o.setName('ten').setDescription('Tên công việc/source').setRequired(true))
    .addStringOption(o=>o.setName('mota').setDescription('Mô tả công việc').setRequired(true))
    .addUserOption(o=>o.setName('nguoi').setDescription('Người đảm nhận'))
    .addStringOption(o=>o.setName('deadline').setDescription('VD: 10/10/2026 23:59'))
    .addStringOption(o=>o.setName('douutien').setDescription('Độ ưu tiên').addChoices(...priorityChoices))
    .addStringOption(o=>o.setName('loai').setDescription('VD: source, ui, fix, config')),

  new SlashCommandBuilder().setName('suaviec').setDescription('Sửa thông tin công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true))
    .addStringOption(o=>o.setName('ten').setDescription('Tên mới'))
    .addStringOption(o=>o.setName('mota').setDescription('Mô tả mới'))
    .addStringOption(o=>o.setName('deadline').setDescription('Deadline mới'))
    .addStringOption(o=>o.setName('douutien').setDescription('Độ ưu tiên').addChoices(...priorityChoices)),

  new SlashCommandBuilder().setName('xoaviec').setDescription('Xóa công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true)),

  new SlashCommandBuilder().setName('phancong').setDescription('Phân công nhiều người thực hiện')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true))
    .addUserOption(o=>o.setName('nguoi').setDescription('Người đảm nhận 1').setRequired(true))
    .addUserOption(o=>o.setName('nguoi2').setDescription('Người đảm nhận 2'))
    .addUserOption(o=>o.setName('nguoi3').setDescription('Người đảm nhận 3'))
    .addUserOption(o=>o.setName('nguoi4').setDescription('Người đảm nhận 4'))
    .addUserOption(o=>o.setName('nguoi5').setDescription('Người đảm nhận 5')),

  new SlashCommandBuilder().setName('tiendo').setDescription('Cập nhật tiến độ công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true))
    .addIntegerOption(o=>o.setName('phantram').setDescription('0 đến 100').setMinValue(0).setMaxValue(100).setRequired(true)),

  new SlashCommandBuilder().setName('trangthai').setDescription('Đổi trạng thái công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true))
    .addStringOption(o=>o.setName('trangthai').setDescription('Trạng thái').setRequired(true).addChoices(...statusChoices)),

  new SlashCommandBuilder().setName('hoanthanh').setDescription('Đánh dấu công việc hoàn thành')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true)),

  new SlashCommandBuilder().setName('thongtin').setDescription('Xem thông tin công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true)),

  new SlashCommandBuilder().setName('lichsu').setDescription('Xem lịch sử công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true)),

  new SlashCommandBuilder().setName('danhsach').setDescription('Danh sách công việc')
    .addStringOption(o=>o.setName('trangthai').setDescription('Lọc trạng thái').addChoices(...statusChoices)),

  new SlashCommandBuilder().setName('baoloi').setDescription('Báo lỗi vào tracker')
    .addStringOption(o=>o.setName('ten').setDescription('Tên lỗi').setRequired(true))
    .addStringOption(o=>o.setName('mota').setDescription('Mô tả lỗi').setRequired(true))
    .addStringOption(o=>o.setName('mucdo').setDescription('Mức độ').addChoices(...severityChoices))
    .addIntegerOption(o=>o.setName('congviec').setDescription('ID công việc liên quan')),

  new SlashCommandBuilder().setName('nhanloi').setDescription('Nhận xử lý một lỗi')
    .addIntegerOption(o=>o.setName('id').setDescription('ID lỗi').setRequired(true)),

  new SlashCommandBuilder().setName('dasualoi').setDescription('Đánh dấu lỗi đã sửa')
    .addIntegerOption(o=>o.setName('id').setDescription('ID lỗi').setRequired(true)),

  new SlashCommandBuilder().setName('molailoi').setDescription('Mở lại lỗi đã đóng')
    .addIntegerOption(o=>o.setName('id').setDescription('ID lỗi').setRequired(true)),

  new SlashCommandBuilder().setName('taobinhchon').setDescription('Tạo bình chọn cơ chế mới')
    .addStringOption(o=>o.setName('tieude').setDescription('Tiêu đề bình chọn').setRequired(true))
    .addStringOption(o=>o.setName('mota').setDescription('Mô tả đề xuất').setRequired(true))
    .addIntegerOption(o=>o.setName('sogio').setDescription('Số giờ mở vote (mặc định 24)').setMinValue(1).setMaxValue(168)),

  new SlashCommandBuilder().setName('dongbinhchon').setDescription('Đóng bình chọn')
    .addIntegerOption(o=>o.setName('id').setDescription('ID bình chọn').setRequired(true)),

  new SlashCommandBuilder().setName('danhsachbinhchon').setDescription('Xem các bình chọn gần đây'),

  new SlashCommandBuilder().setName('bangtheodoi').setDescription('Xem tổng quan tracker'),
  new SlashCommandBuilder().setName('deadline').setDescription('Xem các công việc sắp tới hạn'),
  new SlashCommandBuilder().setName('thanhvien').setDescription('Xem thống kê một thành viên')
    .addUserOption(o=>o.setName('nguoi').setDescription('Thành viên').setRequired(true)),
  new SlashCommandBuilder().setName('capnhat').setDescription('Ghi chú cập nhật vào lịch sử công việc')
    .addIntegerOption(o=>o.setName('id').setDescription('ID công việc').setRequired(true))
    .addStringOption(o=>o.setName('noidung').setDescription('Nội dung cập nhật').setRequired(true))
].map(c=>c.toJSON());
