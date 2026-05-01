import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  initDb,
  logAi,
  envPath,
  isMockDb,
  findUserByUsername,
  verifyPassword,
  listProjectsForUser,
  listTasksForUser,
  createTaskForUser,
  updateTaskStatusForUser,
  listMessagesForUser,
  createMessageForUser,
  WORKFLOW_STATUSES,
} from "./db.js";
import { signUserToken, authMiddleware, getJwtSecret } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: envPath() });

const app = express();
const PORT = Number(process.env.PORT || 3780);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

const publicDir = path.join(__dirname, "..", "public");
const rootDir = path.join(__dirname, "..");

app.use(express.static(publicDir));
app.use(express.static(rootDir));

await initDb(process.env);

const requireAuth = authMiddleware(process.env);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    db: isMockDb() ? "mock" : "mysql",
    port: PORT,
    auth: Boolean(getJwtSecret(process.env)),
  });
});

app.post("/api/auth/login", async (req, res) => {
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

app.post("/api/ai/chat", async (req, res) => {
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

app.post("/api/ai/image", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`服务已启动 http://127.0.0.1:${PORT}`);
  console.log(`静态页: http://127.0.0.1:${PORT}/index.html`);
});
