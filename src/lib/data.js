import { db } from '../db.js';

export async function getTask(id) {
  const [rows] = await db.query('SELECT * FROM tasks WHERE id=? LIMIT 1',[id]);
  return rows[0] || null;
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
