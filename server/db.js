import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { DEMO_PROJECT_COVERS, DEMO_GALLERY } from "./media.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const WORKFLOW_STATUSES = ["待派发", "进行中", "待验收", "整改中", "已完成"];

export const SERVICE_TICKET_STATUSES = ["待受理", "处理中", "待回访", "已关闭"];

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
let mockMaterials = [];
let mockSitePhotos = [];
let mockTickets = [];
let mockMatIdSeq = 1;
let mockPhotoIdSeq = 1;
let mockTicketIdSeq = 1;

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
      cover_image_url: DEMO_PROJECT_COVERS["PRJ-DEMO-001"],
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    },
    {
      id: 2,
      code: "PRJ-DEMO-002",
      name: "办公楼改造试点",
      client_name: "演示总包 B",
      status: "待验收",
      progress_pct: 94,
      cover_image_url: DEMO_PROJECT_COVERS["PRJ-DEMO-002"],
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
  mockMatIdSeq = 20;
  mockPhotoIdSeq = 20;
  mockTicketIdSeq = 20;
  const ts = () => new Date().toISOString().slice(0, 19).replace("T", " ");
  mockMaterials = [
    {
      id: 11,
      project_id: 1,
      item_name: "瓷砖",
      spec: "600×600 仿古",
      quantity_decimal: 1200,
      unit: "片",
      status_note: "已进场约 80%",
      image_url: DEMO_GALLERY[4].url,
      updated_at: ts(),
    },
    {
      id: 12,
      project_id: 1,
      item_name: "乳胶漆",
      spec: "环保五合一",
      quantity_decimal: 180,
      unit: "桶",
      status_note: "待调色确认",
      image_url: null,
      updated_at: ts(),
    },
    {
      id: 13,
      project_id: 2,
      item_name: "电缆 YJV",
      spec: "3×25+1×16",
      quantity_decimal: 850,
      unit: "米",
      status_note: "复核到货单",
      image_url: DEMO_GALLERY[2].url,
      updated_at: ts(),
    },
  ];
  mockSitePhotos = [
    {
      id: 21,
      project_id: 1,
      caption: DEMO_GALLERY[0].caption,
      image_url: DEMO_GALLERY[0].url,
      sort_order: 1,
      created_at: ts(),
    },
    {
      id: 22,
      project_id: 1,
      caption: DEMO_GALLERY[3].caption,
      image_url: DEMO_GALLERY[3].url,
      sort_order: 2,
      created_at: ts(),
    },
    {
      id: 23,
      project_id: 2,
      caption: DEMO_GALLERY[1].caption,
      image_url: DEMO_GALLERY[1].url,
      sort_order: 1,
      created_at: ts(),
    },
  ];
  mockTickets = [
    {
      id: 31,
      project_id: 1,
      title: "洗手间地漏异响",
      description: "夜间有异响，需上门排查",
      category: "报修",
      status: "处理中",
      priority: "P1",
      created_by_user_id: 6,
      created_at: ts(),
    },
    {
      id: 32,
      project_id: 1,
      title: "阳台渗水复查",
      description: "雨后内侧墙角有水渍",
      category: "报修",
      status: "待受理",
      priority: "P0",
      created_by_user_id: 4,
      created_at: ts(),
    },
    {
      id: 33,
      project_id: 2,
      title: "门禁面板划痕",
      description: "交付验收时发现轻微划痕",
      category: "质保",
      status: "待回访",
      priority: "P2",
      created_by_user_id: 6,
      created_at: ts(),
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
  try {
    await conn.query(`ALTER TABLE projects ADD COLUMN cover_image_url VARCHAR(512) NULL`);
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }
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
  await conn.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      spec VARCHAR(255) DEFAULT NULL,
      quantity_decimal DECIMAL(12,2) NOT NULL DEFAULT 0,
      unit VARCHAR(32) NOT NULL DEFAULT '件',
      status_note VARCHAR(255) DEFAULT NULL,
      image_url VARCHAR(512) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_mat_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS site_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      caption VARCHAR(255) NOT NULL,
      image_url VARCHAR(512) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_photo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS service_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      title VARCHAR(512) NOT NULL,
      description TEXT NULL,
      category VARCHAR(64) DEFAULT '报修',
      status VARCHAR(32) NOT NULL DEFAULT '待受理',
      priority VARCHAR(16) DEFAULT 'P2',
      created_by_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tick_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_tick_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
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

async function patchDemoCoverUrls(conn) {
  const u1 = DEMO_PROJECT_COVERS["PRJ-DEMO-001"];
  const u2 = DEMO_PROJECT_COVERS["PRJ-DEMO-002"];
  await conn.query(
    `UPDATE projects SET cover_image_url = ? WHERE code = 'PRJ-DEMO-001' AND (cover_image_url IS NULL OR TRIM(cover_image_url) = '')`,
    [u1]
  );
  await conn.query(
    `UPDATE projects SET cover_image_url = ? WHERE code = 'PRJ-DEMO-002' AND (cover_image_url IS NULL OR TRIM(cover_image_url) = '')`,
    [u2]
  );
}

async function seedDemoExtras(conn) {
  const [[mc]] = await conn.query("SELECT COUNT(*) AS c FROM materials");
  if (mc.c > 0) return;
  const [prows] = await conn.query("SELECT id, code FROM projects ORDER BY id");
  const byCode = Object.fromEntries(prows.map((p) => [p.code, p.id]));
  const p1 = byCode["PRJ-DEMO-001"] ?? prows[0]?.id;
  const p2 = byCode["PRJ-DEMO-002"] ?? prows[1]?.id;
  if (!p1) return;
  const [[sh]] = await conn.query(
    "SELECT id FROM users WHERE username = 'shouhou' LIMIT 1"
  );
  const [[kh]] = await conn.query(
    "SELECT id FROM users WHERE username = 'kehu' LIMIT 1"
  );
  const uidSh = sh?.id ?? 1;
  const uidKh = kh?.id ?? uidSh;

  await conn.query(
    `INSERT INTO materials (project_id, item_name, spec, quantity_decimal, unit, status_note, image_url) VALUES
     (?, '瓷砖', '600×600 仿古', 1200, '片', '已进场约80%', ?),
     (?, '乳胶漆', '环保五合一', 180, '桶', '待调色确认', NULL),
     (?, '电缆 YJV', '3×25+1×16', 850, '米', '复核到货单', ?)`,
    [p1, DEMO_GALLERY[4].url, p1, p2, DEMO_GALLERY[2].url]
  );

  await conn.query(
    `INSERT INTO site_photos (project_id, caption, image_url, sort_order) VALUES
     (?, ?, ?, 1), (?, ?, ?, 2)`,
    [
      p1,
      DEMO_GALLERY[0].caption,
      DEMO_GALLERY[0].url,
      p1,
      DEMO_GALLERY[3].caption,
      DEMO_GALLERY[3].url,
    ]
  );
  if (p2) {
    await conn.query(
      `INSERT INTO site_photos (project_id, caption, image_url, sort_order) VALUES (?, ?, ?, 1)`,
      [p2, DEMO_GALLERY[1].caption, DEMO_GALLERY[1].url]
    );
  }

  await conn.query(
    `INSERT INTO service_tickets (project_id, title, description, category, status, priority, created_by_user_id) VALUES
     (?, '洗手间地漏异响', '夜间有异响，需上门排查', '报修', '处理中', 'P1', ?),
     (?, '阳台渗水复查', '雨后内侧墙角有水渍', '报修', '待受理', 'P0', ?)`,
    [p1, uidSh, p1, uidKh]
  );
  if (p2) {
    await conn.query(
      `INSERT INTO service_tickets (project_id, title, description, category, status, priority, created_by_user_id) VALUES
       (?, '门禁面板划痕', '交付验收时发现轻微划痕', '质保', '待回访', 'P2', ?)`,
      [p2, uidSh]
    );
  }
}

async function seedDemo(conn) {
  await conn.query(
    `INSERT INTO projects (code, name, client_name, status, progress_pct, cover_image_url) VALUES
     ('PRJ-DEMO-001', '样板工程 · 滨江精装', '演示客户 A', '进行中', 62, ?),
     ('PRJ-DEMO-002', '办公楼改造试点', '演示总包 B', '待验收', 94, ?)`,
    [DEMO_PROJECT_COVERS["PRJ-DEMO-001"], DEMO_PROJECT_COVERS["PRJ-DEMO-002"]]
  );
  await conn.query(
    `INSERT INTO tasks (project_id, title, description, assignee_role, status, priority, due_date) VALUES
     (1, '卫生间防水复检', '对照图纸检查涂层厚度与闭水记录', '施工经理', '待验收', 'P0', '2026-05-08'),
     (1, '木工收口节点拍照上传', '按节点清单上传前后对比照片', '工人', '进行中', 'P1', '2026-05-06'),
     (2, '幕墙色差 AI 比对', '上传现场与样板照片，生成比对结论', '管理员', '整改中', 'P0', '2026-05-10')`
  );
}

export function isProductionEnv(env) {
  return String(env.NODE_ENV || "").toLowerCase() === "production";
}

/** 演示种子：生产环境默认关闭，除非 SEED_DEMO_DATA=true */
export function wantsDemoSeed(env) {
  const v = String(env.SEED_DEMO_DATA || "").toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return !isProductionEnv(env);
}

async function bootstrapProductionAdmin(conn, env) {
  const username = String(env.ADMIN_BOOTSTRAP_USERNAME || "").trim();
  const password = String(env.ADMIN_BOOTSTRAP_PASSWORD || "");
  const displayName = String(env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "系统管理员").trim() || "系统管理员";
  const minLen = isProductionEnv(env) ? 12 : 8;
  if (!username || password.length < minLen) {
    throw new Error(
      `[db] 数据库中尚无用户且未启用演示种子：请配置 ADMIN_BOOTSTRAP_USERNAME 与 ADMIN_BOOTSTRAP_PASSWORD（至少 ${minLen} 位），或设置 SEED_DEMO_DATA=true`
    );
  }
  const rounds = Math.min(14, Math.max(10, Number(env.BCRYPT_ROUNDS) || 12));
  const hash = bcrypt.hashSync(password, rounds);
  await conn.query(
    "INSERT INTO users (username, password_hash, display_name, role) VALUES (?,?,?,?)",
    [username, hash, displayName, "管理员"]
  );
  console.warn(
    "[db] 已通过 ADMIN_BOOTSTRAP_* 创建首个管理员；请在验证登录后从环境中移除明文密码变量。"
  );
}

export async function initDb(env) {
  initMockDataset();

  const prod = isProductionEnv(env);
  const demoSeed = wantsDemoSeed(env);

  const host = env.MYSQL_HOST || "";
  const user = env.MYSQL_USER || "";
  const password = env.MYSQL_PASSWORD ?? "";
  const database = env.MYSQL_DATABASE || "";

  if (!host || !user || !database) {
    if (prod) {
      throw new Error(
        "[db] 生产环境必须配置 MYSQL_HOST、MYSQL_USER、MYSQL_DATABASE（不允许使用内存模拟库）。"
      );
    }
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
      connectionLimit: Math.min(50, Math.max(2, Number(env.MYSQL_CONNECTION_LIMIT) || 10)),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    const conn = await pool.getConnection();
    await ensureMysqlSchema(conn);

    const [[ur]] = await conn.query("SELECT COUNT(*) AS c FROM users");
    const [[pr]] = await conn.query("SELECT COUNT(*) AS c FROM projects");

    if (pr.c === 0 && demoSeed) {
      await seedDemo(conn);
    }

    await patchDemoCoverUrls(conn);

    if (ur.c === 0) {
      if (demoSeed) {
        await seedUsersAndMembers(conn);
      } else {
        await bootstrapProductionAdmin(conn, env);
      }
    }

    if (demoSeed) {
      await seedDemoExtras(conn);
    }

    conn.release();
    mockMode = false;
    console.log("[db] MySQL 已连接并完成结构检查。");
  } catch (e) {
    if (prod) {
      console.error("[db] 生产环境 MySQL 初始化失败：", e.message || e);
      throw e;
    }
    mockMode = true;
    pool = null;
    console.warn("[db] MySQL 连接失败，改用模拟数据：", e.message);
  }
}

/** 就绪探针：线上负载均衡可调用 */
export async function pingDb() {
  if (mockMode || !pool) {
    return { ok: true, db: "mock", latencyMs: 0 };
  }
  const t0 = Date.now();
  await pool.query("SELECT 1 AS ok");
  return { ok: true, db: "mysql", latencyMs: Date.now() - t0 };
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
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
    `SELECT id, code, name, client_name, status, progress_pct, cover_image_url,
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

const PORTAL_MODULES = [
  { key: "portal", title: "统一门户", path: "/portal.html", roles: ["*"], tag: "入口" },
  { key: "proposal", title: "方案与工作台", path: "/index.html", roles: ["*"], tag: "全文+AI" },
  { key: "manager", title: "施工经理看板", path: "/manager.html", roles: ["*"], tag: "汇总" },
  {
    key: "worker",
    title: "工人极简视图",
    path: "/worker.html",
    roles: ["工人", "施工经理", "管理员"],
    tag: "任务",
  },
  { key: "materials", title: "材料与现场影像", path: "/materials.html", roles: ["*"], tag: "TOC" },
  { key: "tickets", title: "售后工单", path: "/tickets.html", roles: ["*"], tag: "质保" },
  {
    key: "client",
    title: "客户 H5 视图",
    path: "/client.html",
    roles: ["客户", "管理员", "施工经理", "总包", "售后"],
    tag: "业主",
  },
  { key: "multimodal", title: "多模态分析", path: "/multimodal.html", roles: ["*"], tag: "AI" },
  { key: "admin", title: "管理后台", path: "/admin.html", roles: ["管理员"], tag: "RBAC" },
  { key: "handover", title: "移交清单", path: "/handover.html", roles: ["*"], tag: "文档" },
];

export function getPortalModules(role) {
  const r = String(role || "");
  return PORTAL_MODULES.filter((m) => m.roles.includes("*") || m.roles.includes(r)).map(
    ({ roles, ...rest }) => rest
  );
}

function mapTicketRow(t) {
  const u = mockUsers.find((x) => x.id === t.created_by_user_id);
  return {
    id: t.id,
    project_id: t.project_id,
    title: t.title,
    description: t.description ?? null,
    category: t.category,
    status: t.status,
    priority: t.priority,
    created_by_user_id: t.created_by_user_id,
    creator_username: u?.username ?? null,
    creator_display_name: u?.display_name ?? null,
    created_at: t.created_at,
  };
}

export async function listMaterialsForUser(user, projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, pid))) throw new Error("无权查看该项目材料");

  if (mockMode || !pool) {
    return mockMaterials
      .filter((m) => m.project_id === pid)
      .map((m) => ({ ...m, quantity_decimal: Number(m.quantity_decimal) }));
  }
  const [rows] = await pool.query(
    `SELECT id, project_id, item_name, spec, quantity_decimal, unit, status_note, image_url,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM materials WHERE project_id = ? ORDER BY id`,
    [pid]
  );
  return rows;
}

export async function createMaterialForUser(user, payload) {
  const project_id = Number(payload?.project_id);
  if (!project_id) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, project_id))) throw new Error("无权添加材料");
  const item_name = String(payload?.item_name || "").trim();
  if (!item_name) throw new Error("名称不能为空");
  const spec = String(payload?.spec || "").trim() || null;
  const quantity_decimal = Number(payload?.quantity_decimal ?? payload?.quantity ?? 0);
  const unit = String(payload?.unit || "件").trim() || "件";
  const status_note = String(payload?.status_note || "").trim() || null;
  const image_url = String(payload?.image_url || "").trim() || null;

  if (mockMode || !pool) {
    const row = {
      id: mockMatIdSeq++,
      project_id,
      item_name,
      spec,
      quantity_decimal,
      unit,
      status_note,
      image_url,
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockMaterials.push(row);
    return row;
  }
  const [r] = await pool.query(
    `INSERT INTO materials (project_id, item_name, spec, quantity_decimal, unit, status_note, image_url)
     VALUES (?,?,?,?,?,?,?)`,
    [project_id, item_name, spec, quantity_decimal, unit, status_note, image_url]
  );
  const [rows] = await pool.query(
    `SELECT id, project_id, item_name, spec, quantity_decimal, unit, status_note, image_url,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM materials WHERE id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function listSitePhotosForUser(user, projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, pid))) throw new Error("无权查看影像");

  if (mockMode || !pool) {
    return mockSitePhotos
      .filter((p) => p.project_id === pid)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((p) => ({ ...p }));
  }
  const [rows] = await pool.query(
    `SELECT id, project_id, caption, image_url, sort_order,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM site_photos WHERE project_id = ? ORDER BY sort_order, id`,
    [pid]
  );
  return rows;
}

export async function createSitePhotoForUser(user, payload) {
  const project_id = Number(payload?.project_id);
  if (!project_id) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, project_id))) throw new Error("无权上传影像记录");
  const caption = String(payload?.caption || "").trim() || "现场影像";
  const image_url = String(payload?.image_url || "").trim();
  if (!image_url) throw new Error("图片 URL 不能为空");
  const sort_order = Number(payload?.sort_order ?? 99);

  if (mockMode || !pool) {
    const row = {
      id: mockPhotoIdSeq++,
      project_id,
      caption,
      image_url,
      sort_order,
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockSitePhotos.push(row);
    return row;
  }
  const [r] = await pool.query(
    `INSERT INTO site_photos (project_id, caption, image_url, sort_order) VALUES (?,?,?,?)`,
    [project_id, caption, image_url, sort_order]
  );
  const [rows] = await pool.query(
    `SELECT id, project_id, caption, image_url, sort_order,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM site_photos WHERE id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function listTicketsForUser(user, projectId) {
  const pid = Number(projectId);
  if (!pid) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, pid))) throw new Error("无权查看工单");

  if (mockMode || !pool) {
    return mockTickets.filter((t) => t.project_id === pid).map(mapTicketRow);
  }
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id, t.title, t.description, t.category, t.status, t.priority,
            t.created_by_user_id, u.username AS creator_username, u.display_name AS creator_display_name,
            DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM service_tickets t
     JOIN users u ON u.id = t.created_by_user_id
     WHERE t.project_id = ?
     ORDER BY t.id DESC`,
    [pid]
  );
  return rows;
}

export async function createTicketForUser(user, payload) {
  const project_id = Number(payload?.project_id);
  if (!project_id) throw new Error("project_id 无效");
  if (!(await userCanAccessProject(user, project_id))) throw new Error("无权创建工单");
  const title = String(payload?.title || "").trim();
  if (!title) throw new Error("标题不能为空");
  const description = String(payload?.description || "").trim() || null;
  const category = String(payload?.category || "报修").trim() || "报修";
  const priority = String(payload?.priority || "P2").trim() || "P2";
  let status = String(payload?.status || "待受理").trim();
  if (!SERVICE_TICKET_STATUSES.includes(status)) status = "待受理";

  if (mockMode || !pool) {
    const row = {
      id: mockTicketIdSeq++,
      project_id,
      title,
      description,
      category,
      status,
      priority,
      created_by_user_id: user.uid,
      created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockTickets.push(row);
    return mapTicketRow(row);
  }
  const [r] = await pool.query(
    `INSERT INTO service_tickets (project_id, title, description, category, status, priority, created_by_user_id)
     VALUES (?,?,?,?,?,?,?)`,
    [project_id, title, description, category, status, priority, user.uid]
  );
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id, t.title, t.description, t.category, t.status, t.priority,
            t.created_by_user_id, u.username AS creator_username, u.display_name AS creator_display_name,
            DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM service_tickets t JOIN users u ON u.id = t.created_by_user_id WHERE t.id = ?`,
    [r.insertId]
  );
  return rows[0];
}

export async function patchTicketStatusForUser(user, ticketId, status) {
  if (!SERVICE_TICKET_STATUSES.includes(status)) throw new Error("工单状态不合法");
  const tid = Number(ticketId);
  if (mockMode || !pool) {
    const t = mockTickets.find((x) => x.id === tid);
    if (!t) throw new Error("工单不存在");
    if (!(await userCanAccessProject(user, t.project_id))) throw new Error("无权操作");
    t.status = status;
    return mapTicketRow(t);
  }
  const [rows] = await pool.query(
    "SELECT id, project_id FROM service_tickets WHERE id = ? LIMIT 1",
    [tid]
  );
  const t = rows[0];
  if (!t) throw new Error("工单不存在");
  if (!(await userCanAccessProject(user, t.project_id))) throw new Error("无权操作");
  await pool.query("UPDATE service_tickets SET status = ? WHERE id = ?", [status, tid]);
  const [out] = await pool.query(
    `SELECT t.id, t.project_id, t.title, t.description, t.category, t.status, t.priority,
            t.created_by_user_id, u.username AS creator_username, u.display_name AS creator_display_name,
            DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM service_tickets t JOIN users u ON u.id = t.created_by_user_id WHERE t.id = ?`,
    [tid]
  );
  return out[0];
}

export async function dashboardSummaryForUser(user, projectIdFilter) {
  const plist = await listProjectsForUser(user);
  let pids = plist.map((p) => Number(p.id));
  if (projectIdFilter) {
    const pid = Number(projectIdFilter);
    if (!pids.includes(pid)) throw new Error("无权查看该项目");
    pids = [pid];
  }
  const empty = {
    projects: plist.filter((p) => !projectIdFilter || Number(p.id) === Number(projectIdFilter)),
    tasks_by_status: {},
    materials_count: 0,
    site_photos_count: 0,
    open_tickets: 0,
  };
  if (pids.length === 0) return empty;

  const tasks_by_status = {};
  for (const s of WORKFLOW_STATUSES) tasks_by_status[s] = 0;

  if (mockMode || !pool) {
    mockTasks
      .filter((t) => pids.includes(t.project_id))
      .forEach((t) => {
        tasks_by_status[t.status] = (tasks_by_status[t.status] || 0) + 1;
      });
    empty.materials_count = mockMaterials.filter((m) => pids.includes(m.project_id)).length;
    empty.site_photos_count = mockSitePhotos.filter((p) => pids.includes(p.project_id)).length;
    empty.open_tickets = mockTickets.filter(
      (t) => pids.includes(t.project_id) && t.status !== "已关闭"
    ).length;
    empty.tasks_by_status = tasks_by_status;
    return empty;
  }

  const ph = pids.map(() => "?").join(",");
  const params = [...pids];
  const [trows] = await pool.query(
    `SELECT status, COUNT(*) AS c FROM tasks WHERE project_id IN (${ph}) GROUP BY status`,
    params
  );
  for (const row of trows) {
    tasks_by_status[row.status] = Number(row.c);
  }
  const [[matRow]] = await pool.query(
    `SELECT COUNT(*) AS c FROM materials WHERE project_id IN (${ph})`,
    params
  );
  const [[photoRow]] = await pool.query(
    `SELECT COUNT(*) AS c FROM site_photos WHERE project_id IN (${ph})`,
    params
  );
  const [[tickRow]] = await pool.query(
    `SELECT COUNT(*) AS c FROM service_tickets WHERE project_id IN (${ph}) AND status <> '已关闭'`,
    params
  );
  return {
    projects: plist.filter((p) => pids.includes(Number(p.id))),
    tasks_by_status,
    materials_count: matRow.c,
    site_photos_count: photoRow.c,
    open_tickets: tickRow.c,
  };
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
      materials: mockMaterials.length,
      site_photos: mockSitePhotos.length,
      service_tickets: mockTickets.length,
      db: "mock",
    };
  }
  const [[pc]] = await pool.query("SELECT COUNT(*) AS c FROM projects");
  const [[uc]] = await pool.query("SELECT COUNT(*) AS c FROM users");
  const [[tc]] = await pool.query("SELECT COUNT(*) AS c FROM tasks");
  const [[mc]] = await pool.query("SELECT COUNT(*) AS c FROM messages");
  const [[ac]] = await pool.query("SELECT COUNT(*) AS c FROM ai_logs");
  const [[matc]] = await pool.query("SELECT COUNT(*) AS c FROM materials");
  const [[phc]] = await pool.query("SELECT COUNT(*) AS c FROM site_photos");
  const [[stc]] = await pool.query("SELECT COUNT(*) AS c FROM service_tickets");
  return {
    projects: pc.c,
    users: uc.c,
    tasks: tc.c,
    messages: mc.c,
    ai_logs: ac.c,
    materials: matc.c,
    site_photos: phc.c,
    service_tickets: stc.c,
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
    `SELECT id, code, name, client_name, status, progress_pct, cover_image_url,
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
  const cover_image_url = String(payload.cover_image_url || "").trim() || null;

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
      cover_image_url,
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    mockProjects.push(row);
    return row;
  }
  const [r] = await pool.query(
    `INSERT INTO projects (code, name, client_name, status, progress_pct, cover_image_url) VALUES (?,?,?,?,?,?)`,
    [code, name, client_name, status, progress_pct, cover_image_url]
  );
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct, cover_image_url,
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
  if (payload.cover_image_url != null) {
    fields.push("cover_image_url = ?");
    const c = String(payload.cover_image_url).trim();
    vals.push(c || null);
  }
  if (fields.length === 0) throw new Error("无更新字段");

  if (mockMode || !pool) {
    const p = mockProjects.find((x) => x.id === pid);
    if (!p) throw new Error("项目不存在");
    if (payload.name != null) p.name = String(payload.name).trim();
    if (payload.client_name != null) p.client_name = String(payload.client_name).trim() || null;
    if (payload.status != null) p.status = String(payload.status).trim();
    if (payload.progress_pct != null) p.progress_pct = Math.min(100, Math.max(0, Number(payload.progress_pct)));
    if (payload.cover_image_url != null) p.cover_image_url = String(payload.cover_image_url).trim() || null;
    p.updated_at = new Date().toISOString().slice(0, 19).replace("T", " ");
    return { ...p };
  }
  vals.push(pid);
  await pool.query(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`, vals);
  const [rows] = await pool.query(
    `SELECT id, code, name, client_name, status, progress_pct, cover_image_url,
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
  const plist = await listProjectsForUser(user);
  const proj = plist.find((p) => Number(p.id) === pid);
  const cover_image_url = proj?.cover_image_url || null;
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
  return {
    project_id: pid,
    cover_image_url,
    gallery: DEMO_GALLERY,
    open_tasks: openTasks,
    milestones,
  };
}

/** 工作台一站拉齐：项目（含封面）+ 模拟图库 + 管理员可看 AI 留痕预览 */
export async function getMediaDashboard(user) {
  const projects = await listProjectsForUser(user);
  let ai_preview = [];
  if (user.role === "管理员") {
    ai_preview = await adminListAiLogs(8);
  }
  return {
    projects,
    gallery: DEMO_GALLERY,
    ai_preview,
  };
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
