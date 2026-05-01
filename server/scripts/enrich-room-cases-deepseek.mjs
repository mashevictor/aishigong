#!/usr/bin/env node
/**
 * 调用 DeepSeek 为 scenario-120-room-cases.json 按房间补充争议点（merge，非覆盖）。
 *
 * 用法（server 目录）：npm run case:rooms-deepseek
 * 环境：DEEPSEEK_API_KEY；可选 DEEPSEEK_MODEL
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
dotenv.config({ path: join(serverRoot, ".env") });
dotenv.config({ path: join(serverRoot, "..", ".env") });

const PATH_JSON = join(serverRoot, "scenario-120-room-cases.json");
const BAK_PATH = join(serverRoot, "scenario-120-room-cases.json.bak");

function parseJsonLoose(text) {
  const s = String(text || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : s;
  return JSON.parse(raw);
}

async function main() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.log("未设置 DEEPSEEK_API_KEY，跳过。");
    process.exit(0);
  }
  if (!existsSync(PATH_JSON)) {
    console.error("缺少", PATH_JSON);
    process.exit(1);
  }

  let doc = JSON.parse(readFileSync(PATH_JSON, "utf8"));
  const zones = (doc.room_cases || []).map((r) => ({
    zone_key: r.zone_key,
    zone_label: r.zone_label,
    existing_titles: (r.pain_points || []).map((p) => p.title),
  }));

  const prompt = `你是家装工程质量与交付争议顾问。已知演示案例「滨江花园 120㎡」按房间的争议骨架如下（zone_key + 已有痛点标题）：
${JSON.stringify(zones, null, 2)}

请再为 **每个 zone_key 补充 1～2 条** 行业内「高发 / 扯皮多」的痛点，输出 **仅 JSON**：
{
  "supplements": [
    {
      "zone_key": "与输入一致",
      "pain_points": [
        {
          "title": "短标题",
          "dispute": "甲乙双方争议焦点叙述",
          "ai_value": "AI 侧可做证据链/比对/聚类的价值（不写法律承诺）",
          "acceptance_gate": "隐蔽工程|泥木中期|竣工验收|质保 之一",
          "dg_module": "dim|waterproof|hydraulic|hollow|iaq|other",
          "evidence": "建议留存字段或介质"
        }
      ]
    }
  ]
}

要求：简体中文；标题勿与 existing_titles 重复；每条 dispute 不少于 40 字；ai_value 不少于 35 字。`;

  const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: "只输出合法 JSON，不要 Markdown。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.55,
    }),
  });

  const raw = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("DeepSeek失败:", raw?.error?.message || JSON.stringify(raw).slice(0, 400));
    process.exit(1);
  }

  const text = raw?.choices?.[0]?.message?.content ?? "";
  let gen;
  try {
    gen = parseJsonLoose(text);
  } catch (e) {
    console.error("解析 JSON 失败:", e.message);
    console.error(text.slice(0, 800));
    process.exit(1);
  }

  const byZone = new Map((doc.room_cases || []).map((rc) => [rc.zone_key, rc]));
  for (const block of gen.supplements || []) {
    const rc = byZone.get(block.zone_key);
    if (!rc) continue;
    const titles = new Set((rc.pain_points || []).map((p) => p.title));
    for (const p of block.pain_points || []) {
      if (!p || !p.title || titles.has(p.title)) continue;
      titles.add(p.title);
      rc.pain_points = rc.pain_points || [];
      rc.pain_points.push({
        title: p.title,
        dispute: p.dispute || "",
        ai_value: p.ai_value || "",
        acceptance_gate: p.acceptance_gate || "竣工验收",
        dg_module: p.dg_module || "other",
        evidence: p.evidence || "",
      });
    }
  }

  doc.meta = doc.meta || {};
  doc.meta.deepseek_supplemented_at = new Date().toISOString();

  copyFileSync(PATH_JSON, BAK_PATH);
  writeFileSync(PATH_JSON, JSON.stringify(doc, null, 2), "utf8");
  console.log("已合并写入", PATH_JSON, "备份", BAK_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
