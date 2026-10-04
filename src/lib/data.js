import { db } from '../db.js';

export async function getTask(id) {
  const [rows] = await db.query(`
    SELECT t.*,
      (SELECT GROUP_CONCAT(ta.user_id ORDER BY ta.assigned_at ASC SEPARATOR ',') FROM task_assignees ta WHERE ta.task_id=t.id) AS assignee_ids_csv
    FROM tasks t WHERE t.id=? LIMIT 1
  `,[id]);
  const task = rows[0] || null;
  if (task) task.assignee_ids = parseAssigneeIds(task.assignee_ids_csv, task.assignee_id);
  return task;
}

export function parseAssigneeIds(csv, legacyAssigneeId=null) {
  const ids = String(csv || '').split(',').map(x=>x.trim()).filter(Boolean);
  if (!ids.length && legacyAssigneeId) ids.push(String(legacyAssigneeId));
  return [...new Set(ids)];
}

export async function getTaskAssignees(taskId) {
  const [rows] = await db.query('SELECT user_id FROM task_assignees WHERE task_id=? ORDER BY assigned_at ASC',[taskId]);
  if (rows.length) return rows.map(r=>String(r.user_id));
  const [legacy] = await db.query('SELECT assignee_id FROM tasks WHERE id=? LIMIT 1',[taskId]);
  return legacy[0]?.assignee_id ? [String(legacy[0].assignee_id)] : [];
}

export async function setTaskAssignees(taskId, userIds=[]) {
  const ids = [...new Set(userIds.map(String).filter(Boolean))].slice(0,10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM task_assignees WHERE task_id=?',[taskId]);
    for (const userId of ids) await conn.query('INSERT INTO task_assignees(task_id,user_id) VALUES(?,?)',[taskId,userId]);
    await conn.query('UPDATE tasks SET assignee_id=? WHERE id=?',[ids[0] || null,taskId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return ids;
}

export async function addTaskAssignee(taskId, userId) {
  const id = String(userId);
  await db.query('INSERT IGNORE INTO task_assignees(task_id,user_id) VALUES(?,?)',[taskId,id]);
  await db.query('UPDATE tasks SET assignee_id=COALESCE(assignee_id,?) WHERE id=?',[id,taskId]);
  return getTaskAssignees(taskId);
}
export async function getBug(id) {
  const [rows] = await db.query('SELECT * FROM bugs WHERE id=? LIMIT 1',[id]);
  return rows[0] || null;
}
export async function getVote(id) {
  const [rows] = await db.query('SELECT * FROM votes WHERE id=? LIMIT 1',[id]);
  return rows[0] || null;
}
export async function voteCounts(id) {
  const [rows] = await db.query("SELECT choice, COUNT(*) total FROM vote_choices WHERE vote_id=? GROUP BY choice",[id]);
  return {
    yes: Number(rows.find(r=>r.choice==='yes')?.total || 0),
    no: Number(rows.find(r=>r.choice==='no')?.total || 0)
  };
}
export async function addTaskHistory(taskId, actorId, action, details='') {
  await db.query('INSERT INTO task_history(task_id,actor_id,action,details) VALUES(?,?,?,?)',[taskId,actorId,action,details]);
}
export async function addBugHistory(bugId, actorId, action, details='') {
  await db.query('INSERT INTO bug_history(bug_id,actor_id,action,details) VALUES(?,?,?,?)',[bugId,actorId,action,details]);
}
