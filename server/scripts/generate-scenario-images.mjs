#!/usr/bin/env node
/**
 * 批量调用 Wavespeed 为 scenario-image-specs.json 出图，写入 scenario-image-urls.generated.json。
 * 可选：DEEPSEEK_API_KEY 存在时先批量优化英文 prompt。
 *
 * 用法（在 server 目录）：npm run scenario:images
 * 环境：WAVESPEED_API_KEY 必填；可选 DEEPSEEK_API_KEY、SCENARIO_IMAGE_DELAY_MS、SCENARIO_IMAGE_LIMIT、WAVESPEED_TEXT_TO_IMAGE_MODEL
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { generateWavespeedImage } from "../lib/wavespeed-generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
dotenv.config({ path: join(serverRoot, ".env") });
dotenv.config({ path: join(serverRoot, "..", ".env") });

const SPECS_PATH = join(serverRoot, "scenario-image-specs.json");
const OUT_PATH = join(serverRoot, "scenario-image-urls.generated.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {unknown} text */
function parseJsonLoose(text) {
  const s = String(text || "").trim();
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

/**
 * @param {Array<{ id: string; prompt_en: string }>} specs
 * @param {string} apiKey
 */
async function refinePromptsWithDeepSeek(specs, apiKey) {
  const payload = specs.map((s) => ({ id: s.id, prompt_en: s.prompt_en }));
  const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You enrich English text-to-image prompts for Chinese residential interior renovation (typical 90–140㎡ apartment). Keep each scene type faithful to the id meaning. Output ONLY a JSON object mapping id -> full English prompt string. No markdown fences, no commentary.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 400);
    throw new Error(`DeepSeek: ${msg}`);
  }
  const text = json?.choices?.[0]?.message?.content ?? "";
  let map;
  try {
    map = parseJsonLoose(text);
  } catch {
    throw new Error(`DeepSeek 返回非 JSON：${text.slice(0, 500)}`);
  }
  if (typeof map !== "object" || map === null) {
    throw new Error("DeepSeek 返回格式错误");
  }
  return specs.map((s) => ({
    ...s,
    prompt_en: typeof map[s.id] === "string" && map[s.id].trim() ? map[s.id].trim() : s.prompt_en,
  }));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipDeepseek =
    process.argv.includes("--skip-deepseek") || (dryRun && !process.argv.includes("--with-deepseek"));

  if (!existsSync(SPECS_PATH)) {
    console.error("缺少文件:", SPECS_PATH);
    process.exit(1);
  }

  /** @type {Array<{ id: string; prompt_en: string; zone?: string }>} */
  let specs = JSON.parse(readFileSync(SPECS_PATH, "utf8"));
  const limit = Number(process.env.SCENARIO_IMAGE_LIMIT || 0);
  if (limit > 0) specs = specs.slice(0, limit);

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!skipDeepseek && deepseekKey) {
    console.log("DeepSeek：优化提示词…");
    specs = await refinePromptsWithDeepSeek(specs, deepseekKey);
  } else if (!skipDeepseek && !deepseekKey) {
    console.log("未设置 DEEPSEEK_API_KEY，跳过提示词优化（可用 --skip-deepseek 抑制本提示）");
  }

  const delayMs = Number(process.env.SCENARIO_IMAGE_DELAY_MS || 1500);
  /** @type {Record<string, string>} */
  const existing = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
    : {};

  const result = { ...existing };

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const prompt = s.prompt_en;
    if (!prompt) {
      console.warn("跳过（无 prompt_en）:", s.id);
      continue;
    }
    console.log(`[${i + 1}/${specs.length}] ${s.id} (${s.zone || ""})`);
    if (dryRun) {
      console.log("  prompt:", prompt.slice(0, 120) + "…");
      continue;
    }
    try {
      const url = await generateWavespeedImage(prompt, process.env);
      result[s.id] = url;
      writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), "utf8");
      console.log("  →", url.slice(0, 80) + "…");
    } catch (e) {
      console.error("  ✗", e.message || e);
      process.exitCode = 1;
    }
    if (i < specs.length - 1) await sleep(delayMs);
  }

  if (dryRun) {
    console.log("--dry-run：未调用 Wavespeed");
    return;
  }

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), "utf8");
  console.log("已写入", OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
