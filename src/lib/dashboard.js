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
import { config } from '../config.js';
import { discordTimestamp } from './time.js';

export async function dashboardPayload() {
  const [taskRows] = await db.query('SELECT status,COUNT(*) c FROM tasks GROUP BY status');
  const [bugsCount] = await db.query("SELECT COUNT(*) c FROM bugs WHERE status<>'fixed'");
  const [votesCount] = await db.query("SELECT COUNT(*) c FROM votes WHERE status='open'");
  const [tasks] = await db.query("SELECT * FROM tasks ORDER BY FIELD(status,'blocked','revise','testing','doing','pending','done','cancelled'), deadline IS NULL, deadline ASC, id DESC LIMIT 18");
  const [openBugs] = await db.query("SELECT * FROM bugs WHERE status<>'fixed' ORDER BY FIELD(severity,'critical','major','normal','minor'), id DESC LIMIT 6");
  const [openVotes] = await db.query("SELECT * FROM votes WHERE status='open' ORDER BY id DESC LIMIT 5");
  const [[avgRow]] = await db.query("SELECT COALESCE(ROUND(AVG(progress)),0) avg_progress FROM tasks WHERE status<>'cancelled'");

  const map = Object.fromEntries(taskRows.map(r => [r.status, Number(r.c)]));
  const overall = Number(avgRow?.avg_progress || 0);

  const voteLines = [];
  for (const v of openVotes) {
    const [[yesRow]] = await db.query("SELECT COUNT(*) c FROM vote_choices WHERE vote_id=? AND choice='yes'",[v.id]);
    const [[noRow]] = await db.query("SELECT COUNT(*) c FROM vote_choices WHERE vote_id=? AND choice='no'",[v.id]);
    voteLines.push(`**${v.code} • ${String(v.title||'').slice(0,70)}**\n${config.emojis.yes} ${Number(yesRow?.c||0)}  •  ${config.emojis.no} ${Number(noRow?.c||0)}${v.closes_at ? `  •  ⏰ ${discordTimestamp(v.closes_at)}` : ''}`);
  }

  const sections = [
    `### <a:Manao23:1553624445418213447> TỔNG QUAN`,
    `**Chờ làm:** ${map.pending||0}   **Đang làm:** ${map.doing||0}   **Đang test:** ${map.testing||0}`,
    `**Cần chỉnh:** ${map.revise||0}   **Bị block:** ${map.blocked||0}   **Hoàn thành:** ${map.done||0}`,
    `**Bug mở:** ${Number(bugsCount[0]?.c||0)}   **Vote mở:** ${Number(votesCount[0]?.c||0)}`,
    `**Tiến độ chung:** ${progressBar(overall)}`,
    '',
    `### <a:1357882491800911983:1553623193082794058> CÔNG VIỆC`,
    tasks.length ? tasks.map(taskLine).join('\n\n') : '*Chưa có công việc.*',
    '',
    `### <a:gold:1555468545440358442> BUG ĐANG MỞ`,
    openBugs.length ? openBugs.map(bugLine).join('\n') : '*Không có bug đang mở.*',
    '',
    `### <a:18212kittypaw22:1553624799266472006> TEAM VOTE`,
    voteLines.length ? voteLines.join('\n\n') : '*Không có bình chọn đang mở.*'
  ];

  // Discord giới hạn description của 1 embed ở 4096 ký tự.
  // Giữ toàn bộ dashboard trong MỘT embed và cắt phần cuối nếu dữ liệu quá dài.
  let description = sections.join('\n');
  if (description.length > 4050) {
    description = `${description.slice(0, 3980)}\n\n*… Còn thêm dữ liệu. Dùng các nút bên dưới để quản lý.*`;
  }

  const board = new EmbedBuilder()
    .setColor(0x9B59FF)
    .setTitle('BẢNG THEO DÕI TEAM')
    .setDescription(description)
    .setFooter({text:'Team Tracker • Tự động cập nhật'})
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_create_task').setLabel('Tạo việc').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('dash_manage_task').setLabel('Quản lý việc').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_create_bug').setLabel('Báo lỗi').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('dash_manage_bug').setLabel('Xử lý lỗi').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_create_vote').setLabel('Tạo vote').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_vote').setLabel('Bình chọn').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Làm mới').setStyle(ButtonStyle.Secondary)
  );

  return { embeds:[board], components:[row1,row2] };
}

function taskLine(t){
  const who=t.assignee_id?`<@${t.assignee_id}>`:'*Chưa phân công*';
  const deadline=t.deadline?discordTimestamp(t.deadline):'*Không deadline*';
  const title=String(t.title||'').slice(0,90); return `**${t.code} • ${title}**\n${statusText(t.status)} • ${progressBar(t.progress)}\n${who} • ${deadline}`;
}
function bugLine(b){
  const sev={minor:'Nhẹ',normal:'Bình thường',major:'Nghiêm trọng',critical:'Khẩn cấp'}[b.severity]||b.severity;
  const st={open:'Chưa xử lý',fixing:'Đang sửa',reopened:'Mở lại'}[b.status]||b.status;
  const title=String(b.title||'').slice(0,90); return `**${b.code} • ${title}** — ${sev} ${st}${b.assignee_id?` • <@${b.assignee_id}>`:''}`;
}
function progressBar(percent){
  const p=Math.max(0,Math.min(100,Number(percent)||0));
  const fill=Math.round(p/10);
  return `${'█'.repeat(fill)}${'░'.repeat(10-fill)} **${p}%**`;
}
function statusEmoji(status){
  return ({pending:'📝',doing:'🔵',testing:'🟣',revise:'🟠',blocked:'🔴',done:'✅',cancelled:'⚫'})[status] || '❔';
}
function statusText(status){
  return ({pending:'Chờ làm',doing:'Đang làm',testing:'Đang test',revise:'Cần chỉnh sửa',blocked:'Bị block',done:'Hoàn thành',cancelled:'Đã hủy'})[status] || status;
}

export function taskControlPayload(task) {
  const embed = new EmbedBuilder().setColor(0x9B59FF).setTitle(`${task.code} • ${task.title}`)
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

export function bugControlPayload(bug){
  const embed=new EmbedBuilder().setColor(0xED4245).setTitle(`${bug.code} • ${bug.title}`).setDescription(bug.description||'*Không có mô tả*');
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bug_take:${bug.id}`).setLabel('Nhận sửa').setStyle(ButtonStyle.Primary).setDisabled(bug.status==='fixed'),
    new ButtonBuilder().setCustomId(`bug_fixed:${bug.id}`).setLabel('Đã sửa').setStyle(ButtonStyle.Success).setDisabled(bug.status==='fixed'),
    new ButtonBuilder().setCustomId(`bug_reopen:${bug.id}`).setLabel('Mở lại').setStyle(ButtonStyle.Danger).setDisabled(bug.status!=='fixed')
  );
  return {embeds:[embed],components:[row]};
}

export function voteControlPayload(vote, yes=0, no=0){
  const embed=new EmbedBuilder().setColor(0xB56BFF).setTitle(`${vote.code} • ${vote.title}`).setDescription(vote.description||'*Không có mô tả*').setFooter({text:'Team Vote'});
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vote_yes:${vote.id}`).setLabel(`Đồng ý (${yes})`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`vote_no:${vote.id}`).setLabel(`Không đồng ý (${no})`).setStyle(ButtonStyle.Danger)
  );
  return {embeds:[embed],components:[row]};
}

export function createTaskModal(){
  const modal=new ModalBuilder().setCustomId('modal_create_task').setTitle('Tạo công việc');
  modal.addComponents(row(input('task_title','Tên công việc',TextInputStyle.Short,true,'Ví dụ: Fix HUD')),row(input('task_desc','Mô tả',TextInputStyle.Paragraph,true,'Mô tả việc cần làm')),row(input('task_deadline','Deadline',TextInputStyle.Short,false,'10/10/2026 23:59')),row(input('task_priority','Độ ưu tiên',TextInputStyle.Short,false,'low / normal / high / urgent')),row(input('task_category','Loại công việc',TextInputStyle.Short,false,'source / fix / ui / config'))); return modal;
}
export function createBugModal(){ const modal=new ModalBuilder().setCustomId('modal_create_bug').setTitle('Báo lỗi'); modal.addComponents(row(input('bug_title','Tên lỗi',TextInputStyle.Short,true)),row(input('bug_desc','Mô tả lỗi',TextInputStyle.Paragraph,true)),row(input('bug_severity','Mức độ',TextInputStyle.Short,false,'minor / normal / major / critical')),row(input('bug_task','Task ID liên quan',TextInputStyle.Short,false,'VNS-0012'))); return modal; }
export function createVoteModal(){ const modal=new ModalBuilder().setCustomId('modal_create_vote').setTitle('Tạo bình chọn'); modal.addComponents(row(input('vote_title','Tiêu đề',TextInputStyle.Short,true)),row(input('vote_desc','Nội dung đề xuất',TextInputStyle.Paragraph,true)),row(input('vote_hours','Thời gian mở vote (giờ)',TextInputStyle.Short,false,'24'))); return modal; }
export function manageTaskModal(){ const modal=new ModalBuilder().setCustomId('modal_manage_task').setTitle('Quản lý công việc'); modal.addComponents(row(input('manage_task_id','ID công việc',TextInputStyle.Short,true,'Ví dụ: VNS-0007'))); return modal; }
export function manageBugModal(){ const modal=new ModalBuilder().setCustomId('modal_manage_bug').setTitle('Xử lý lỗi'); modal.addComponents(row(input('manage_bug_id','ID lỗi',TextInputStyle.Short,true,'Ví dụ: BUG-0003'))); return modal; }
export function votePickModal(){ const modal=new ModalBuilder().setCustomId('modal_pick_vote').setTitle('Chọn bình chọn'); modal.addComponents(row(input('pick_vote_id','ID vote',TextInputStyle.Short,true,'Ví dụ: VOTE-0002'))); return modal; }
export function progressModal(taskId,current=0){ const modal=new ModalBuilder().setCustomId(`modal_progress:${taskId}`).setTitle('Cập nhật tiến độ'); modal.addComponents(row(input('progress_value','Tiến độ 0 - 100',TextInputStyle.Short,true,String(current)))); return modal; }
export function noteModal(taskId){ const modal=new ModalBuilder().setCustomId(`modal_note:${taskId}`).setTitle('Ghi chú công việc'); modal.addComponents(row(input('note_value','Nội dung cập nhật',TextInputStyle.Paragraph,true,'Đã làm tới...'))); return modal; }
export function editTaskModal(task){ const modal=new ModalBuilder().setCustomId(`modal_edit_task:${task.id}`).setTitle('Sửa công việc'); const title=input('edit_title','Tên công việc',TextInputStyle.Short,true); title.setValue(String(task.title||'').slice(0,4000)); const desc=input('edit_desc','Mô tả',TextInputStyle.Paragraph,true); desc.setValue(String(task.description||'').slice(0,4000)); const deadline=input('edit_deadline','Deadline',TextInputStyle.Short,false,'10/10/2026 23:59'); const priority=input('edit_priority','Độ ưu tiên',TextInputStyle.Short,false,'low / normal / high / urgent'); priority.setValue(task.priority||'normal'); modal.addComponents(row(title),row(desc),row(deadline),row(priority)); return modal; }
export function deleteTaskModal(taskId){ const modal=new ModalBuilder().setCustomId(`modal_delete_task:${taskId}`).setTitle('Xác nhận xóa công việc'); modal.addComponents(row(input('delete_confirm','Nhập XOA để xác nhận',TextInputStyle.Short,true,'XOA'))); return modal; }
export function statusMenu(taskId){ const menu=new StringSelectMenuBuilder().setCustomId(`dash_status_select:${taskId}`).setPlaceholder('Chọn trạng thái...').addOptions([['pending','📝 Chờ làm'],['doing','🔵 Đang làm'],['testing','🟣 Đang test'],['revise','🟠 Cần chỉnh sửa'],['blocked','🔴 Bị block'],['done','✅ Hoàn thành'],['cancelled','⚫ Đã hủy']].map(([value,label])=>new StringSelectMenuOptionBuilder().setLabel(label).setValue(value))); return {content:'Chọn trạng thái mới:',components:[new ActionRowBuilder().addComponents(menu)]}; }
export function assigneeMenu(taskId){ const menu=new UserSelectMenuBuilder().setCustomId(`dash_assign_select:${taskId}`).setPlaceholder('Chọn người đảm nhận').setMinValues(1).setMaxValues(1); return {content:'Chọn thành viên để phân công:',components:[new ActionRowBuilder().addComponents(menu)]}; }
function row(component){ return new ActionRowBuilder().addComponents(component); }
function input(id,label,style,required,placeholder){ const x=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required); if(placeholder)x.setPlaceholder(placeholder); return x; }
