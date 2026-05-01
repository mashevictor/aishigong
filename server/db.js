import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const WORKFLOW_STATUSES = ["待派发", "进行中", "待验收", "整改中", "已完成"];

let pool = null;
let mockMode = false;

let mockProjects = [];
let mockTasks = [];
let mockUsers = [];
let mockMembers = [];
let mockMessages = [];
let mockUserIdSeq = 1;
let mockMsgIdSeq = 1;
let mockAiLogs = [];
let mockAiLogId = 1;
let mockProjectIdSeq = 10;

function initMockDataset() {
  const hash = (p) => bcrypt.hashSync(p, 9);
  mockUserIdSeq = 7;
  mockMsgIdSeq = 3;
  mockProjects = [
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
  mockTasks = [
    {
      id: 101,
      project_id: 1,
      title: "卫生间防水复检",
      description: "对照图纸检查涂层厚度与闭水记录",
      assignee_role: "施工经理",
      status: "待验收",
      priority: "P0",
      due_date: "2026-05-08",
      assigned_user_id: null,
    },
    {
      id: 102,
      project_id: 1,
      title: "木工收口节点拍照上传",
      description: "按节点清单上传前后对比照片",
      assignee_role: "工人",
      status: "进行中",
      priority: "P1",
      due_date: "2026-05-06",
      assigned_user_id: null,
    },
    {
      id: 103,
      project_id: 2,
      title: "幕墙色差 AI 比对",
      description: "上传现场与样板照片，生成比对结论",
      assignee_role: "管理员",
      status: "整改中",
      priority: "P0",
      due_date: "2026-05-10",
      assigned_user_id: null,
    },
  ];
  mockUsers = [
    { id: 1, username: "admin", password_hash: hash("demo123"), display_name: "系统管理员", role: "管理员" },
    { id: 2, username: "jingli", password_hash: hash("demo123"), display_name: "张经理", role: "施工经理" },
    { id: 3, username: "gongren", password_hash: hash("demo123"), display_name: "李师傅", role: "工人" },
    { id: 4, username: "kehu", password_hash: hash("demo123"), display_name: "王业主", role: "客户" },
    { id: 5, username: "zongbao", password_hash: hash("demo123"), display_name: "赵总包", role: "总包" },
    { id: 6, username: "shouhou", password_hash: hash("demo123"), display_name: "周售后", role: "售后" },
  ];
  mockMembers = [
    { user_id: 1, project_id: 1, role_on_project: "管理员" },
    { user_id: 1, project_id: 2, role_on_project: "管理员" },
    { user_id: 2, project_id: 1, role_on_project: "施工经理" },
    { user_id: 2, project_id: 2, role_on_project: "施工经理" },
    { user_id: 3, project_id: 1, role_on_project: "工人" },
    { user_id: 4, project_id: 1, role_on_project: "客户" },
    { user_id: 5, project_id: 2, role_on_project: "总包" },
    { user_id: 6, project_id: 1, role_on_project: "售后" },
    { user_id: 6, project_id: 2, role_on_project: "售后" },
  ];
  mockAiLogs = [];
  mockAiLogId = 1;
  mockProjectIdSeq = 100;
  mockMessages = [
    {
      id: 1,
      project_id: 1,
      user_id: 2,
      username: "jingli",
      display_name: "张经理",
      body: "今日防水区闭水试验已安排，请客户侧注意卫生间勿开水阀。",
      created_at: new Date(Date.now() - 3600_000).toISOString().slice(0, 19).replace("T", " "),
    },
    {
      id: 2,
      project_id: 1,
      user_id: 4,
      username: "kehu",
      display_name: "王业主",
      body: "收到。下午会过去现场看一下。",
      created_at: new Date(Date.now() - 1800_000).toISOString().slice(0, 19).replace("T", " "),
    },
  ];
}

export function isMockDb() {
  return mockMode;
}

async function ensureMysqlSchema(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(64) NOT NULL,
      role ENUM('工人','施工经理','总包','客户','售后','管理员') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
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
    CREATE TABLE IF NOT EXISTS project_members (
      user_id INT NOT NULL,
      project_id INT NOT NULL,
      role_on_project VARCHAR(32) DEFAULT NULL,
      PRIMARY KEY (user_id, project_id),
      CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      title VARCHAR(512) NOT NULL,
      description TEXT NULL,
      assignee_role VARCHAR(64) DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT '待派发',
      priority VARCHAR(16) DEFAULT 'P1',
      due_date DATE DEFAULT NULL,
      assigned_user_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_tasks_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  for (const [col, def] of [
    ["description", "TEXT NULL"],
    ["assigned_user_id", "INT NULL"],
  ]) {
    try {
      await conn.query(`ALTER TABLE tasks ADD COLUMN ${col} ${def}`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }
  }
  await conn.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_msg_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
}

async function seedUsersAndMembers(conn) {
  const [urows] = await conn.query("SELECT COUNT(*) AS c FROM users");
  if (urows[0].c > 0) return;
  const hash = (p) => bcrypt.hashSync(p, 9);
  const users = [
    ["admin", hash("demo123"), "系统管理员", "管理员"],
    ["jingli", hash("demo123"), "张经理", "施工经理"],
    ["gongren", hash("demo123"), "李师傅", "工人"],
    ["kehu", hash("demo123"), "王业主", "客户"],
    ["zongbao", hash("demo123"), "赵总包", "总包"],
    ["shouhou", hash("demo123"), "周售后", "售后"],
  ];
  for (const [username, ph, dn, role] of users) {
    await conn.query(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES (?,?,?,?)",
      [username, ph, dn, role]
    );
  }
  const [prows] = await conn.query("SELECT id FROM projects ORDER BY id");
  if (prows.length === 0) return;
  const id = (i) => prows[i]?.id;
  const pairs = [
    [1, 0, "管理员"],
    [1, 1, "管理员"],
    [2, 0, "施工经理"],
    [2, 1, "施工经理"],
    [3, 0, "工人"],
    [4, 0, "客户"],
    [5, 1, "总包"],
    [6, 0, "售后"],
    [6, 1, "售后"],
  ];
  for (const [uid, pi, r] of pairs) {
    const pid = id(pi);
    if (!pid) continue;
    await conn.query(
      "INSERT IGNORE INTO project_members (user_id, project_id, role_on_project) VALUES (?,?,?)",
      [uid, pid, r]
    );
  }
  const [mrows] = await conn.query("SELECT COUNT(*) AS c FROM messages");
  if (mrows[0].c === 0 && id(0)) {
    await conn.query(
      `INSERT INTO messages (project_id, user_id, body) VALUES
       (?, 2, '今日防水区闭水试验已安排，请客户侧注意卫生间勿开水阀。'),
       (?, 4, '收到。下午会过去现场看一下。')`,
      [id(0), id(0)]
    );
  }
}

async function seedDemo(conn) {
  await conn.query(
    `INSERT INTO projects (code, name, client_name, status, progress_pct) VALUES
     ('PRJ-DEMO-001', '样板工程 · 滨江精装', '演示客户 A', '进行中', 62),
     ('PRJ-DEMO-002', '办公楼改造试点', '演示总包 B', '待验收', 94)`
  );
  await conn.query(
    `INSERT INTO tasks (project_id, title, description, assignee_role, status, priority, due_date) VALUES
     (1, '卫生间防水复检', '对照图纸检查涂层厚度与闭水记录', '施工经理', '待验收', 'P0', '2026-05-08'),
     (1, '木工收口节点拍照上传', '按节点清单上传前后对比照片', '工人', '进行中', 'P1', '2026-05-06'),
     (2, '幕墙色差 AI 比对', '上传现场与样板照片，生成比对结论', '管理员', '整改中', 'P0', '2026-05-10')`
  );
}

export async function initDb(env) {
  initMockDataset();

  const host = env.MYSQL_HOST || "";
  const user = env.MYSQL_USER || "";
  const password = env.MYSQL_PASSWORD ?? "";
  const database = env.MYSQL_DATABASE || "";

  if (!host || !user || !database) {
    mockMode = true;
    pool = null;
    console.warn("[db] 未配置 MYSQL_*，使用内存模拟数据（含登录 demo123）。");
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
    await ensureMysqlSchema(conn);
    const [rows] = await conn.query("SELECT COUNT(*) AS c FROM projects");
    if (rows[0].c === 0) {
      await seedDemo(conn);
    }
    await seedUsersAndMembers(conn);
    conn.release();
    mockMode = false;
    console.log("[db] MySQL 已连接并完成结构检查。");
  } catch (e) {
    mockMode = true;
    pool = null;
    console.warn("[db] MySQL 连接失败，改用模拟数据：", e.message);
  }
}

function accessibleProjectIds(user) {
  if (!user) return null;
  if (mockMode || !pool) {
    if (user.role === "管理员") return mockProjects.map((p) => p.id);
    return mockMembers.filter((m) => m.user_id === user.uid).map((m) => m.project_id);
  }
  return null;
}

async function mysqlAccessibleProjectIds(user) {
  if (user.role === "管理员") {
    const [rows] = await pool.query("SELECT id FROM projects");
    return rows.map((r) => r.id);
  }
  const [rows] = await pool.query(
    "SELECT project_id FROM project_members WHERE user_id = ?",
    [user.uid]
  );
  return rows.map((r) => r.project_id);
}

export async function findUserByUsername(username) {
  const u = String(username || "").trim();
  if (!u) return null;
  if (mockMode || !pool) {
    return mockUsers.find((x) => x.username === u) || null;
  }
  const [rows] = await pool.query(
    "SELECT id, username, password_hash, display_name, role FROM users WHERE username = ? LIMIT 1",
    [u]
  );
  return rows[0] || null;
}

export async function verifyPassword(row, plain) {
  if (!row || !plain) return false;
  return bcrypt.compare(String(plain), row.password_hash);
}

export async function listProjectsForUser(user) {
  if (mockMode || !pool) {
    const ids = new Set(accessibleProjectIds(user));
    return mockProjects.filter((p) => ids.has(p.id));
  }
  const ids = await mysqlAccessibleProjectIds(user);
  if (!ids || ids.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM projects WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
    ids
  );
  return rows;
}

export async function listTasksForUser(user, projectId) {
  let pids;
  if (mockMode || !pool) {
    pids = accessibleProjectIds(user);
  } else {
    pids = await mysqlAccessibleProjectIds(user);
  }
  const filterPid = projectId ? Number(projectId) : null;
  if (filterPid && !pids.includes(filterPid)) return [];

  const mapRow = (r) => ({
    id: r.id,
    project_id: r.project_id,
    title: r.title,
    description: r.description ?? null,
    assignee_role: r.assignee_role,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    assigned_user_id: r.assigned_user_id ?? null,
  });

  if (mockMode || !pool) {
    let list = mockTasks.filter((t) => pids.includes(t.project_id));
    if (filterPid) list = list.filter((t) => t.project_id === filterPid);
    return list.map(mapRow);
  }
  if (!pids || pids.length === 0) return [];
  const params = [];
  let sql = `SELECT id, project_id, title, description, assignee_role, status, priority,
                    DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, assigned_user_id
             FROM tasks WHERE project_id IN (${pids.map(() => "?").join(",")})`;
  params.push(...pids);
  if (filterPid) {
    sql += " AND project_id = ?";
    params.push(filterPid);
  }
  sql += " ORDER BY project_id, id";
  const [rows] = await pool.query(sql, params);
  return rows.map(mapRow);
}

async function userCanAccessProject(user, projectId) {
  const pid = Number(projectId);
  if (mockMode || !pool) {
    return accessibleProjectIds(user).includes(pid);
  }
  const ids = await mysqlAccessibleProjectIds(user);
  return ids.includes(pid);
}

export async function createTaskForUser(user, payload) {
  const project_id = Number(payload.project_id);
  if (!project_id) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, project_id))) throw new Error("无权在该项目下建任务");
  const title = String(payload.title || "").trim();
  if (!title) throw new Error("标题不能为空");
  const description = String(payload.description || "").trim() || null;
  const assignee_role = String(payload.assignee_role || "").trim() || null;
  const priority = String(payload.priority || "P1").trim();
  const due_date = payload.due_date ? String(payload.due_date) : null;
  const status = WORKFLOW_STATUSES.includes(payload.status) ? payload.status : "待派发";

  if (mockMode || !pool) {
    const id = Math.max(0, ...mockTasks.map((t) => t.id)) + 1;
    const row = {
      id,
      project_id,
      title,
      description,
      assignee_role,
      status,
      priority,
      due_date,
      assigned_user_id: null,
    };
    mockTasks.push(row);
    return row;
  }
  const [r] = await pool.query(
    `INSERT INTO tasks (project_id, title, description, assignee_role, status, priority, due_date)
     VALUES (?,?,?,?,?,?,?)`,
    [project_id, title, description, assignee_role, status, priority, due_date || null]
  );
  const [rows] = await pool.query(
    `SELECT id, project_id, title, description, assignee_role, status, priority,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, assigned_user_id
     FROM tasks WHERE id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function updateTaskStatusForUser(user, taskId, status) {
  if (!WORKFLOW_STATUSES.includes(status)) throw new Error("状态不合法");
  if (mockMode || !pool) {
    const t = mockTasks.find((x) => x.id === Number(taskId));
    if (!t) throw new Error("任务不存在");
    if (!(await userCanAccessProject(user, t.project_id))) throw new Error("无权操作");
    t.status = status;
    return t;
  }
  const [rows] = await pool.query("SELECT id, project_id FROM tasks WHERE id = ? LIMIT 1", [
    taskId,
  ]);
  const t = rows[0];
  if (!t) throw new Error("任务不存在");
  if (!(await userCanAccessProject(user, t.project_id))) throw new Error("无权操作");
  await pool.query("UPDATE tasks SET status = ? WHERE id = ?", [status, taskId]);
  const [out] = await pool.query(
    `SELECT id, project_id, title, description, assignee_role, status, priority,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, assigned_user_id
     FROM tasks WHERE id = ?`,
    [taskId]
  );
  return out[0];
}

export async function listMessagesForUser(user, projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, pid))) throw new Error("无权查看该项目消息");

  if (mockMode || !pool) {
    return mockMessages
      .filter((m) => m.project_id === pid)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({
        id: m.id,
        project_id: m.project_id,
        user_id: m.user_id,
        username: m.username,
        display_name: m.display_name,
        body: m.body,
        created_at: m.created_at,
      }));
  }
  const [rows] = await pool.query(
    `SELECT m.id, m.project_id, m.user_id, u.username, u.display_name, m.body,
            DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ?
     ORDER BY m.id ASC`,
    [pid]
  );
  return rows;
}

export async function createMessageForUser(user, projectId, body) {
  const pid = Number(projectId);
  const text = String(body || "").trim();
  if (!pid) throw new Error("project_id 无效");
  if (!text) throw new Error("消息不能为空");
  if (!(await userCanAccessProject(user, pid))) throw new Error("无权发言");

  if (mockMode || !pool) {
    const u = mockUsers.find((x) => x.id === user.uid);
    const row = {
      id: mockMsgIdSeq++,
      project_id: pid,
      user_id: user.uid,
      username: u?.username || "user",
      display_name: u?.display_name || "用户",
      body: text,
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockMessages.push(row);
    return row;
  }
  const [r] = await pool.query(
    "INSERT INTO messages (project_id, user_id, body) VALUES (?,?,?)",
    [pid, user.uid, text]
  );
  const [rows] = await pool.query(
    `SELECT m.id, m.project_id, m.user_id, u.username, u.display_name, m.body,
            DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function logAi(kind, prompt, resultSummary) {
  const summary = resultSummary ? String(resultSummary).slice(0, 512) : null;
  if (mockMode || !pool) {
    const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
    mockAiLogs.unshift({
      id: mockAiLogId++,
      kind,
      prompt,
      result_summary: summary,
      created_at: ts,
    });
    mockAiLogs = mockAiLogs.slice(0, 200);
    return;
  }
  try {
    await pool.query(
      "INSERT INTO ai_logs (kind, prompt, result_summary) VALUES (?, ?, ?)",
      [kind, prompt, summary]
    );
  } catch {
    /* ignore */
  }
}

export async function adminStats() {
  if (mockMode || !pool) {
    return {
      projects: mockProjects.length,
      users: mockUsers.length,
      tasks: mockTasks.length,
      messages: mockMessages.length,
      ai_logs: mockAiLogs.length,
      db: "mock",
    };
  }
  const [[pc]] = await pool.query("SELECT COUNT(*) AS c FROM projects");
  const [[uc]] = await pool.query("SELECT COUNT(*) AS c FROM users");
  const [[tc]] = await pool.query("SELECT COUNT(*) AS c FROM tasks");
  const [[mc]] = await pool.query("SELECT COUNT(*) AS c FROM messages");
  const [[ac]] = await pool.query("SELECT COUNT(*) AS c FROM ai_logs");
  return {
    projects: pc.c,
    users: uc.c,
    tasks: tc.c,
    messages: mc.c,
    ai_logs: ac.c,
    db: "mysql",
  };
}

export async function adminListUsers() {
  if (mockMode || !pool) {
    return mockUsers.map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
    }));
  }
  const [rows] = await pool.query(
    "SELECT id, username, display_name, role, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users ORDER BY id"
  );
  return rows;
}

export async function adminListAllProjects() {
  if (mockMode || !pool) {
    return mockProjects.map((p) => ({ ...p }));
  }
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM projects ORDER BY id`
  );
  return rows;
}

export async function adminCreateProject(payload) {
  const code = String(payload.code || "").trim();
  const name = String(payload.name || "").trim();
  if (!code || !name) throw new Error("编码与名称不能为空");
  const client_name = String(payload.client_name || "").trim() || null;
  const status = String(payload.status || "进行中").trim();
  const progress_pct = Math.min(100, Math.max(0, Number(payload.progress_pct) || 0));

  if (mockMode || !pool) {
    if (mockProjects.some((p) => p.code === code)) throw new Error("项目编码已存在");
    const id = ++mockProjectIdSeq;
    const row = {
      id,
      code,
      name,
      client_name,
      status,
      progress_pct,
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockProjects.push(row);
    return row;
  }
  const [r] = await pool.query(
    `INSERT INTO projects (code, name, client_name, status, progress_pct) VALUES (?,?,?,?,?)`,
    [code, name, client_name, status, progress_pct]
  );
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM projects WHERE id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function adminUpdateProject(id, payload) {
  const pid = Number(id);
  const fields = [];
  const vals = [];
  if (payload.name != null) {
    fields.push("name = ?");
    vals.push(String(payload.name).trim());
  }
  if (payload.client_name != null) {
    fields.push("client_name = ?");
    vals.push(String(payload.client_name).trim() || null);
  }
  if (payload.status != null) {
    fields.push("status = ?");
    vals.push(String(payload.status).trim());
  }
  if (payload.progress_pct != null) {
    fields.push("progress_pct = ?");
    vals.push(Math.min(100, Math.max(0, Number(payload.progress_pct))));
  }
  if (fields.length === 0) throw new Error("无更新字段");

  if (mockMode || !pool) {
    const p = mockProjects.find((x) => x.id === pid);
    if (!p) throw new Error("项目不存在");
    if (payload.name != null) p.name = String(payload.name).trim();
    if (payload.client_name != null) p.client_name = String(payload.client_name).trim() || null;
    if (payload.status != null) p.status = String(payload.status).trim();
    if (payload.progress_pct != null) p.progress_pct = Math.min(100, Math.max(0, Number(payload.progress_pct)));
    p.updated_at = new Date().toISOString().slice(0, 19).replace("T", " ");
    return { ...p };
  }
  vals.push(pid);
  await pool.query(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, vals);
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM projects WHERE id = ?`,
    [pid]
  );
  return rows[0];
}

export async function adminListMembers(projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  if (mockMode || !pool) {
    return mockMembers
      .filter((m) => m.project_id === pid)
      .map((m) => {
        const u = mockUsers.find((x) => x.id === m.user_id);
        return {
          user_id: m.user_id,
          project_id: m.project_id,
          role_on_project: m.role_on_project,
          username: u?.username,
          display_name: u?.display_name,
          role: u?.role,
        };
      });
  }
  const [rows] = await pool.query(
    `SELECT pm.user_id, pm.project_id, pm.role_on_project, u.username, u.display_name, u.role
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY pm.user_id`,
    [pid]
  );
  return rows;
}

export async function adminAddMember(projectId, userId, roleOnProject) {
  const pid = Number(projectId);
  const uid = Number(userId);
  const r = String(roleOnProject || "").trim() || null;
  if (!pid || !uid) throw new Error("project_id / user_id 无效");

  if (mockMode || !pool) {
    if (!mockProjects.some((p) => p.id === pid)) throw new Error("项目不存在");
    if (!mockUsers.some((u) => u.id === uid)) throw new Error("用户不存在");
    if (mockMembers.some((m) => m.user_id === uid && m.project_id === pid)) {
      throw new Error("已是该项目成员");
    }
    mockMembers.push({ user_id: uid, project_id: pid, role_on_project: r });
    return { ok: true };
  }
  await pool.query(
    "INSERT INTO project_members (user_id, project_id, role_on_project) VALUES (?,?,?)",
    [uid, pid, r]
  );
  return { ok: true };
}

export async function adminRemoveMember(projectId, userId) {
  const pid = Number(projectId);
  const uid = Number(userId);
  if (!pid || !uid) throw new Error("project_id / user_id 无效");
  if (mockMode || !pool) {
    mockMembers = mockMembers.filter((m) => !(m.user_id === uid && m.project_id === pid));
    return { ok: true };
  }
  await pool.query("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [pid, uid]);
  return { ok: true };
}

export async function adminListAiLogs(limit) {
  const n = Math.min(200, Math.max(1, Number(limit) || 50));
  if (mockMode || !pool) {
    return mockAiLogs.slice(0, n);
  }
  const [rows] = await pool.query(
    `SELECT id, kind, prompt, result_summary,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM ai_logs ORDER BY id DESC LIMIT ?`,
    [n]
  );
  return rows;
}

/** 客户视图：节点留痕 = 任务状态变更轨迹的轻量只读聚合（当前无独立 audit 表，用任务列表推导） */
export async function clientProjectOverview(user, projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  const tasks = await listTasksForUser(user, pid);
  const milestones = tasks
    .filter((t) => ["待验收", "已完成"].includes(t.status))
    .map((t) => ({
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      priority: t.priority,
    }));
  const openTasks = tasks.filter((t) => t.status !== "已完成").length;
  return { project_id: pid, open_tasks: openTasks, milestones };
}

export function envPath() {
  return path.resolve(__dirname, "..", ".env");
}

/** @deprecated 使用 listProjectsForUser + 登录 */
export async function listProjects() {
  if (mockMode || !pool) return mockProjects;
  const [rows] = await pool.query(
    "SELECT id, code, name, client_name, status, progress_pct, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM projects ORDER BY id"
  );
  return rows;
}

/** @deprecated */
export async function listTasks(projectId) {
  if (mockMode || !pool) {
    if (projectId) return mockTasks.filter((t) => t.project_id === Number(projectId));
    return mockTasks;
  }
  if (projectId) {
    const [rows] = await pool.query(
      `SELECT id, project_id, title, description, assignee_role, status, priority,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, assigned_user_id
       FROM tasks WHERE project_id = ? ORDER BY id`,
      [projectId]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT id, project_id, title, description, assignee_role, status, priority,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, assigned_user_id
     FROM tasks ORDER BY project_id, id`
  );
  return rows;
}
