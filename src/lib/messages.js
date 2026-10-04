import { config } from '../config.js';
import { dashboardPayload } from './dashboard.js';
import { db } from '../db.js';

async function channel(client, id) {
  const ch = await client.channels.fetch(id).catch(()=>null);
  if (!ch?.isTextBased()) throw new Error(`Không tìm thấy text channel ${id}`);
  return ch;
}

// Single-board mode: tasks / bugs / votes do not create separate public messages.
export async function postTask(client) {
  return refreshPublicDashboard(client);
}
export async function refreshTask(client) {
  return refreshPublicDashboard(client);
}
export async function postBug(client) {
  return refreshPublicDashboard(client);
}
export async function refreshBug(client) {
  return refreshPublicDashboard(client);
}
export async function postVote(client) {
  return refreshPublicDashboard(client);
}
export async function refreshVote(client) {
  return refreshPublicDashboard(client);
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

// One-time/continuous cleanup for cards created by older versions.
// Keeps only the public dashboard message and clears legacy message references.
export async function cleanupLegacyPublicMessages(client) {
  const ch = await channel(client, config.trackerChannelId);
  const [settingRows] = await db.query("SELECT setting_value FROM bot_settings WHERE setting_key='public_dashboard_message_id' LIMIT 1");
  const dashboardId = settingRows[0]?.setting_value || null;

  const ids = new Set();
  const [taskRows] = await db.query("SELECT tracker_message_id id FROM tasks WHERE tracker_message_id IS NOT NULL");
  const [bugRows] = await db.query("SELECT tracker_message_id id FROM bugs WHERE tracker_message_id IS NOT NULL");
  const [voteRows] = await db.query("SELECT message_id id FROM votes WHERE message_id IS NOT NULL");
  for (const r of [...taskRows,...bugRows,...voteRows]) if (r.id && r.id !== dashboardId) ids.add(String(r.id));

  for (const id of ids) {
    const msg = await ch.messages.fetch(id).catch(()=>null);
    if (msg) await msg.delete().catch(()=>{});
  }

  await db.query('UPDATE tasks SET tracker_message_id=NULL WHERE tracker_message_id IS NOT NULL');
  await db.query('UPDATE bugs SET tracker_message_id=NULL WHERE tracker_message_id IS NOT NULL');
  await db.query('UPDATE votes SET message_id=NULL WHERE message_id IS NOT NULL');
}
