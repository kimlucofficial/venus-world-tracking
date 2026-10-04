import mysql from 'mysql2/promise';
import { config } from './config.js';

export const db = mysql.createPool({
  uri: config.databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(32) DEFAULT 'source',
      priority VARCHAR(16) DEFAULT 'normal',
      status VARCHAR(32) DEFAULT 'pending',
      progress INT DEFAULT 0,
      assignee_id VARCHAR(32) NULL,
      creator_id VARCHAR(32) NOT NULL,
      deadline DATETIME NULL,
      tracker_message_id VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS task_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      actor_id VARCHAR(32) NOT NULL,
      action VARCHAR(64) NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX(task_id),
      CONSTRAINT fk_history_task FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bugs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(16) DEFAULT 'normal',
      status VARCHAR(16) DEFAULT 'open',
      reporter_id VARCHAR(32) NOT NULL,
      assignee_id VARCHAR(32) NULL,
      related_task_id INT NULL,
      tracker_message_id VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX(related_task_id),
      CONSTRAINT fk_bug_task FOREIGN KEY(related_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bug_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      bug_id INT NOT NULL,
      actor_id VARCHAR(32) NOT NULL,
      action VARCHAR(64) NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX(bug_id),
      CONSTRAINT fk_bug_history FOREIGN KEY(bug_id) REFERENCES bugs(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      creator_id VARCHAR(32) NOT NULL,
      status VARCHAR(16) DEFAULT 'open',
      closes_at DATETIME NULL,
      message_id VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);


  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS vote_choices (
      vote_id INT NOT NULL,
      user_id VARCHAR(32) NOT NULL,
      choice ENUM('yes','no') NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(vote_id, user_id),
      CONSTRAINT fk_vote_choice FOREIGN KEY(vote_id) REFERENCES votes(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}
