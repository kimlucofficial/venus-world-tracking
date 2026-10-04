import { EmbedBuilder } from 'discord.js';
import { db } from './db.js';
import { config } from './config.js';
import { requireTeamPermission } from './lib/auth.js';
import { parseDeadline } from './lib/time.js';
import { getTask, getBug, getVote, voteCounts, addTaskHistory, addBugHistory } from './lib/data.js';
import { postTask, refreshTask, postBug, refreshBug, postVote, refreshVote } from './lib/messages.js';
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
    await addTaskHistory(id,interaction.user.id,'Tạo công việc',assignee ? `Phân công cho ${assignee.tag}` : 'Chưa phân công');
    const task = await getTask(id);
    const messageId = await postTask(client,task);
    await db.query('UPDATE tasks SET tracker_message_id=? WHERE id=?',[messageId,id]);
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
    if(task.tracker_message_id){const ch=await client.channels.fetch(config.trackerChannelId).catch(()=>null); const msg=await ch?.messages.fetch(task.tracker_message_id).catch(()=>null); await msg?.delete().catch(()=>{});}
    await db.query('DELETE FROM tasks WHERE id=?',[id]);
    return reply(interaction,`🗑️ Đã xóa **${task.code}**.`);
  }

  if (name === 'phancong') {
    const id=interaction.options.getInteger('id',true), user=interaction.options.getUser('nguoi',true); const task=await ensureTask(interaction,id); if(!task)return;
    await db.query("UPDATE tasks SET assignee_id=?, status=IF(status='pending','doing',status) WHERE id=?",[user.id,id]);
    await addTaskHistory(id,interaction.user.id,'Phân công',`Giao cho ${user.tag}`); await refreshTask(client,id);
    return reply(interaction,`✅ **${task.code}** đã giao cho ${user}.`);
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
    const [rows]=st?await db.query('SELECT * FROM tasks WHERE status=? ORDER BY id DESC LIMIT 30',[st]):await db.query('SELECT * FROM tasks ORDER BY id DESC LIMIT 30');
    const text=rows.length?rows.map(t=>`**${t.code}** • ${t.title} • ${statusLabels[t.status]} • ${t.progress}%${t.assignee_id?` • <@${t.assignee_id}>`:''}`).join('\n'):'Không có công việc.';
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('Danh sách công việc').setDescription(text)]});
  }

  if (name === 'baoloi') {
    await interaction.deferReply({ephemeral:true});
    const title=interaction.options.getString('ten',true), description=interaction.options.getString('mota',true), severity=interaction.options.getString('mucdo')||'normal', related=interaction.options.getInteger('congviec');
    if(related && !await getTask(related)) return reply(interaction,'❌ Công việc liên quan không tồn tại.');
    const [res]=await db.query('INSERT INTO bugs(title,description,severity,reporter_id,related_task_id) VALUES(?,?,?,?,?)',[title,description,severity,interaction.user.id,related||null]);
    const id=res.insertId, code=`BUG-${String(id).padStart(4,'0')}`; await db.query('UPDATE bugs SET code=? WHERE id=?',[code,id]);
    await addBugHistory(id,interaction.user.id,'Báo lỗi',description); const bug=await getBug(id); const mid=await postBug(client,bug); await db.query('UPDATE bugs SET tracker_message_id=? WHERE id=?',[mid,id]);
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
    const vote=await getVote(id); const mid=await postVote(client,vote); await db.query('UPDATE votes SET message_id=? WHERE id=?',[mid,id]);
    return reply(interaction,`🗳️ Đã tạo **${code}** trong kênh vote.`);
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
    const [taskRows]=await db.query('SELECT status,COUNT(*) c FROM tasks GROUP BY status'); const [bugs]=await db.query("SELECT COUNT(*) c FROM bugs WHERE status<>'fixed'");
    const map=Object.fromEntries(taskRows.map(r=>[r.status,Number(r.c)])); const total=Object.values(map).reduce((a,b)=>a+b,0), done=map.done||0, pct=total?Math.round(done/total*100):0;
    const text=`📝 Chờ làm: **${map.pending||0}**\n🔵 Đang làm: **${map.doing||0}**\n🟣 Đang test: **${map.testing||0}**\n🟠 Cần chỉnh: **${map.revise||0}**\n🔴 Bị block: **${map.blocked||0}**\n✅ Hoàn thành: **${done}**\n🐞 Bug chưa đóng: **${bugs[0].c}**\n\n**Tổng tiến độ:** ${pct}%`;
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('VENUS WORLD • DEVELOPMENT TRACKER').setDescription(text)]},false);
  }

  if (name === 'deadline') {
    const [rows]=await db.query("SELECT * FROM tasks WHERE deadline IS NOT NULL AND status NOT IN ('done','cancelled') ORDER BY deadline ASC LIMIT 20");
    const text=rows.length?rows.map(t=>`**${t.code}** • ${t.title} • <t:${Math.floor(new Date(t.deadline).getTime()/1000)}:R>${t.assignee_id?` • <@${t.assignee_id}>`:''}`).join('\n'):'Không có deadline đang mở.';
    return reply(interaction,{embeds:[new EmbedBuilder().setColor(0x9B59FF).setTitle('Deadline sắp tới').setDescription(text)]});
  }

  if (name === 'thanhvien') {
    const user=interaction.options.getUser('nguoi',true); const [rows]=await db.query('SELECT status,COUNT(*) c FROM tasks WHERE assignee_id=? GROUP BY status',[user.id]); const m=Object.fromEntries(rows.map(r=>[r.status,Number(r.c)]));
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
  const [action,idRaw,arg]=interaction.customId.split(':'); const id=Number(idRaw);
  if(action.startsWith('task_')){
    const task=await getTask(id); if(!task)return reply(interaction,'❌ Công việc không còn tồn tại.');
    if(action==='task_take'){await db.query("UPDATE tasks SET assignee_id=?,status=IF(status='pending','doing',status) WHERE id=?",[interaction.user.id,id]); await addTaskHistory(id,interaction.user.id,'Nhận việc','');}
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

export async function closeExpiredVotes(client){
  const [rows]=await db.query("SELECT id FROM votes WHERE status='open' AND closes_at IS NOT NULL AND closes_at<=UTC_TIMESTAMP()");
  for(const r of rows){await db.query("UPDATE votes SET status='closed' WHERE id=?",[r.id]); await refreshVote(client,r.id).catch(()=>{});}
}
