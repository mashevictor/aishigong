import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;
let mockMode = false;

const mockProjects = [
  {
    id: 1,
    code: "PRJ-DEMO-001",
    name: "样板工程 · 滨江精装",
    client_name: "演示客户 A",
    status: "进行中",
    progress_pct: 62,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  },
  {
    id: 2,
    code: "PRJ-DEMO-002",
    name: "办公楼改造试点",
    client_name: "演示总包 B",
    status: "待验收",
    progress_pct: 94,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  },
];

const mockTasks = [
  {
    id: 101,
    project_id: 1,
    title: "卫生间防水复检",
    assignee_role: "施工经理",
    status: "待验收",
    priority: "P0",
    due_date: "2026-05-08",
  },
  {
    id: 102,
    project_id: 1,
    title: "木工收口节点拍照上传",
    assignee_role: "工人",
    status: "进行中",
    priority: "P1",
    due_date: "2026-05-06",
  },
  {
    id: 103,
    project_id: 2,
    title: "幕墙色差 AI 比对",
    assignee_role: "管理员",
    status: "整改中",
    priority: "P0",
    due_date: "2026-05-10",
  },
];

export function isMockDb() {
  return mockMode;
}

export async function initDb(env) {
  const host = env.MYSQL_HOST || "";
  const user = env.MYSQL_USER || "";
  const password = env.MYSQL_PASSWORD ?? "";
  const database = env.MYSQL_DATABASE || "";

  if (!host || !user || !database) {
    mockMode = true;
    console.warn("[db] 未配置 MYSQL_*，使用内存模拟数据。");
    return;
  }

  try {
    pool = mysql.createPool({
      host,
      port: Number(env.MYSQL_PORT || 3306),
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
    });
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        client_name VARCHAR(255) DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT '进行中',
        progress_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        title VARCHAR(512) NOT NULL,
        assignee_role VARCHAR(64) DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT '待派发',
        priority VARCHAR(16) DEFAULT 'P1',
        due_date DATE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ai_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        kind ENUM('chat','image') NOT NULL,
        prompt TEXT NOT NULL,
        result_summary VARCHAR(512) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await conn.query("SELECT COUNT(*) AS c FROM projects");
    if (rows[0].c === 0) {
      await seedDemo(conn);
    }
    conn.release();
    mockMode = false;
    console.log("[db] MySQL 已连接并初始化表结构。");
  } catch (e) {
    mockMode = true;
    pool = null;
    console.warn("[db] MySQL 连接失败，改用模拟数据：", e.message);
  }
}

async function seedDemo(conn) {
  await conn.query(
    `INSERT INTO projects (code, name, client_name, status, progress_pct) VALUES
     ('PRJ-DEMO-001', '样板工程 · 滨江精装', '演示客户 A', '进行中', 62),
     ('PRJ-DEMO-002', '办公楼改造试点', '演示总包 B', '待验收', 94)`
  );
  await conn.query(
    `INSERT INTO tasks (project_id, title, assignee_role, status, priority, due_date) VALUES
     (1, '卫生间防水复检', '施工经理', '待验收', 'P0', '2026-05-08'),
     (1, '木工收口节点拍照上传', '工人', '进行中', 'P1', '2026-05-06'),
     (2, '幕墙色差 AI 比对', '管理员', '整改中', 'P0', '2026-05-10')`
  );
}

export async function listProjects() {
  if (mockMode || !pool) return mockProjects;
  const [rows] = await pool.query(
    "SELECT id, code, name, client_name, status, progress_pct, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM projects ORDER BY id"
  );
  return rows;
}

export async function listTasks(projectId) {
  if (mockMode || !pool) {
    if (projectId) return mockTasks.filter((t) => t.project_id === Number(projectId));
    return mockTasks;
  }
  if (projectId) {
    const [rows] = await pool.query(
      `SELECT id, project_id, title, assignee_role, status, priority,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
       FROM tasks WHERE project_id = ? ORDER BY id`,
      [projectId]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT id, project_id, title, assignee_role, status, priority,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
     FROM tasks ORDER BY project_id, id`
  );
  return rows;
}

export async function logAi(kind, prompt, resultSummary) {
  if (mockMode || !pool) return;
  try {
    await pool.query(
      "INSERT INTO ai_logs (kind, prompt, result_summary) VALUES (?, ?, ?)",
      [kind, prompt, resultSummary]
    );
  } catch {
    /* ignore */
  }
}

export function envPath() {
  return path.resolve(__dirname, "..", ".env");
}
