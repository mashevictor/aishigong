import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  initDb,
  logAi,
  envPath,
  isMockDb,
  pingDb,
  closeDb,
  isProductionEnv,
  findUserByUsername,
  verifyPassword,
  listProjectsForUser,
  listTasksForUser,
  createTaskForUser,
  updateTaskStatusForUser,
  listMessagesForUser,
  createMessageForUser,
  WORKFLOW_STATUSES,
  adminStats,
  adminListUsers,
  adminListAllProjects,
  adminCreateProject,
  adminUpdateProject,
  adminListMembers,
  adminAddMember,
  adminRemoveMember,
  adminListAiLogs,
  clientProjectOverview,
  getMediaDashboard,
  getPortalModules,
  SERVICE_TICKET_STATUSES,
  listMaterialsForUser,
  createMaterialForUser,
  listSitePhotosForUser,
  createSitePhotoForUser,
  listTicketsForUser,
  createTicketForUser,
  patchTicketStatusForUser,
  dashboardSummaryForUser,
} from "./db.js";
import { signUserToken, authMiddleware, getJwtSecret, roleMiddleware } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: envPath() });

const app = express();
const PORT = Number(process.env.PORT || 3780);
const prod = isProductionEnv(process.env);
const rawOrigins = String(process.env.CORS_ORIGIN || "").trim();
const corsOrigins = rawOrigins
  ? rawOrigins.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true" || prod) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1) || 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors(
    corsOrigins && corsOrigins.length
      ? { origin: corsOrigins, credentials: true }
      : { origin: prod ? false : true }
  )
);

const trustProxyEnabled =
  String(process.env.TRUST_PROXY || "").toLowerCase() === "true" || prod;
const rateLimitTrustProxyOpt = trustProxyEnabled ? { validate: { trustProxy: true } } : {};

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 400),
  standardHeaders: true,
  legacyHeaders: false,
  ...rateLimitTrustProxyOpt,
  skip: (req) =>
    !req.path.startsWith("/api") || req.path === "/api/health" || req.path === "/api/health/ready",
});

const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  ...rateLimitTrustProxyOpt,
});

app.use(apiLimiter);
app.use(express.json({ limit: "2mb" }));

const publicDir = path.join(__dirname, "..", "public");
const rootDir = path.join(__dirname, "..");

const serveRepoRoot =
  String(process.env.SERVE_REPO_ROOT || "").toLowerCase() === "true" ||
  (!prod && String(process.env.SERVE_REPO_ROOT || "").toLowerCase() !== "false");

app.use(express.static(publicDir, { maxAge: prod ? 86400000 : 0, index: true }));
if (serveRepoRoot) {
  app.use(
    express.static(rootDir, {
      maxAge: prod ? 3600000 : 0,
      index: false,
      dotfiles: "ignore",
    })
  );
} else if (prod) {
  console.warn("[serve] 生产环境未挂载仓库根目录静态文件（避免误暴露无关文件）。需要 logo/方案页请设 SERVE_REPO_ROOT=true。");
}

try {
  await initDb(process.env);
} catch (e) {
  console.error(e);
  process.exit(1);
}

const requireAuth = authMiddleware(process.env);
const adminOnly = [requireAuth, roleMiddleware("管理员")];

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    db: isMockDb() ? "mock" : "mysql",
    port: PORT,
    auth: Boolean(getJwtSecret(process.env)),
    env: prod ? "production" : "development",
    mock_forbidden: prod,
  });
});

app.get("/api/health/ready", async (_req, res) => {
  if (prod && isMockDb()) {
    return res.status(503).json({ ok: false, ready: false, error: "production cannot use mock db" });
  }
  try {
    const p = await pingDb();
    return res.json({ ok: true, ready: true, ...p });
  } catch (e) {
    return res.status(503).json({ ok: false, ready: false, error: e.message || "db ping failed" });
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  if (!getJwtSecret(process.env)) {
    return res.status(503).json({ error: "未配置 JWT_SECRET，无法登录" });
  }
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) {
    return res.status(400).json({ error: "请输入用户名和密码" });
  }
  try {
    const row = await findUserByUsername(username);
    if (!row || !(await verifyPassword(row, password))) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    const user = {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      role: row.role,
    };
    const token = signUserToken(process.env, user);
    res.json({
      data: {
        token,
        user: { id: user.id, username: user.username, name: user.display_name, role: user.role },
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "login failed" });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    data: { id: req.user.uid, username: req.user.username, name: req.user.name, role: req.user.role },
  });
});

app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const rows = await listProjectsForUser(req.user);
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "list projects failed" });
  }
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = req.query.project_id ? String(req.query.project_id) : "";
    const rows = await listTasksForUser(req.user, projectId ? Number(projectId) : null);
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "list tasks failed" });
  }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const row = await createTaskForUser(req.user, req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message || "create task failed" });
  }
});

app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim();
    const row = await updateTaskStatusForUser(req.user, req.params.id, status);
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message || "update task failed" });
  }
});

app.get("/api/messages", requireAuth, async (req, res) => {
  try {
    const projectId = String(req.query.project_id || "");
    const rows = await listMessagesForUser(req.user, projectId);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message || "list messages failed" });
  }
});

app.post("/api/messages", requireAuth, async (req, res) => {
  try {
    const projectId = req.body?.project_id;
    const body = req.body?.body;
    const row = await createMessageForUser(req.user, projectId, body);
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message || "send message failed" });
  }
});

app.get("/api/meta/workflow", (_req, res) => {
  res.json({ data: { statuses: WORKFLOW_STATUSES } });
});

app.get("/api/meta/ticket-statuses", (_req, res) => {
  res.json({ data: { statuses: SERVICE_TICKET_STATUSES } });
});

app.get("/api/meta/delivery", (_req, res) => {
  res.json({
    data: {
      frontend_pages: [
        { path: "/portal.html", deliverable: "统一门户（按角色模块导航）", audience: "已登录全员" },
        { path: "/index.html", deliverable: "方案正文 + 施工协同工作台 + AI", audience: "全员 / 演示" },
        { path: "/manager.html", deliverable: "施工经理数据看板（任务/材料/工单汇总）", audience: "经理 / 演示" },
        { path: "/worker.html", deliverable: "工人极简（任务 + 现场影像只读）", audience: "工人 / 经理 / 管理" },
        { path: "/materials.html", deliverable: "材料 TOC + 现场影像归档", audience: "项目成员" },
        { path: "/tickets.html", deliverable: "售后质保工单", audience: "客户 / 售后 / 管理 等" },
        { path: "/admin.html", deliverable: "Web 管理后台", audience: "管理/项目" },
        { path: "/client.html", deliverable: "项目 H5/网站 · 客户视图", audience: "终用户/业主" },
        { path: "/multimodal.html", deliverable: "多模态分析结论区（AI 调用留痕）", audience: "管理 / 可选 C 端" },
        { path: "/handover.html", deliverable: "移交清单与独立交付物说明", audience: "建设方信息化 / 移交" },
      ],
      backend_route_groups: [
        { prefix: "/api/auth", note: "登录鉴权" },
        { prefix: "/api/portal/modules", note: "门户模块清单（按角色过滤）" },
        { prefix: "/api/projects,/api/tasks,/api/messages", note: "业务协同（RBAC + 项目授权）" },
        { prefix: "/api/materials,/api/site-photos,/api/tickets", note: "材料、影像、售后工单" },
        { prefix: "/api/dashboard/summary", note: "经理看板汇总" },
        { prefix: "/api/admin/*", note: "管理后台（仅管理员）" },
        { prefix: "/api/client/overview", note: "客户视图聚合（封面+图库+里程碑）" },
        { prefix: "/api/media/dashboard", note: "工作台数据一览（项目封面+演示图库+AI留痕）" },
        { prefix: "/api/stream/events", note: "SSE 心跳（实时通道占位）" },
        { prefix: "/api/ai/chat,/api/ai/image", note: "文生文 / 文生图（需登录）" },
      ],
      separate_products: [
        { name: "微信小程序", status: "需独立小程序工程 + 微信开发者工具发版" },
        { name: "一客一专属 APK", status: "需 RN/Flutter/Uni-App + CI 出包与白标" },
        { name: "OSS / 网关 / 完整审计", status: "可按签约接入对象存储与 API 网关" },
      ],
    },
  });
});

app.get("/api/admin/stats", ...adminOnly, async (_req, res) => {
  try {
    res.json({ data: await adminStats() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/users", ...adminOnly, async (_req, res) => {
  try {
    res.json({ data: await adminListUsers() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/projects", ...adminOnly, async (_req, res) => {
  try {
    res.json({ data: await adminListAllProjects() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/projects", ...adminOnly, async (req, res) => {
  try {
    const row = await adminCreateProject(req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/admin/projects/:id", ...adminOnly, async (req, res) => {
  try {
    const row = await adminUpdateProject(req.params.id, req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/admin/project-members", ...adminOnly, async (req, res) => {
  try {
    const rows = await adminListMembers(req.query.project_id);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/admin/project-members", ...adminOnly, async (req, res) => {
  try {
    await adminAddMember(req.body?.project_id, req.body?.user_id, req.body?.role_on_project);
    res.json({ data: { ok: true } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/admin/project-members", ...adminOnly, async (req, res) => {
  try {
    await adminRemoveMember(req.body?.project_id, req.body?.user_id);
    res.json({ data: { ok: true } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/admin/ai-logs", ...adminOnly, async (req, res) => {
  try {
    const rows = await adminListAiLogs(req.query.limit);
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/client/overview", requireAuth, async (req, res) => {
  try {
    const data = await clientProjectOverview(req.user, req.query.project_id);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/media/dashboard", requireAuth, async (req, res) => {
  try {
    res.json({ data: await getMediaDashboard(req.user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/portal/modules", requireAuth, (req, res) => {
  res.json({ data: getPortalModules(req.user.role) });
});

app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const q = req.query.project_id ? Number(req.query.project_id) : null;
    res.json({ data: await dashboardSummaryForUser(req.user, q) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/materials", requireAuth, async (req, res) => {
  try {
    const rows = await listMaterialsForUser(req.user, req.query.project_id);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/materials", requireAuth, async (req, res) => {
  try {
    const row = await createMaterialForUser(req.user, req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/site-photos", requireAuth, async (req, res) => {
  try {
    const rows = await listSitePhotosForUser(req.user, req.query.project_id);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/site-photos", requireAuth, async (req, res) => {
  try {
    const row = await createSitePhotoForUser(req.user, req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/tickets", requireAuth, async (req, res) => {
  try {
    const rows = await listTicketsForUser(req.user, req.query.project_id);
    res.json({ data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/tickets", requireAuth, async (req, res) => {
  try {
    const row = await createTicketForUser(req.user, req.body || {});
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/tickets/:id", requireAuth, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim();
    const row = await patchTicketStatusForUser(req.user, req.params.id, status);
    res.json({ data: row });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/stream/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  const write = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  write("ready", { uid: req.user.uid, username: req.user.username });
  const iv = setInterval(() => {
    write("ping", { t: Date.now() });
  }, 20000);
  req.on("close", () => {
    clearInterval(iv);
  });
});

app.post("/api/ai/chat", requireAuth, async (req, res) => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "未配置 DEEPSEEK_API_KEY" });
  }
  const prompt = String(req.body?.prompt || "").trim();
  const system =
    String(req.body?.system || "").trim() ||
    "你是建筑施工与信息化助手，回答简洁、可执行，使用简体中文。";
  if (!prompt) {
    return res.status(400).json({ error: "prompt 不能为空" });
  }

  try {
    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = json?.error?.message || JSON.stringify(json).slice(0, 400);
      return res.status(r.status).json({ error: msg });
    }
    const text = json?.choices?.[0]?.message?.content ?? "";
    const summary = text.replace(/\s+/g, " ").slice(0, 480);
    await logAi("chat", prompt, summary);
    res.json({ data: { text, raw: json } });
  } catch (e) {
    res.status(500).json({ error: e.message || "deepseek request failed" });
  }
});

function extractImageUrl(payload) {
  if (!payload || typeof payload !== "object") return null;
  const d = payload.data ?? payload;
  const outputs = d.outputs ?? d.output ?? d.images ?? d.result;
  if (typeof outputs === "string" && /^https?:\/\//i.test(outputs)) return outputs;
  if (Array.isArray(outputs)) {
    const first = outputs[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
    if (first?.uri) return first.uri;
  }
  if (outputs?.url) return outputs.url;
  if (d.url && /^https?:\/\//i.test(d.url)) return d.url;
  if (Array.isArray(d.urls) && d.urls[0]) return d.urls[0];
  return null;
}

async function wavespeedPoll(predictionId, apiKey, maxWaitMs = 120000) {
  const base = "https://api.wavespeed.ai/api/v3";
  const started = Date.now();
  let delay = 800;
  while (Date.now() - started < maxWaitMs) {
    const r = await fetch(`${base}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = json?.message || json?.error || r.statusText;
      throw new Error(msg || `poll ${r.status}`);
    }
    const data = json.data ?? json;
    const status = data.status || data.state;
    if (status === "completed" || status === "succeeded" || status === "success") {
      const url = extractImageUrl(json) || extractImageUrl(data);
      if (url) return url;
      const outs = data.outputs ?? data.output;
      const nested = extractImageUrl({ data: outs });
      if (nested) return nested;
      throw new Error("任务完成但未解析到图片 URL");
    }
    if (status === "failed" || status === "error") {
      throw new Error(data.error || data.message || "文生图任务失败");
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay + 200, 3000);
  }
  throw new Error("文生图超时，请稍后重试");
}

app.post("/api/ai/image", requireAuth, async (req, res) => {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "未配置 WAVESPEED_API_KEY" });
  }
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ error: "prompt 不能为空" });
  }

  const model =
    process.env.WAVESPEED_TEXT_TO_IMAGE_MODEL || "alibaba/wan-2.6/text-to-image";
  const base = "https://api.wavespeed.ai/api/v3";
  const url = `${base}/${model.replace(/^\//, "")}`;

  try {
    const body = {
      prompt,
      ...(typeof req.body?.extra === "object" && req.body.extra ? req.body.extra : {}),
    };

    const submit = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const submitJson = await submit.json().catch(() => ({}));
    if (!submit.ok) {
      const msg =
        submitJson?.message ||
        submitJson?.error ||
        JSON.stringify(submitJson).slice(0, 400);
      return res.status(submit.status).json({ error: msg || "提交文生图失败" });
    }

    const predId =
      submitJson?.data?.id ||
      submitJson?.id ||
      submitJson?.data?.prediction_id ||
      submitJson?.prediction_id;

    if (!predId) {
      const immediate = extractImageUrl(submitJson);
      if (immediate) {
        await logAi("image", prompt, immediate);
        return res.json({ data: { imageUrl: immediate, predictionId: null } });
      }
      return res
        .status(502)
        .json({ error: "未返回任务 ID，请检查模型路径或响应结构", raw: submitJson });
    }

    const imageUrl = await wavespeedPoll(predId, apiKey);
    await logAi("image", prompt, imageUrl);
    res.json({ data: { imageUrl, predictionId: predId } });
  } catch (e) {
    res.status(500).json({ error: e.message || "wavespeed failed" });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "not found" });
  }
  next();
});

const BIND_HOST = process.env.BIND_HOST || (prod ? "127.0.0.1" : "0.0.0.0");

const server = app.listen(PORT, BIND_HOST, () => {
  console.log(`服务已启动 http://${BIND_HOST}:${PORT} （NODE_ENV=${process.env.NODE_ENV || "development"}）`);
  console.log(
    `入口: portal.html | index.html | manager/worker/materials/tickets | admin | client | handover`
  );
});

function shutdown(signal) {
  console.warn(`收到 ${signal}，正在关闭…`);
  server.close(async () => {
    try {
      await closeDb();
    } catch (e) {
      console.warn("关闭数据库池时：", e.message);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
