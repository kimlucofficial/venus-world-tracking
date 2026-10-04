import { config } from '../config.js';
import { taskEmbed, taskButtons, bugEmbed, bugButtons, voteEmbed, voteButtons } from './render.js';
import { dashboardPayload } from './dashboard.js';
import { db } from '../db.js';
import { getTask, getBug, getVote, voteCounts } from './data.js';

async function channel(client, id) {
  const ch = await client.channels.fetch(id).catch(()=>null);
  if (!ch?.isTextBased()) throw new Error(`Không tìm thấy text channel ${id}`);
  return ch;
}

export async function postTask(client, task) {
  const ch = await channel(client, config.trackerChannelId);
  const msg = await ch.send({ embeds:[taskEmbed(task)], components:[taskButtons(task)] });
  return msg.id;
}
export async function refreshTask(client, id) {
  const task = await getTask(id); if (!task?.tracker_message_id) return;
  const ch = await channel(client, config.trackerChannelId);
  const msg = await ch.messages.fetch(task.tracker_message_id).catch(()=>null);
  if (msg) await msg.edit({ embeds:[taskEmbed(task)], components:[taskButtons(task)] });
  await refreshPublicDashboard(client).catch(()=>{});
}
export async function postBug(client, bug) {
  const ch = await channel(client, config.trackerChannelId);
  const msg = await ch.send({ embeds:[bugEmbed(bug)], components:[bugButtons(bug)] });
  return msg.id;
}
export async function refreshBug(client, id) {
  const bug = await getBug(id); if (!bug?.tracker_message_id) return;
  const ch = await channel(client, config.trackerChannelId);
  const msg = await ch.messages.fetch(bug.tracker_message_id).catch(()=>null);
  if (msg) await msg.edit({ embeds:[bugEmbed(bug)], components:[bugButtons(bug)] });
  await refreshPublicDashboard(client).catch(()=>{});
}
export async function postVote(client, vote) {
  const ch = await channel(client, config.voteChannelId);
  const msg = await ch.send({ embeds:[voteEmbed(vote,0,0)], components:[voteButtons(vote)] });
  return msg.id;
}
export async function refreshVote(client, id) {
  const vote = await getVote(id); if (!vote?.message_id) return;
  const counts = await voteCounts(id);
  const ch = await channel(client, config.voteChannelId);
  const msg = await ch.messages.fetch(vote.message_id).catch(()=>null);
  if (msg) await msg.edit({ embeds:[voteEmbed(vote,counts.yes,counts.no)], components:[voteButtons(vote)] });
  await refreshPublicDashboard(client).catch(()=>{});
}

export async function refreshPublicDashboard(client) {
  const ch = await channel(client, config.trackerChannelId);
  const payload = await dashboardPayload();
  const [rows] = await db.query("SELECT setting_value FROM bot_settings WHERE setting_key='public_dashboard_message_id' LIMIT 1");
  const messageId = rows[0]?.setting_value || null;
  let msg = messageId ? await ch.messages.fetch(messageId).catch(()=>null) : null;
  if (msg) {
    await msg.edit(payload);
    return msg.id;
  }
  msg = await ch.send(payload);
  await db.query("INSERT INTO bot_settings(setting_key,setting_value) VALUES('public_dashboard_message_id',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[msg.id]);
  return msg.id;
}

