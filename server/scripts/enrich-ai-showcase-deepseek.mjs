#!/usr/bin/env node
/**
 * 调用 DeepSeek 强化 server/ai-construction-showcase.json 中的：
 * standard_benchmarks / dg_modules_extended / stage_feature_integration
 *
 * 用法（在 server 目录）：npm run showcase:deepseek
 * 环境：server/.env 或上级 .env 中的 DEEPSEEK_API_KEY（与主站一致）
 * 可选：DEEPSEEK_MODEL（默认 deepseek-chat）
 *
 * 成功时：先备份 ai-construction-showcase.json.bak，再写回 **合并 + 路由自动对齐** 结果。
 * 未配置密钥：提示并退出 0（不修改文件）。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import {
  loadPublicHtmlWhitelist,
  alignOnePage,
  alignStandardBenchmarksRows,
  mergeComparisonRows,
  mergeDgModule,
  mergeStageFeatures,
  DEFAULT_FALLBACK,
} from "../lib/showcase-route-align.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
const publicDir = join(serverRoot, "..", "public");

dotenv.config({ path: join(serverRoot, ".env") });
dotenv.config({ path: join(serverRoot, "..", ".env") });

const SHOWCASE_PATH = join(serverRoot, "ai-construction-showcase.json");
const BAK_PATH = join(serverRoot, "ai-construction-showcase.json.bak");

function parseJsonLoose(text) {
  const s = String(text || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : s;
  return JSON.parse(raw);
}

function nonEmpty(a, b) {
  const x = a != null && String(a).trim() ? a : b;
  return x != null && String(x).trim() ? x : "";
}

async function main() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.log("未设置 DEEPSEEK_API_KEY（可在 server/.env 或项目根 .env 配置），跳过生成。");
    process.exit(0);
  }

  if (!existsSync(SHOWCASE_PATH)) {
    console.error("缺少文件:", SHOWCASE_PATH);
    process.exit(1);
  }

  const allowed = loadPublicHtmlWhitelist(publicDir);
  const allowedList = [...allowed].sort();
  if (allowed.size === 0) {
    console.warn("警告：未扫描到 public/*.html，对齐将退化为", DEFAULT_FALLBACK);
  } else {
    console.log("路由白名单:", allowed.size, "个页面");
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(SHOWCASE_PATH, "utf8"));
  } catch (e) {
    console.error("JSON 解析失败:", e.message);
    process.exit(1);
  }

  const seed = JSON.stringify(
    {
      policy_refs: doc.policy_refs,
      ai_acceptance_intro: doc.ai_acceptance?.intro,
      gates: (doc.ai_acceptance?.gates || []).map((g) => ({
        name: g.name,
        priority: g.priority,
      })),
      existing_modules: (doc.dg_modules_extended || []).map((m) => m.module_id),
    },
    null,
    0
  );

  const userPrompt = `你是建筑工程标准与住宅精装数字化专家。请结合下列站点摘要 seed，并参照 **GB 50210-2018、GB 50327、GB 50242、GB 50325、DG/TJ08-2062-2025（住宅套内质量）** 与上海家装公约中「AI 验收 / 数据留存」叙事，输出 **仅一个 JSON 对象**（不要 Markdown），结构严格如下：

{
  "standard_benchmarks": {
    "caption": "一句话说明本表为宣讲对照骨架",
    "comparison_rows": [
      {
        "dimension": "维度名称",
        "gb_family": "国标/通用规范侧表述（避免编造具体条款编号，可写分部工程名）",
        "shanghai_dg": "上海团标 / AI 辅助条款侧表述",
        "system_hook": "映射到装修 SaaS：页面或闸口名（路径必须从下列 allowed_pages 中选）"
      }
    ]
  },
  "dg_modules_extended": [
    {
      "module_id": "dim|waterproof|hydraulic|hollow|iaq 之一",
      "name": "模块中文名",
      "dg_slot": "团标叙事要点",
      "gb_anchor": "可对照的国标维度",
      "ai_functions": ["含 DeepSeek 可承担的语义解读、报告草稿、条文检索类能力"],
      "evidence_chain": "证据链字段",
      "risk_if_gap": "缺 AI/数字化时的风险",
      "gates": ["闸口名称"],
      "pages": ["/xxx.html"]
    }
  ],
  "stage_feature_integration": {
    "caption": "一句话",
    "matrix": [
      {
        "stage": "环节名",
        "features": [
          { "name": "功能点", "pages": ["/页面路径"], "weight": "● 或 ○" }
        ]
      }
    ]
  }
}

**allowed_pages（pages 字段只能使用下列路径 + 可选 #锚点，禁止 invent 新文件名）：**
${JSON.stringify(allowedList, null, 0)}

要求：
1. comparison_rows 至少 8 条，覆盖防水、水电、抹灰/涂饰、门窗、吊顶、地面、室内环境、资料移交等中的多数。
2. dg_modules_extended 必须恰好 5 条且 module_id 覆盖 dim、waterproof、hydraulic、hollow、iaq；pages 每项来自 allowed_pages。
3. matrix 至少 7 个 stage，从方案/BIM 到质保/信用；features[].pages 全部来自 allowed_pages。
4. 全文简体中文；语气为「演示 / 宣讲」，勿写成法律承诺。

seed（上下文）：
${seed}`;

  const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你只输出合法 JSON，不要解释文字。键名与 schema 完全一致。pages 必须使用用户给出的 allowed_pages 列表中的路径。",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.45,
    }),
  });

  const raw = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("DeepSeek 请求失败:", raw?.error?.message || JSON.stringify(raw).slice(0, 400));
    process.exit(1);
  }

  const text = raw?.choices?.[0]?.message?.content ?? "";
  let generated;
  try {
    generated = parseJsonLoose(text);
  } catch (e) {
    console.error("解析模型 JSON 失败:", e.message);
    console.error("原始片段:", text.slice(0, 1200));
    process.exit(1);
  }

  const genBench = generated.standard_benchmarks || {};
  const genMods = generated.dg_modules_extended || [];
  const genStage = generated.stage_feature_integration || {};

  const mergedRows = mergeComparisonRows(
    doc.standard_benchmarks?.comparison_rows,
    genBench.comparison_rows
  );
  const captionBench = nonEmpty(genBench.caption, doc.standard_benchmarks?.caption);

  const MODULE_ORDER = ["dim", "waterproof", "hydraulic", "hollow", "iaq"];
  const baseModMap = Object.fromEntries((doc.dg_modules_extended || []).map((m) => [m.module_id, m]));
  const genModMap = Object.fromEntries(genMods.map((m) => [m.module_id, m]));
  const mergedModules = MODULE_ORDER.map((id) =>
    mergeDgModule(baseModMap[id] || {}, genModMap[id] || {}, allowed, id)
  ).filter((m) => m && m.module_id);

  const mergedMatrix = mergeStageFeatures(genStage.matrix, doc.stage_feature_integration, allowed);
  const captionStage = nonEmpty(genStage.caption, doc.stage_feature_integration?.caption);

  const next = {
    ...doc,
    standard_benchmarks: {
      caption: captionBench,
      comparison_rows: alignStandardBenchmarksRows(mergedRows, allowed),
    },
    dg_modules_extended: mergedModules,
    stage_feature_integration: {
      caption: captionStage,
      matrix: mergedMatrix,
    },
    deepseek_meta: {
      ...(doc.deepseek_meta || {}),
      usage_note:
        (doc.deepseek_meta && doc.deepseek_meta.usage_note) ||
        "DeepSeek 生成后与现有 JSON 合并，并已按 public/*.html 白名单自动对齐路由。",
      generated_hint: `DeepSeek 刷新 ${new Date().toISOString().slice(0, 19)}Z · 白名单 ${allowed.size} 页 · 路由已 align`,
      allowed_pages_count: allowed.size,
    },
  };

  copyFileSync(SHOWCASE_PATH, BAK_PATH);
  writeFileSync(SHOWCASE_PATH, JSON.stringify(next, null, 2), "utf8");
  console.log("已写入", SHOWCASE_PATH);
  console.log("备份", BAK_PATH);
  console.log("抽样对齐: contract-ai ->", alignOnePage("/contract-ai", allowed), "| 臆造 ->", alignOnePage("/bim-review.html", allowed));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
