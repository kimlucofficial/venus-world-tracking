import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} from 'discord.js';
import { db } from '../db.js';

export async function dashboardPayload() {
  const [taskRows] = await db.query('SELECT status,COUNT(*) c FROM tasks GROUP BY status');
  const [bugs] = await db.query("SELECT COUNT(*) c FROM bugs WHERE status<>'fixed'");
  const [votes] = await db.query("SELECT COUNT(*) c FROM votes WHERE status='open'");
  const [recentTasks] = await db.query("SELECT id,code,title,status,progress FROM tasks ORDER BY id DESC LIMIT 25");

  const map = Object.fromEntries(taskRows.map(r => [r.status, Number(r.c)]));
  const total = Object.values(map).reduce((a,b)=>a+b,0);
  const done = map.done || 0;
  const pct = total ? Math.round(done / total * 100) : 0;

  const embed = new EmbedBuilder()
    .setColor(0x9B59FF)
    .setTitle('DEVELOPMENT TRACKER')
    .setDescription([
      `📝 Chờ làm: **${map.pending||0}**`,
      `🔵 Đang làm: **${map.doing||0}**`,
      `🟣 Đang test: **${map.testing||0}**`,
      `🟠 Cần chỉnh: **${map.revise||0}**`,
      `🔴 Bị block: **${map.blocked||0}**`,
      `✅ Hoàn thành: **${done}**`,
      `🐞 Bug chưa đóng: **${Number(bugs[0]?.c||0)}**`,
      `🗳️ Vote đang mở: **${Number(votes[0]?.c||0)}**`,
      '',
      `**Tổng tiến độ:** ${pct}%`,
      '',
      'Dùng các nút bên dưới để thao tác. Không cần nhớ ID để tạo mới.'
    ].join('\n'));

  const quick = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_create_task').setLabel('Tạo việc').setStyle(ButtonStyle.Primary).setEmoji('➕'),
    new ButtonBuilder().setCustomId('dash_create_bug').setLabel('Báo lỗi').setStyle(ButtonStyle.Danger).setEmoji('🐞'),
    new ButtonBuilder().setCustomId('dash_create_vote').setLabel('Tạo vote').setStyle(ButtonStyle.Secondary).setEmoji('🗳️'),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Làm mới').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
  );

  const components = [quick];
  if (recentTasks.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('dash_select_task')
      .setPlaceholder('Chọn công việc để quản lý...')
      .addOptions(recentTasks.map(t => new StringSelectMenuOptionBuilder()
        .setLabel(`${t.code} • ${String(t.title).slice(0,70)}`)
        .setDescription(`${t.progress}% • ${statusText(t.status)}`.slice(0,100))
        .setValue(String(t.id))));
    components.push(new ActionRowBuilder().addComponents(select));
  }

  return { embeds:[embed], components };
}

export function taskControlPayload(task) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59FF)
    .setTitle(`${task.code} • ${task.title}`)
    .setDescription(`Tiến độ **${task.progress}%** • ${statusText(task.status)}\n${task.assignee_id ? `Người làm: <@${task.assignee_id}>` : 'Chưa phân công'}`);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dash_assign:${task.id}`).setLabel('Phân công').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`dash_progress:${task.id}`).setLabel('Tiến độ').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dash_status:${task.id}`).setLabel('Trạng thái').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dash_note:${task.id}`).setLabel('Ghi chú').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`dash_done:${task.id}`).setLabel('Hoàn thành').setStyle(ButtonStyle.Success).setDisabled(task.status==='done')
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dash_edit:${task.id}`).setLabel('Sửa công việc').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId(`dash_delete:${task.id}`).setLabel('Xóa').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );

  return { embeds:[embed], components:[row1,row2] };
}

export function createTaskModal() {
  const modal = new ModalBuilder().setCustomId('modal_create_task').setTitle('Tạo công việc');
  modal.addComponents(
    row(input('task_title','Tên công việc',TextInputStyle.Short,true,'Ví dụ: Fix HUD')),
    row(input('task_desc','Mô tả',TextInputStyle.Paragraph,true,'Mô tả việc cần làm')),
    row(input('task_deadline','Deadline',TextInputStyle.Short,false,'10/10/2026 23:59')),
    row(input('task_priority','Độ ưu tiên',TextInputStyle.Short,false,'low / normal / high / urgent')),
    row(input('task_category','Loại công việc',TextInputStyle.Short,false,'source / fix / ui / config'))
  );
  return modal;
}

export function createBugModal() {
  const modal = new ModalBuilder().setCustomId('modal_create_bug').setTitle('Báo lỗi');
  modal.addComponents(
    row(input('bug_title','Tên lỗi',TextInputStyle.Short,true)),
    row(input('bug_desc','Mô tả lỗi',TextInputStyle.Paragraph,true)),
    row(input('bug_severity','Mức độ',TextInputStyle.Short,false,'minor / normal / major / critical')),
    row(input('bug_task','Task ID liên quan',TextInputStyle.Short,false,'Ví dụ: 12 hoặc VNS-0012'))
  );
  return modal;
}

export function createVoteModal() {
  const modal = new ModalBuilder().setCustomId('modal_create_vote').setTitle('Tạo bình chọn');
  modal.addComponents(
    row(input('vote_title','Tiêu đề',TextInputStyle.Short,true)),
    row(input('vote_desc','Nội dung đề xuất',TextInputStyle.Paragraph,true)),
    row(input('vote_hours','Thời gian mở vote (giờ)',TextInputStyle.Short,false,'24'))
  );
  return modal;
}

export function progressModal(taskId, current=0) {
  const modal = new ModalBuilder().setCustomId(`modal_progress:${taskId}`).setTitle('Cập nhật tiến độ');
  const field = input('progress_value','Tiến độ 0 - 100',TextInputStyle.Short,true,String(current));
  modal.addComponents(row(field));
  return modal;
}

export function noteModal(taskId) {
  const modal = new ModalBuilder().setCustomId(`modal_note:${taskId}`).setTitle('Ghi chú công việc');
  modal.addComponents(row(input('note_value','Nội dung cập nhật',TextInputStyle.Paragraph,true,'Đã làm tới...')));
  return modal;
}

export function editTaskModal(task) {
  const modal = new ModalBuilder().setCustomId(`modal_edit_task:${task.id}`).setTitle('Sửa công việc');
  const title = input('edit_title','Tên công việc',TextInputStyle.Short,true); title.setValue(String(task.title||'').slice(0,4000));
  const desc = input('edit_desc','Mô tả',TextInputStyle.Paragraph,true); desc.setValue(String(task.description||'').slice(0,4000));
  const deadline = input('edit_deadline','Deadline',TextInputStyle.Short,false,'10/10/2026 23:59');
  const priority = input('edit_priority','Độ ưu tiên',TextInputStyle.Short,false,'low / normal / high / urgent'); priority.setValue(task.priority||'normal');
  modal.addComponents(row(title),row(desc),row(deadline),row(priority));
  return modal;
}

export function deleteTaskModal(taskId) {
  const modal = new ModalBuilder().setCustomId(`modal_delete_task:${taskId}`).setTitle('Xác nhận xóa công việc');
  modal.addComponents(row(input('delete_confirm','Nhập XOA để xác nhận',TextInputStyle.Short,true,'XOA')));
  return modal;
}

export function statusMenu(taskId) {
  const menu = new StringSelectMenuBuilder().setCustomId(`dash_status_select:${taskId}`).setPlaceholder('Chọn trạng thái...')
    .addOptions([
      ['pending','📝 Chờ làm'],['doing','🔵 Đang làm'],['testing','🟣 Đang test'],['revise','🟠 Cần chỉnh sửa'],['blocked','🔴 Bị block'],['done','✅ Hoàn thành'],['cancelled','⚫ Đã hủy']
    ].map(([value,label]) => new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)));
  return { content:'Chọn trạng thái mới:', components:[new ActionRowBuilder().addComponents(menu)] };
}

export function assigneeMenu(taskId) {
  const menu = new UserSelectMenuBuilder().setCustomId(`dash_assign_select:${taskId}`).setPlaceholder('Chọn người đảm nhận').setMinValues(1).setMaxValues(1);
  return { content:'Chọn thành viên để phân công:', components:[new ActionRowBuilder().addComponents(menu)] };
}

function row(component){ return new ActionRowBuilder().addComponents(component); }
function input(id,label,style,required,placeholder){
  const x = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required);
  if (placeholder) x.setPlaceholder(placeholder);
  return x;
}
function statusText(status){
  return ({pending:'Chờ làm',doing:'Đang làm',testing:'Đang test',revise:'Cần chỉnh sửa',blocked:'Bị block',done:'Hoàn thành',cancelled:'Đã hủy'})[status] || status;
}
