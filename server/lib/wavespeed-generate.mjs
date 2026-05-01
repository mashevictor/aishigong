/**
 * WaveSpeed 文生图（与 product_test/server/scripts/wavespeed_text_to_image.js 行为对齐）。
 * - POST https://api.wavespeed.ai/api/v3/{modelId}
 * - Wan 系 body：enable_prompt_expansion、prompt、seed、size；404 时自动尝试备用模型
 * - 轮询：优先 data.urls.get，否则 GET /api/v3/{modelId}/{taskId}
 * - FLUX 等模型：路径含 flux 且不含 wan 时使用 num_inference_steps / guidance_scale 等 body
 */

const WAVESPEED_BASE = "https://api.wavespeed.ai";

export const WAVESPEED_T2I_ALLOWED_SIZES = new Set([
  "1024*1024",
  "720*1280",
  "1280*720",
  "768*1344",
  "1344*768",
  "1024*1536",
  "1536*1024",
]);

/** @param {unknown} data */
export function extractImageUrl(data) {
  if (!data || typeof data !== "object") return null;
  const d = data.data != null ? data.data : data;
  const output = d.outputs ?? d.output ?? d.images ?? d.result;
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
    if (first?.uri) return first.uri;
    if (first?.image) return first.image;
  }
  if (output && typeof output === "object") {
    if (output.image ?? output.url) return output.image ?? output.url;
  }
  if (d.url && /^https?:\/\//i.test(d.url)) return d.url;
  if (Array.isArray(d.urls) && d.urls[0]) return d.urls[0];
  return null;
}

function wavespeedErrorMessage(respText) {
  try {
    const o = JSON.parse(respText);
    const msg =
      o.detail ??
      o.message ??
      o.error ??
      (Array.isArray(o.detail) ? o.detail[0]?.msg : null);
    return typeof msg === "string" ? msg : msg ? JSON.stringify(msg).slice(0, 300) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} pollUrl
 * @param {string} apiKey
 * @param {number} maxWaitMs
 * @param {'image'} [_kind]
 */
export async function wavespeedPollUntilDone(pollUrl, apiKey, maxWaitMs, _kind = "image") {
  const step = 3000;
  const deadline = Date.now() + (maxWaitMs || 300000);
  const pollOnce = async () => {
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return {
      ok: pollRes.ok,
      status: pollRes.status,
      data: pollRes.ok ? await pollRes.json().catch(() => ({})) : null,
      text: pollRes.ok ? "" : await pollRes.text().catch(() => ""),
    };
  };
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, step));
    let poll = await pollOnce();
    if (!poll.ok && poll.status === 429) {
      for (let i = 0; i < 2; i++) {
        await new Promise((r) => setTimeout(r, 20000));
        poll = await pollOnce();
        if (poll.ok) break;
      }
    }
    if (!poll.ok) {
      const err =
        poll.status === 429 ? "请求过于频繁，请稍后再试" : `Poll ${poll.status}`;
      return { status: "error", error: err };
    }
    const pollData = poll.data;
    const pollPayload = pollData.data != null ? pollData.data : pollData;
    const s = pollPayload.status ?? pollData.status ?? pollPayload.state;
    if (s === "succeeded" || s === "completed" || s === "success") {
      const imageUrl =
        extractImageUrl(pollPayload) ?? extractImageUrl(pollData);
      return { status: "succeeded", image_url: imageUrl };
    }
    if (s === "failed" || s === "canceled" || s === "error") {
      return {
        status: "failed",
        error: pollPayload.error ?? pollData.error ?? pollPayload.logs ?? "生成失败",
      };
    }
  }
  return { status: "timeout", error: "生成超时" };
}

/**
 * @param {string} modelId
 * @param {string} prompt
 * @param {string} size
 * @param {number} seed
 * @param {Record<string, unknown>} extra
 */
function buildTextToImageBody(modelId, prompt, size, seed, extra = {}) {
  const isFluxStyle =
    /flux/i.test(modelId) && !/alibaba\/wan|wan-2/i.test(modelId);
  if (isFluxStyle) {
    return {
      prompt: String(prompt).trim(),
      size,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      seed,
      ...extra,
    };
  }
  const body = {
    enable_prompt_expansion: false,
    prompt: String(prompt).trim(),
    seed,
    size,
    ...extra,
  };
  return body;
}

/**
 * @param {string} prompt
 * @param {{ size?: string, seed?: number, negativePrompt?: string, extraBody?: Record<string, unknown> }} [options]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<{ success: boolean, image_url?: string | null, message?: string, status?: number }>}
 */
export async function wavespeedTextToImage(prompt, options = {}, env = process.env) {
  const apiKey = String(env.WAVESPEED_API_KEY || "").trim();
  if (!apiKey || !prompt) {
    return { success: false, image_url: null, message: "未配置 WAVESPEED_API_KEY 或缺少 prompt" };
  }

  const modelPrimary =
    String(env.WAVESPEED_TEXT_TO_IMAGE_MODEL || "alibaba/wan-2.6/text-to-image").trim() ||
    "alibaba/wan-2.6/text-to-image";
  const modelAlt =
    String(
      env.WAVESPEED_TEXT_TO_IMAGE_MODEL_ALT || "alibaba/alibaba-wan-2.6-text-to-image"
    ).trim() || "alibaba/alibaba-wan-2.6-text-to-image";

  const sizeRaw = options && typeof options.size === "string" ? options.size.trim() : "";
  const size =
    sizeRaw && WAVESPEED_T2I_ALLOWED_SIZES.has(sizeRaw) ? sizeRaw : "1024*1024";

  let seed = -1;
  if (options && options.seed != null) {
    const n = parseInt(String(options.seed), 10);
    if (Number.isFinite(n) && n >= 0) seed = n % 2147483647;
  }

  const neg =
    options && typeof options.negativePrompt === "string"
      ? options.negativePrompt.trim()
      : "";

  const tryModel = async (modelId) => {
    const body = buildTextToImageBody(modelId, prompt, size, seed, options?.extraBody || {});
    if (neg && !/flux/i.test(modelId)) body.negative_prompt = neg;

    const url = `${WAVESPEED_BASE}/api/v3/${modelId}`;
    const prediction = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const respText = await prediction.text();
    return { prediction, respText, modelId };
  };

  try {
    let result = await tryModel(modelPrimary);
    if (!result.prediction.ok && result.prediction.status === 404 && modelPrimary !== modelAlt) {
      result = await tryModel(modelAlt);
    }

    const { prediction, respText, modelId } = result;
    if (!prediction.ok) {
      const status = prediction.status;
      let message = wavespeedErrorMessage(respText);
      if (status === 429) {
        message = message || "生成次数已达上限或额度已用尽，请明日再试或联系管理员";
      } else if (status >= 500) {
        message = message || "文生图服务暂时异常，请稍后重试";
      } else {
        message = message || `请求失败: ${status}`;
      }
      if (status === 404) {
        message +=
          "（若持续 404，请在 WaveSpeed 控制台核对模型 slug，或设置 WAVESPEED_TEXT_TO_IMAGE_MODEL，例如 wavespeed-ai/alibaba/wan-2.6/text-to-image 或 wavespeed-ai/flux-dev）";
      }
      return { success: false, image_url: null, message, status };
    }

    let data;
    try {
      data = JSON.parse(respText);
    } catch {
      return { success: false, image_url: null, message: "WaveSpeed 返回格式异常" };
    }

    const payload = data.data != null ? data.data : data;
    const id =
      payload.id ?? data.id ?? payload.prediction_id ?? payload.task_id;
    const pollUrl =
      payload.urls?.get ?? (id ? `${WAVESPEED_BASE}/api/v3/${modelId}/${id}` : null);

    if (!pollUrl) {
      const imageUrl = extractImageUrl(payload) ?? extractImageUrl(data);
      return {
        success: !!imageUrl,
        image_url: imageUrl,
        message: imageUrl ? undefined : "未解析到图片 URL",
      };
    }

    const pollResult = await wavespeedPollUntilDone(pollUrl, apiKey, 120000, "image");
    if (pollResult.status === "succeeded") {
      return { success: true, image_url: pollResult.image_url };
    }
    const errMsg = pollResult.error || "生成失败";
    return {
      success: false,
      image_url: null,
      message: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, image_url: null, message: msg || "文生图服务异常" };
  }
}

/**
 * CLI 用：成功返回 URL，失败抛错（便于脚本中断）。
 * @param {string} prompt
 * @param {NodeJS.ProcessEnv} env
 */
export async function generateWavespeedImage(prompt, env) {
  const r = await wavespeedTextToImage(prompt, {}, env);
  if (!r.success) {
    throw new Error(r.message || "文生图失败");
  }
  if (!r.image_url) {
    throw new Error("文生图成功但未返回 URL");
  }
  return r.image_url;
}
