/**
 * DeepSeek 等模型输出的 pages 字段与本站 public/*.html 自动对齐。
 */
import { readdirSync, existsSync } from "fs";
import { join } from "path";

/** 常见臆造路径 → 本站真实页（小写键） */
const REDIRECT_EXACT = new Map(
  Object.entries({
    "/bim-review.html": "/multimodal.html",
    "/checklist-ai.html": "/ai-showcase.html",
    "/material-check.html": "/materials.html",
    "/inspection-ai.html": "/manager.html",
    "/report-ai.html": "/contract-ai.html",
    "/data-retention.html": "/contract-ai.html",
    "/warranty-ai.html": "/tickets.html",
    "/credit-score.html": "/portal.html",
    "/incentive.html": "/contract-ai.html",
    "/handover-demo.html": "/handover.html",
    "/client-view.html": "/client.html",
    "/worker-app.html": "/worker.html",
    "/admin-panel.html": "/admin.html",
    "/demo-sandbox.html": "/demo.html",
  }).map(([k, v]) => [k.toLowerCase(), v])
);

/** 路径片段关键词 → 默认页 */
const KEYWORD_FALLBACK = [
  [/bim|审图|碰撞|图纸/i, "/multimodal.html"],
  [/合同|招采|签证|价款|付款|留存/i, "/contract-ai.html"],
  [/材料|进场|封样/i, "/materials.html"],
  [/工单|质保|报修|渗漏/i, "/tickets.html"],
  [/经理|指挥|智巡|巡检|进度/i, "/manager.html"],
  [/工人|持证/i, "/worker.html"],
  [/客户|业主/i, "/client.html"],
  [/移交/i, "/handover.html"],
  [/沙盘|对比|效果/i, "/demo.html"],
  [/120|场景|房间/i, "/scenario-120.html"],
  [/门户|信用|星级/i, "/portal.html"],
  [/多模态|影像|传感器/i, "/multimodal.html"],
  [/隐蔽|闸口|验收点|五大模块/i, "/ai-showcase.html"],
];

const DEFAULT_FALLBACK = "/ai-showcase.html";

export function loadPublicHtmlWhitelist(publicDir) {
  const allowed = new Set();
  if (!existsSync(publicDir)) return allowed;
  for (const f of readdirSync(publicDir)) {
    if (f.endsWith(".html")) allowed.add("/" + f);
  }
  return allowed;
}

function stripHash(p) {
  const i = String(p).indexOf("#");
  if (i < 0) return { base: String(p).trim(), hash: "" };
  return { base: String(p).slice(0, i).trim(), hash: String(p).slice(i) };
}

function joinBaseHash(base, hash) {
  const b = base.endsWith(".html") ? base : base + (base.includes(".") ? "" : ".html");
  return b + (hash || "");
}

/**
 * 将单条页面引用规范化为白名单内路径，保留 #fragment。
 * @param {string} raw
 * @param {Set<string>} allowed
 */
export function alignOnePage(raw, allowed) {
  const { base: rawBase, hash } = stripHash(raw);
  let base = rawBase;

  if (!base) return DEFAULT_FALLBACK + hash;

  if (!base.startsWith("/")) base = "/" + base.replace(/^\.?\//, "");

  const lower = base.toLowerCase();
  if (REDIRECT_EXACT.has(lower)) {
    return joinBaseHash(REDIRECT_EXACT.get(lower), hash);
  }

  if (!base.toLowerCase().endsWith(".html")) {
    const leaf = base.split("/").filter(Boolean).pop() || "";
    const withHtml = "/" + leaf.replace(/\.html$/i, "") + ".html";
    if (allowed.has(withHtml)) return withHtml + hash;
    const tryPath = base.endsWith("/") ? base.slice(0, -1) + ".html" : base + ".html";
    if (allowed.has(tryPath)) return tryPath + hash;
  }

  if (allowed.has(base)) return base + hash;

  for (const [re, page] of KEYWORD_FALLBACK) {
    if (re.test(rawBase + hash)) return page + hash;
  }

  return DEFAULT_FALLBACK + hash;
}

/**
 * @param {unknown[]} pages
 * @param {Set<string>} allowed
 * @returns {string[]}
 */
export function alignPagesArray(pages, allowed) {
  if (!Array.isArray(pages)) return [];
  const out = [];
  const seen = new Set();
  for (const p of pages) {
    const aligned = alignOnePage(String(p), allowed);
    if (!seen.has(aligned)) {
      seen.add(aligned);
      out.push(aligned);
    }
  }
  return out;
}

export function alignStandardBenchmarksRows(rows, allowed) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    if (!r || typeof r !== "object") return r;
    const hook = r.system_hook;
    if (typeof hook !== "string" || !hook.includes(".html")) return r;
    const next = { ...r };
    next.system_hook = hook.replace(/\*\*([^*]+\.html)\*\*/g, (_, name) => {
      const path = name.startsWith("/") ? name : "/" + name;
      const a = alignOnePage(path, allowed);
      return "**" + a.replace(/^\//, "") + "**";
    });
    return next;
  });
}

/**
 * 深度合并模块：以 generated 为主，用 base 补全空字段；pages 取并集后对齐。
 */
export function mergeDgModule(base, gen, allowed, forcedId) {
  const m = { ...(base || {}), ...(gen || {}) };
  m.module_id = forcedId || m.module_id || gen?.module_id || base?.module_id;
  const pages = alignPagesArray(
    [...(base?.pages || []), ...(gen?.pages || [])],
    allowed
  );
  m.pages = pages.length ? pages : [DEFAULT_FALLBACK];

  const af = dedupeKeepOrder([...(base?.ai_functions || []), ...(gen?.ai_functions || [])]);
  m.ai_functions = af.length ? af : base?.ai_functions || gen?.ai_functions || [];

  m.name = nonEmpty(gen?.name, base?.name) || m.name;
  m.dg_slot = nonEmpty(gen?.dg_slot, base?.dg_slot);
  m.gb_anchor = nonEmpty(gen?.gb_anchor, base?.gb_anchor);
  m.evidence_chain = nonEmpty(gen?.evidence_chain, base?.evidence_chain);
  m.risk_if_gap = nonEmpty(gen?.risk_if_gap, base?.risk_if_gap);
  m.gates = dedupeKeepOrder([...(base?.gates || []), ...(gen?.gates || [])]);

  return m;
}

function nonEmpty(a, b) {
  const s = a != null && String(a).trim() ? a : b;
  return s != null && String(s).trim() ? s : "";
}

function dedupeKeepOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = String(x).trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * @param {object[]} existingRows
 * @param {object[]} incomingRows
 */
export function mergeComparisonRows(existingRows, incomingRows) {
  const map = new Map();
  for (const r of existingRows || []) {
    if (r && r.dimension) map.set(String(r.dimension).trim(), { ...r });
  }
  for (const r of incomingRows || []) {
    if (!r || !r.dimension) continue;
    const key = String(r.dimension).trim();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r });
      continue;
    }
    map.set(key, {
      dimension: key,
      gb_family: nonEmpty(r.gb_family, prev.gb_family),
      shanghai_dg: nonEmpty(r.shanghai_dg, prev.shanghai_dg),
      system_hook: nonEmpty(r.system_hook, prev.system_hook),
    });
  }
  return [...map.values()];
}

/**
 * @param {object[]} matrixStages generated matrix
 * @param {object[]} baseMatrix optional existing matrix for merge
 */
export function mergeStageFeatures(matrixStages, baseMatrix, allowed) {
  const baseStages = baseMatrix?.matrix || [];
  if (!matrixStages || !matrixStages.length) {
    return alignStageMatrixStages(baseStages, allowed);
  }
  const byStage = new Map();
  for (const s of baseStages) {
    if (s && s.stage) byStage.set(String(s.stage).trim(), s);
  }
  const out = [];
  const seen = new Set();
  for (const s of matrixStages || []) {
    if (!s || !s.stage) continue;
    const key = String(s.stage).trim();
    seen.add(key);
    const prev = byStage.get(key);
    const features = mergeFeatures(prev?.features, s.features, allowed);
    out.push({
      stage: key,
      features: features.length ? features : alignStageMatrixStages([s], allowed)[0]?.features || [],
    });
  }
  for (const s of baseStages) {
    if (!s || !s.stage) continue;
    const key = String(s.stage).trim();
    if (!seen.has(key)) {
      out.push(alignStageMatrixStages([s], allowed)[0]);
    }
  }
  return out;
}

function mergeFeatures(prevFeats, nextFeats, allowed) {
  if (!nextFeats || !nextFeats.length) {
    return (prevFeats || []).map((f) => ({
      ...f,
      pages: alignPagesArray(f.pages || [], allowed),
    }));
  }
  const map = new Map();
  for (const f of prevFeats || []) {
    if (f && f.name) map.set(String(f.name).trim(), { ...f });
  }
  for (const f of nextFeats || []) {
    if (!f || !f.name) continue;
    const key = String(f.name).trim();
    const prev = map.get(key);
    const pages = alignPagesArray(
      [...(prev?.pages || []), ...(f.pages || [])],
      allowed
    );
    const merged = {
      name: key,
      pages: pages.length ? pages : alignPagesArray(f.pages || [], allowed),
      weight: nonEmpty(f.weight, prev?.weight) || "●",
    };
    map.set(key, merged);
  }
  return [...map.values()];
}

function alignStageMatrixStages(stages, allowed) {
  return (stages || []).map((s) => ({
    ...s,
    features: (s.features || []).map((f) => ({
      ...f,
      pages: alignPagesArray(f.pages || [], allowed),
    })),
  }));
}

export { DEFAULT_FALLBACK };
