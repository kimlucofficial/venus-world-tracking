import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';
import { discordTimestamp } from './time.js';

const statusMap = {
  pending: ['📝', 'Chờ làm'],
  doing: ['🔵', 'Đang làm'],
  testing: ['🟣', 'Đang test'],
  revise: ['🟠', 'Cần chỉnh sửa'],
  blocked: ['🔴', 'Bị block'],
  done: ['✅', 'Hoàn thành'],
  cancelled: ['⚫', 'Đã hủy']
};
const priorityMap = { low: '🟢 Thấp', normal: '🟡 Vừa', high: '🟠 Cao', urgent: '🔴 Khẩn cấp' };

export function progressBar(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill = Math.round(p / 10);
  return `${'█'.repeat(fill)}${'░'.repeat(10-fill)} **${p}%**`;
}

export function taskEmbed(task) {
  const [icon, status] = statusMap[task.status] || ['❔', task.status];
  const embed = new EmbedBuilder()
    .setColor(task.status === 'done' ? 0xB56BFF : task.status === 'blocked' ? 0xED4245 : 0x9B59FF)
    .setTitle(`${task.code} • ${task.title}`)
    .setDescription(task.description || '*Không có mô tả*')
    .addFields(
      { name: 'Trạng thái', value: `${icon} **${status}**`, inline: true },
      { name: 'Ưu tiên', value: priorityMap[task.priority] || task.priority, inline: true },
      { name: 'Loại', value: `\`${task.category || 'source'}\``, inline: true },
      { name: 'Người đảm nhận', value: task.assignee_id ? `<@${task.assignee_id}>` : '*Chưa phân công*', inline: true },
      { name: 'Người tạo', value: `<@${task.creator_id}>`, inline: true },
      { name: 'Deadline', value: task.deadline ? discordTimestamp(task.deadline) : '*Không có*', inline: false },
      { name: 'Tiến độ', value: progressBar(task.progress), inline: false }
    )
    .setFooter({ text: 'Development Tracker' })
    .setTimestamp(task.updated_at ? new Date(task.updated_at) : new Date());
  if (task.status === 'done') embed.setAuthor({ name: 'CÔNG VIỆC ĐÃ HOÀN THÀNH' });
  return embed;
}

export function taskButtons(task) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`task_take:${task.id}`).setLabel('Nhận việc').setStyle(ButtonStyle.Primary).setDisabled(task.status === 'done'),
    new ButtonBuilder().setCustomId(`task_progress:${task.id}:25`).setLabel('+25%').setStyle(ButtonStyle.Secondary).setDisabled(task.status === 'done'),
    new ButtonBuilder().setCustomId(`task_testing:${task.id}`).setLabel('Đưa sang test').setStyle(ButtonStyle.Secondary).setDisabled(task.status === 'done'),
    new ButtonBuilder().setCustomId(`task_done:${task.id}`).setLabel('Hoàn thành').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(task.status === 'done')
  );
}

export function bugEmbed(bug) {
  const sev = { minor:'🟢 Minor', normal:'🟡 Normal', major:'🟠 Major', critical:'🔴 Critical' }[bug.severity] || bug.severity;
  const st = { open:'🔴 Chưa xử lý', fixing:'🟡 Đang sửa', fixed:'✅ Đã sửa', reopened:'🟠 Mở lại' }[bug.status] || bug.status;
  return new EmbedBuilder()
    .setColor(bug.status === 'fixed' ? 0x57F287 : 0xED4245)
    .setTitle(`${bug.code} • ${bug.title}`)
    .setDescription(bug.description || '*Không có mô tả*')
    .addFields(
      { name:'Trạng thái', value:st, inline:true },
      { name:'Mức độ', value:sev, inline:true },
      { name:'Người báo', value:`<@${bug.reporter_id}>`, inline:true },
      { name:'Người xử lý', value:bug.assignee_id ? `<@${bug.assignee_id}>` : '*Chưa có*', inline:true },
      { name:'Liên quan', value:bug.related_task_id ? `Task #${bug.related_task_id}` : '*Không liên kết*', inline:true }
    )
    .setFooter({ text:'Bug Tracker' })
    .setTimestamp(bug.updated_at ? new Date(bug.updated_at) : new Date());
}

export function bugButtons(bug) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bug_take:${bug.id}`).setLabel('Nhận sửa').setStyle(ButtonStyle.Primary).setDisabled(bug.status === 'fixed'),
    new ButtonBuilder().setCustomId(`bug_fixed:${bug.id}`).setLabel('Đã sửa').setStyle(ButtonStyle.Success).setDisabled(bug.status === 'fixed'),
    new ButtonBuilder().setCustomId(`bug_reopen:${bug.id}`).setLabel('Mở lại').setStyle(ButtonStyle.Danger).setDisabled(bug.status !== 'fixed')
  );
}

export function voteEmbed(vote, yesCount=0, noCount=0) {
  const total = yesCount + noCount;
  const yesPct = total ? Math.round(yesCount/total*100) : 0;
  const noPct = total ? 100-yesPct : 0;
  return new EmbedBuilder()
    .setColor(vote.status === 'open' ? 0x9B59FF : 0x5865F2)
    .setTitle(`${vote.code} • ${vote.title}`)
    .setDescription(vote.description || '*Không có mô tả*')
    .addFields(
      { name:`${config.emojis.yes} Đồng ý`, value:`**${yesCount}** (${yesPct}%)`, inline:true },
      { name:`${config.emojis.no} Không đồng ý`, value:`**${noCount}** (${noPct}%)`, inline:true },
      { name:'Trạng thái', value: vote.status === 'open' ? '🟣 Đang bình chọn' : '🔒 Đã đóng', inline:false },
      { name:'Đóng bình chọn', value: vote.closes_at ? discordTimestamp(vote.closes_at) : '*Đóng thủ công*', inline:false },
      { name:'Người tạo', value:`<@${vote.creator_id}>`, inline:true }
    )
    .setFooter({ text:'Team Vote' })
    .setTimestamp();
}

export function voteButtons(vote) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vote_yes:${vote.id}`).setLabel('Đồng ý').setStyle(ButtonStyle.Success).setDisabled(vote.status !== 'open'),
    new ButtonBuilder().setCustomId(`vote_no:${vote.id}`).setLabel('Không đồng ý').setStyle(ButtonStyle.Danger).setDisabled(vote.status !== 'open')
  );
}
