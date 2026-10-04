import { EmbedBuilder } from 'discord.js';
import { dashboardPayload, taskControlPayload, bugControlPayload, voteControlPayload, createTaskModal, createBugModal, createVoteModal, manageTaskModal, manageBugModal, votePickModal, progressModal, noteModal, editTaskModal, deleteTaskModal, statusMenu, assigneeMenu } from './lib/dashboard.js';
import { db } from './db.js';
import { config } from './config.js';
import { requireTeamPermission } from './lib/auth.js';
import { parseDeadline } from './lib/time.js';
import { getTask, getBug, getVote, voteCounts, addTaskHistory, addBugHistory, setTaskAssignees, addTaskAssignee } from './lib/data.js';
import { postTask, refreshTask, postBug, refreshBug, postVote, refreshVote, refreshPublicDashboard } from './lib/messages.js';
import { taskEmbed, bugEmbed, voteEmbed } from './lib/render.js';

const statusLabels = {pending:'Chờ làm',doing:'Đang làm',testing:'Đang test',revise:'Cần chỉnh sửa',blocked:'Bị block',done:'Hoàn thành',cancelled:'Đã hủy'};

async function reply(interaction, content, ephemeral=true) {
  const payload = typeof content === 'string' ? {content, ephemeral} : {...content, ephemeral};
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function ensureTask(interaction, id) {
  const task = await getTask(id);
  if (!task) await reply(interaction, `❌ Không tìm thấy công việc ID **${id}**.`);
  return task;
}
async function ensureBug(interaction, id) {
  const bug = await getBug(id);
  if (!bug) await reply(interaction, `❌ Không tìm thấy lỗi ID **${id}**.`);
  return bug;
}

export async function handleCommand(interaction, client) {
  if (!await requireTeamPermission(interaction)) return;
  const name = interaction.commandName;

  if (name === 'taoviec') {
    await interaction.deferReply({ephemeral:true});
    const title = interaction.options.getString('ten',true);
    const description = interaction.options.getString('mota',true);
    const assignee = interaction.options.getUser('nguoi');
    const deadlineRaw = interaction.options.getString('deadline');
    const deadline = deadlineRaw ? parseDeadline(deadlineRaw) : null;
    if (deadlineRaw && !deadline) return reply(interaction,'❌ Deadline không hợp lệ. Dùng dạng `10/10/2026 23:59`.');
    const priority = interaction.options.getString('douutien') || 'normal';
    const category = interaction.options.getString('loai') || 'source';
    const [res] = await db.query('INSERT INTO tasks(title,description,category,priority,assignee_id,creator_id,deadline) VALUES(?,?,?,?,?,?,?)',[
      title,description,category,priority,assignee?.id || null,interaction.user.id,deadline
    ]);
    const id = res.insertId, code = `VNS-${String(id).padStart(4,'0')}`;
    await db.query('UPDATE tasks SET code=? WHERE id=?',[code,id]);
    if (assignee) await setTaskAssignees(id,[assignee.id]);
    await addTaskHistory(id,interaction.user.id,'Tạo công việc',assignee ? `Phân công cho ${assignee.tag}` : 'Chưa phân công');
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`✅ Đã tạo **${code}** và đăng lên tracker.`);
  }

  if (name === 'suaviec') {
    await interaction.deferReply({ephemeral:true});
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    const sets=[], vals=[], changes=[];
    const title=interaction.options.getString('ten'); if(title){sets.push('title=?');vals.push(title);changes.push('đổi tên');}
    const description=interaction.options.getString('mota'); if(description){sets.push('description=?');vals.push(description);changes.push('đổi mô tả');}
    const priority=interaction.options.getString('douutien'); if(priority){sets.push('priority=?');vals.push(priority);changes.push('đổi ưu tiên');}
    const deadlineRaw=interaction.options.getString('deadline'); if(deadlineRaw){const d=parseDeadline(deadlineRaw); if(!d)return reply(interaction,'❌ Deadline không hợp lệ.');sets.push('deadline=?');vals.push(d);changes.push('đổi deadline');}
    if(!sets.length)return reply(interaction,'⚠️ Bạn chưa nhập nội dung cần sửa.');
    vals.push(id); await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id=?`,vals);
    await addTaskHistory(id,interaction.user.id,'Sửa công việc',changes.join(', ')); await refreshTask(client,id);
    return reply(interaction,`✅ Đã cập nhật **${task.code}**.`);
  }

  if (name === 'xoaviec') {
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    await db.query('DELETE FROM tasks WHERE id=?',[id]);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🗑️ Đã xóa **${task.code}**.`);
  }

  if (name === 'phancong') {
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    const users=['nguoi','nguoi2','nguoi3','nguoi4','nguoi5'].map(k=>interaction.options.getUser(k)).filter(Boolean);
    const unique=[...new Map(users.map(u=>[u.id,u])).values()];
    const ids=unique.map(u=>u.id);
    await setTaskAssignees(id,ids);
    await db.query("UPDATE tasks SET status=IF(status='pending','doing',status) WHERE id=?",[id]);
    const mentions=ids.map(x=>`<@${x}>`).join(', ');
    await addTaskHistory(id,interaction.user.id,'Phân công',`Giao cho ${mentions}`); await refreshTask(client,id);
    return reply(interaction,`✅ **${task.code}** đã giao cho ${mentions}.`);
  }

  if (name === 'tiendo') {
    const id=interaction.options.getInteger('id',true), p=interaction.options.getInteger('phantram',true); const task=await ensureTask(interaction,id); if(!task)return;
    const status=p===100?'done':(task.status==='pending'?'doing':task.status);
    await db.query('UPDATE tasks SET progress=?, status=? WHERE id=?',[p,status,id]);
    await addTaskHistory(id,interaction.user.id,'Cập nhật tiến độ',`${task.progress}% → ${p}%`); await refreshTask(client,id);
    return reply(interaction,`📊 **${task.code}** hiện **${p}%**.`);
  }

  if (name === 'trangthai' || name === 'hoanthanh') {
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    const st=name==='hoanthanh'?'done':interaction.options.getString('trangthai',true); const progress=st==='done'?100:task.progress;
    await db.query('UPDATE tasks SET status=?,progress=? WHERE id=?',[st,progress,id]);
    await addTaskHistory(id,interaction.user.id,'Đổi trạng thái',`${statusLabels[task.status]} → ${statusLabels[st]}`); await refreshTask(client,id);
    return reply(interaction, st==='done' ? `${config.emojis.complete} **${task.code}** đã hoàn thành.` : `✅ **${task.code}** → **${statusLabels[st]}**.`);
  }

  if (name === 'thongtin') {
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    return reply(interaction,{embeds:[taskEmbed(task)]});
  }

  if (name === 'lichsu') {
    const id=interaction.options.getInteger('id',true); const task=await ensureTask(interaction,id); if(!task)return;
    const [rows]=await db.query('SELECT * FROM task_history WHERE task_id=? ORDER BY id DESC LIMIT 15',[id]);
    const text=rows.length?rows.map(r=>`• <@${r.actor_id}> — **${r.action}**${r.details?` — ${r.details}`:''}`).join('\n'):'Chưa có lịch sử.';
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle(`Lịch sử ${task.code}`).setDescription(text).setFooter({text:'15 thay đổi gần nhất'})]});
  }

  if (name === 'danhsach') {
    const st=interaction.options.getString('trangthai');
    const base=`SELECT t.*, (SELECT GROUP_CONCAT(ta.user_id ORDER BY ta.assigned_at ASC SEPARATOR ',') FROM task_assignees ta WHERE ta.task_id=t.id) AS assignee_ids_csv FROM tasks t`;
    const [rows]=st?await db.query(`${base} WHERE t.status=? ORDER BY t.id DESC LIMIT 30`,[st]):await db.query(`${base} ORDER BY t.id DESC LIMIT 30`);
    const text=rows.length?rows.map(t=>{const ids=String(t.assignee_ids_csv||t.assignee_id||'').split(',').filter(Boolean); return `**${t.code}** • ${t.title} • ${statusLabels[t.status]} • ${t.progress}%${ids.length?` • ${ids.map(x=>`<@${x}>`).join(', ')}`:''}`}).join('\n'):'Không có công việc.';
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('Danh sách công việc').setDescription(text)]});
  }

  if (name === 'baoloi') {
    await interaction.deferReply({ephemeral:true});
    const title=interaction.options.getString('ten',true), description=interaction.options.getString('mota',true), severity=interaction.options.getString('mucdo')||'normal', related=interaction.options.getInteger('congviec');
    if(related && !await getTask(related)) return reply(interaction,'❌ Công việc liên quan không tồn tại.');
    const [res]=await db.query('INSERT INTO bugs(title,description,severity,reporter_id,related_task_id) VALUES(?,?,?,?,?)',[title,description,severity,interaction.user.id,related||null]);
    const id=res.insertId, code=`BUG-${String(id).padStart(4,'0')}`; await db.query('UPDATE bugs SET code=? WHERE id=?',[code,id]);
    await addBugHistory(id,interaction.user.id,'Báo lỗi',description);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🐞 Đã tạo **${code}** trong tracker.`);
  }

  if (['nhanloi','dasualoi','molailoi'].includes(name)) {
    const id=interaction.options.getInteger('id',true), bug=await ensureBug(interaction,id); if(!bug)return;
    if(name==='nhanloi'){await db.query("UPDATE bugs SET assignee_id=?, status='fixing' WHERE id=?",[interaction.user.id,id]); await addBugHistory(id,interaction.user.id,'Nhận sửa','');}
    if(name==='dasualoi'){await db.query("UPDATE bugs SET status='fixed' WHERE id=?",[id]); await addBugHistory(id,interaction.user.id,'Đã sửa','');}
    if(name==='molailoi'){await db.query("UPDATE bugs SET status='reopened' WHERE id=?",[id]); await addBugHistory(id,interaction.user.id,'Mở lại lỗi','');}
    await refreshBug(client,id); return reply(interaction,`✅ Đã cập nhật **${bug.code}**.`);
  }

  if (name === 'taobinhchon') {
    await interaction.deferReply({ephemeral:true});
    const title=interaction.options.getString('tieude',true), description=interaction.options.getString('mota',true), hours=interaction.options.getInteger('sogio')||24;
    const [res]=await db.query('INSERT INTO votes(title,description,creator_id,closes_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',[title,description,interaction.user.id,hours]);
    const id=res.insertId, code=`VOTE-${String(id).padStart(4,'0')}`; await db.query('UPDATE votes SET code=? WHERE id=?',[code,id]);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🗳️ Đã tạo **${code}** trong kênh tracker.`);
  }

  if (name === 'dongbinhchon') {
    const id=interaction.options.getInteger('id',true), vote=await getVote(id); if(!vote)return reply(interaction,'❌ Không tìm thấy bình chọn.');
    await db.query("UPDATE votes SET status='closed' WHERE id=?",[id]); await refreshVote(client,id); const c=await voteCounts(id);
    return reply(interaction,`🔒 **${vote.code}** đã đóng — Đồng ý **${c.yes}**, Không đồng ý **${c.no}**.`);
  }

  if (name === 'danhsachbinhchon') {
    const [rows]=await db.query('SELECT * FROM votes ORDER BY id DESC LIMIT 20');
    const lines=[]; for(const v of rows){const c=await voteCounts(v.id); lines.push(`**${v.code}** • ${v.title} • ${v.status==='open'?'Đang mở':'Đã đóng'} • ✅ ${c.yes} / ❌ ${c.no}`)}
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('Danh sách bình chọn').setDescription(lines.join('\n')||'Chưa có bình chọn.')]});
  }

  if (name === 'bangtheodoi') {
    await interaction.deferReply({ephemeral:true});
    await refreshPublicDashboard(client);
    return reply(interaction,'✅ Đã cập nhật **Bảng Theo Dõi Team** công khai trong kênh tracker.');
  }

  if (name === 'deadline') {
    const [rows]=await db.query("SELECT t.*, (SELECT GROUP_CONCAT(ta.user_id ORDER BY ta.assigned_at ASC SEPARATOR ',') FROM task_assignees ta WHERE ta.task_id=t.id) AS assignee_ids_csv FROM tasks t WHERE deadline IS NOT NULL AND status NOT IN ('done','cancelled') ORDER BY deadline ASC LIMIT 20");
    const text=rows.length?rows.map(t=>{const ids=String(t.assignee_ids_csv||t.assignee_id||'').split(',').filter(Boolean); return `**${t.code}** • ${t.title} • <t:${Math.floor(new Date(t.deadline).getTime()/1000)}:R>${ids.length?` • ${ids.map(x=>`<@${x}>`).join(', ')}`:''}`}).join('\n'):'Không có deadline đang mở.';
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('Deadline sắp tới').setDescription(text)]});
  }

  if (name === 'thanhvien') {
    const user=interaction.options.getUser('nguoi',true); const [rows]=await db.query('SELECT t.status,COUNT(DISTINCT t.id) c FROM tasks t JOIN task_assignees ta ON ta.task_id=t.id WHERE ta.user_id=? GROUP BY t.status',[user.id]); const m=Object.fromEntries(rows.map(r=>[r.status,Number(r.c)]));
    const [bugs]=await db.query("SELECT COUNT(*) c FROM bugs WHERE assignee_id=? AND status<>'fixed'",[user.id]);
    const desc=`🔵 Đang làm: **${m.doing||0}**\n🟣 Đang test: **${m.testing||0}**\n🔴 Bị block: **${m.blocked||0}**\n✅ Hoàn thành: **${m.done||0}**\n🐞 Bug đang xử lý: **${bugs[0].c}**`;
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle(`Thống kê • ${user.username}`).setDescription(desc).setThumbnail(user.displayAvatarURL())]});
  }

  if (name === 'capnhat') {
    const id=interaction.options.getInteger('id',true), note=interaction.options.getString('noidung',true), task=await ensureTask(interaction,id); if(!task)return;
    await addTaskHistory(id,interaction.user.id,'Ghi chú cập nhật',note); await refreshTask(client,id);
    return reply(interaction,`📝 Đã thêm cập nhật cho **${task.code}**.`);
  }
}

export async function handleButton(interaction, client) {
  if (!await requireTeamPermission(interaction)) return;

  if (interaction.customId === 'dash_create_task') return interaction.showModal(createTaskModal());
  if (interaction.customId === 'dash_create_bug') return interaction.showModal(createBugModal());
  if (interaction.customId === 'dash_create_vote') return interaction.showModal(createVoteModal());
  if (interaction.customId === 'dash_manage_task') return interaction.showModal(manageTaskModal());
  if (interaction.customId === 'dash_manage_bug') return interaction.showModal(manageBugModal());
  if (interaction.customId === 'dash_vote') return interaction.showModal(votePickModal());
  if (interaction.customId === 'dash_refresh') return interaction.update(await dashboardPayload());

  const [action,idRaw,arg]=interaction.customId.split(':'); const id=Number(idRaw);

  if (action === 'dash_assign') return interaction.reply({...assigneeMenu(id), ephemeral:true});
  if (action === 'dash_progress') { const task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.'); return interaction.showModal(progressModal(id,task.progress)); }
  if (action === 'dash_status') return interaction.reply({...statusMenu(id), ephemeral:true});
  if (action === 'dash_note') return interaction.showModal(noteModal(id));
  if (action === 'dash_edit') { const task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.'); return interaction.showModal(editTaskModal(task)); }
  if (action === 'dash_delete') return interaction.showModal(deleteTaskModal(id));
  if (action === 'dash_done') {
    const task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    await db.query("UPDATE tasks SET status='done',progress=100 WHERE id=?",[id]);
    await addTaskHistory(id,interaction.user.id,'Hoàn thành','100%');
    await refreshTask(client,id);
    return reply(interaction,`${config.emojis.complete} **${task.code}** đã hoàn thành.`);
  }
  if(action.startsWith('task_')){
    const task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không còn tồn tại.');
    if(action==='task_take'){await addTaskAssignee(id,interaction.user.id); await db.query("UPDATE tasks SET status=IF(status='pending','doing',status) WHERE id=?",[id]); await addTaskHistory(id,interaction.user.id,'Nhận việc',`Thêm <@${interaction.user.id}> vào người đảm nhận`);}
    if(action==='task_progress'){const p=Math.min(100,Number(task.progress)+Number(arg||25)); await db.query("UPDATE tasks SET progress=?,status=IF(?=100,'done',IF(status='pending','doing',status)) WHERE id=?",[p,p,id]); await addTaskHistory(id,interaction.user.id,'Cập nhật tiến độ',`${task.progress}% → ${p}%`);}
    if(action==='task_testing'){await db.query("UPDATE tasks SET status='testing' WHERE id=?",[id]); await addTaskHistory(id,interaction.user.id,'Đổi trạng thái','Đang test');}
    if(action==='task_done'){await db.query("UPDATE tasks SET status='done',progress=100 WHERE id=?",[id]); await addTaskHistory(id,interaction.user.id,'Hoàn thành','100%');}
    await refreshTask(client,id); return reply(interaction,'✅ Đã cập nhật tracker.');
  }
  if(action.startsWith('bug_')){
    const bug=await getBug(id); if(!bug)return reply(interaction,'❌ Lỗi không còn tồn tại.');
    if(action==='bug_take'){await db.query("UPDATE bugs SET assignee_id=?,status='fixing' WHERE id=?",[interaction.user.id,id]); await addBugHistory(id,interaction.user.id,'Nhận sửa','');}
    if(action==='bug_fixed'){await db.query("UPDATE bugs SET status='fixed' WHERE id=?",[id]); await addBugHistory(id,interaction.user.id,'Đã sửa','');}
    if(action==='bug_reopen'){await db.query("UPDATE bugs SET status='reopened' WHERE id=?",[id]); await addBugHistory(id,interaction.user.id,'Mở lại','');}
    await refreshBug(client,id); return reply(interaction,'✅ Đã cập nhật bug tracker.');
  }
  if(action==='vote_yes' || action==='vote_no'){
    const vote=await getVote(id); if(!vote || vote.status!=='open')return reply(interaction,'🔒 Bình chọn đã đóng.');
    if(vote.closes_at && new Date(vote.closes_at) <= new Date()){await db.query("UPDATE votes SET status='closed' WHERE id=?",[id]); await refreshVote(client,id); return reply(interaction,'🔒 Bình chọn đã hết hạn.');}
    const choice=action==='vote_yes'?'yes':'no';
    await db.query('INSERT INTO vote_choices(vote_id,user_id,choice) VALUES(?,?,?) ON DUPLICATE KEY UPDATE choice=VALUES(choice)',[id,interaction.user.id,choice]);
    await refreshVote(client,id); return reply(interaction,choice==='yes'?`${config.emojis.yes} Đã ghi nhận **Đồng ý**.`:`${config.emojis.no} Đã ghi nhận **Không đồng ý**.`);
  }
}


export async function handleSelect(interaction, client) {
  if (!await requireTeamPermission(interaction)) return;
  const [action,idRaw] = interaction.customId.split(':');

  if (interaction.customId === 'dash_select_task') {
    const id = Number(interaction.values[0]);
    const task = await getTask(id);
    if (!task) return reply(interaction,'❌ Công việc không còn tồn tại.');
    return interaction.reply({...taskControlPayload(task), ephemeral:true});
  }

  if (action === 'dash_status_select') {
    const id = Number(idRaw), task = await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const st = interaction.values[0];
    const progress = st === 'done' ? 100 : task.progress;
    await db.query('UPDATE tasks SET status=?,progress=? WHERE id=?',[st,progress,id]);
    await addTaskHistory(id,interaction.user.id,'Đổi trạng thái',`${statusLabels[task.status]} → ${statusLabels[st]}`);
    await refreshTask(client,id);
    return reply(interaction,`✅ **${task.code}** → **${statusLabels[st]}**.`);
  }

  if (action === 'dash_assign_select') {
    const id = Number(idRaw), task = await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const userIds = [...new Set(interaction.values.map(String))].slice(0,10);
    await setTaskAssignees(id,userIds);
    await db.query("UPDATE tasks SET status=IF(status='pending','doing',status) WHERE id=?",[id]);
    const mentions=userIds.map(userId=>`<@${userId}>`).join(', ');
    await addTaskHistory(id,interaction.user.id,'Phân công',`Giao cho ${mentions}`);
    await refreshTask(client,id);
    return reply(interaction,`✅ **${task.code}** đã giao cho ${mentions}.`);
  }
}

export async function handleModal(interaction, client) {
  if (!await requireTeamPermission(interaction)) return;
  const [action,idRaw] = interaction.customId.split(':');

  if (action === 'modal_create_task') {
    await interaction.deferReply({ephemeral:true});
    const title = interaction.fields.getTextInputValue('task_title').trim();
    const description = interaction.fields.getTextInputValue('task_desc').trim();
    const deadlineRaw = interaction.fields.getTextInputValue('task_deadline').trim();
    const priorityRaw = interaction.fields.getTextInputValue('task_priority').trim().toLowerCase();
    const categoryRaw = interaction.fields.getTextInputValue('task_category').trim().toLowerCase();
    const deadline = deadlineRaw ? parseDeadline(deadlineRaw) : null;
    if (deadlineRaw && !deadline) return reply(interaction,'❌ Deadline không hợp lệ. Dùng `10/10/2026 23:59`.');
    const priority = ['low','normal','high','urgent'].includes(priorityRaw) ? priorityRaw : 'normal';
    const category = categoryRaw || 'source';
    const [res] = await db.query('INSERT INTO tasks(title,description,category,priority,assignee_id,creator_id,deadline) VALUES(?,?,?,?,?,?,?)',[title,description,category,priority,null,interaction.user.id,deadline]);
    const id = res.insertId, code=`VNS-${String(id).padStart(4,'0')}`;
    await db.query('UPDATE tasks SET code=? WHERE id=?',[code,id]);
    await addTaskHistory(id,interaction.user.id,'Tạo công việc','Chưa phân công');
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`✅ Đã tạo **${code}** và đăng lên tracker.`);
  }

  if (action === 'modal_create_bug') {
    await interaction.deferReply({ephemeral:true});
    const title=interaction.fields.getTextInputValue('bug_title').trim();
    const description=interaction.fields.getTextInputValue('bug_desc').trim();
    const severityRaw=interaction.fields.getTextInputValue('bug_severity').trim().toLowerCase();
    const relatedRaw=interaction.fields.getTextInputValue('bug_task').trim();
    const severity=['minor','normal','major','critical'].includes(severityRaw)?severityRaw:'normal';
    const related=relatedRaw ? Number((relatedRaw.match(/(\d+)/)||[])[1]) : null;
    if(related && !await getTask(related)) return reply(interaction,'❌ Task liên quan không tồn tại.');
    const [res]=await db.query('INSERT INTO bugs(title,description,severity,reporter_id,related_task_id) VALUES(?,?,?,?,?)',[title,description,severity,interaction.user.id,related||null]);
    const id=res.insertId, code=`BUG-${String(id).padStart(4,'0')}`; await db.query('UPDATE bugs SET code=? WHERE id=?',[code,id]);
    await addBugHistory(id,interaction.user.id,'Báo lỗi',description);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🐞 Đã tạo **${code}** trong tracker.`);
  }

  if (action === 'modal_create_vote') {
    await interaction.deferReply({ephemeral:true});
    const title=interaction.fields.getTextInputValue('vote_title').trim();
    const description=interaction.fields.getTextInputValue('vote_desc').trim();
    const hoursRaw=interaction.fields.getTextInputValue('vote_hours').trim();
    let hours=Number(hoursRaw||24); if(!Number.isFinite(hours)||hours<1)hours=24; hours=Math.min(168,Math.round(hours));
    const [res]=await db.query('INSERT INTO votes(title,description,creator_id,closes_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',[title,description,interaction.user.id,hours]);
    const id=res.insertId, code=`VOTE-${String(id).padStart(4,'0')}`; await db.query('UPDATE votes SET code=? WHERE id=?',[code,id]);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🗳️ Đã tạo **${code}** trong tracker.`);
  }

  if (action === 'modal_manage_task') {
    const raw=interaction.fields.getTextInputValue('manage_task_id').trim();
    const id=Number((raw.match(/(\d+)/)||[])[1]);
    const task=id?await getTask(id):null;
    if(!task)return reply(interaction,'❌ Không tìm thấy công việc. Ví dụ ID hợp lệ: `VNS-0007`.');
    return interaction.reply({...taskControlPayload(task),ephemeral:true});
  }

  if (action === 'modal_manage_bug') {
    const raw=interaction.fields.getTextInputValue('manage_bug_id').trim();
    const id=Number((raw.match(/(\d+)/)||[])[1]);
    const bug=id?await getBug(id):null;
    if(!bug)return reply(interaction,'❌ Không tìm thấy lỗi. Ví dụ ID hợp lệ: `BUG-0003`.');
    return interaction.reply({...bugControlPayload(bug),ephemeral:true});
  }

  if (action === 'modal_pick_vote') {
    const raw=interaction.fields.getTextInputValue('pick_vote_id').trim();
    const id=Number((raw.match(/(\d+)/)||[])[1]);
    const vote=id?await getVote(id):null;
    if(!vote)return reply(interaction,'❌ Không tìm thấy vote. Ví dụ ID hợp lệ: `VOTE-0002`.');
    if(vote.status!=='open')return reply(interaction,'🔒 Bình chọn này đã đóng.');
    const c=await voteCounts(id);
    return interaction.reply({...voteControlPayload(vote,c.yes,c.no),ephemeral:true});
  }

  if (action === 'modal_edit_task') {
    const id=Number(idRaw), task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const title=interaction.fields.getTextInputValue('edit_title').trim();
    const description=interaction.fields.getTextInputValue('edit_desc').trim();
    const deadlineRaw=interaction.fields.getTextInputValue('edit_deadline').trim();
    const priorityRaw=interaction.fields.getTextInputValue('edit_priority').trim().toLowerCase();
    let deadline=task.deadline;
    if(deadlineRaw){ deadline=parseDeadline(deadlineRaw); if(!deadline)return reply(interaction,'❌ Deadline không hợp lệ.'); }
    const priority=['low','normal','high','urgent'].includes(priorityRaw)?priorityRaw:task.priority;
    await db.query('UPDATE tasks SET title=?,description=?,deadline=?,priority=? WHERE id=?',[title,description,deadline,priority,id]);
    await addTaskHistory(id,interaction.user.id,'Sửa công việc','Cập nhật từ dashboard');
    await refreshTask(client,id);
    return reply(interaction,`✅ Đã cập nhật **${task.code}**.`);
  }

  if (action === 'modal_delete_task') {
    const id=Number(idRaw), task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const confirm=interaction.fields.getTextInputValue('delete_confirm').trim().toUpperCase();
    if(confirm!=='XOA')return reply(interaction,'❌ Đã hủy xóa vì bạn không nhập đúng `XOA`.');
    await db.query('DELETE FROM tasks WHERE id=?',[id]);
    await refreshPublicDashboard(client).catch(()=>{});
    return reply(interaction,`🗑️ Đã xóa **${task.code}**.`);
  }

  if (action === 'modal_progress') {
    const id=Number(idRaw), task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const p=Number(interaction.fields.getTextInputValue('progress_value').trim());
    if(!Number.isInteger(p)||p<0||p>100)return reply(interaction,'❌ Tiến độ phải là số nguyên từ 0 đến 100.');
    const status=p===100?'done':(task.status==='pending'?'doing':task.status);
    await db.query('UPDATE tasks SET progress=?,status=? WHERE id=?',[p,status,id]);
    await addTaskHistory(id,interaction.user.id,'Cập nhật tiến độ',`${task.progress}% → ${p}%`); await refreshTask(client,id);
    return reply(interaction,`📊 **${task.code}** hiện **${p}%**.`);
  }

  if (action === 'modal_note') {
    const id=Number(idRaw), task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không tồn tại.');
    const note=interaction.fields.getTextInputValue('note_value').trim();
    await addTaskHistory(id,interaction.user.id,'Ghi chú cập nhật',note);
    return reply(interaction,`📝 Đã thêm ghi chú cho **${task.code}**.`);
  }
}

export async function closeExpiredVotes(client){
  const [rows]=await db.query("SELECT id FROM votes WHERE status='open' AND closes_at IS NOT NULL AND closes_at<=UTC_TIMESTAMP()");
  for(const r of rows){await db.query("UPDATE votes SET status='closed' WHERE id=?",[r.id]); await refreshVote(client,r.id).catch(()=>{});}
}
