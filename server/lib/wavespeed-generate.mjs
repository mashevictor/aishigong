/**
 * 供 CLI 脚本调用：提交 Wavespeed 文生图并轮询结果（不经过 Express、不写 ai_logs）。
 */
export function extractImageUrl(payload) {
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

export async function wavespeedPoll(predictionId, apiKey, maxWaitMs = 120000) {
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

/**
 * @param {string} prompt
 * @param {NodeJS.ProcessEnv} env
 */
export async function generateWavespeedImage(prompt, env) {
  const apiKey = env.WAVESPEED_API_KEY;
  if (!apiKey) throw new Error("未配置 WAVESPEED_API_KEY");
  const model =
    env.WAVESPEED_TEXT_TO_IMAGE_MODEL || "wavespeed-ai/flux-dev";
  const base = "https://api.wavespeed.ai/api/v3";
  const url = `${base}/${model.replace(/^\//, "")}`;

  const body = {
    prompt,
    size: "1024*1024",
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    seed: -1,
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
    const raw =
      submitJson?.message ||
      submitJson?.error ||
      JSON.stringify(submitJson).slice(0, 400);
    let hint = "";
    if (submit.status === 404) {
      hint =
        "（404 多为模型路径错误：请在控制台或文档核对当前文生图 slug，官方示例为 wavespeed-ai/flux-dev）";
    }
    throw new Error((raw || submit.statusText || "提交文生图失败") + hint + ` [HTTP ${submit.status}]`);
  }

  const predId =
    submitJson?.data?.id ||
    submitJson?.id ||
    submitJson?.data?.prediction_id ||
    submitJson?.prediction_id;

  if (!predId) {
    const immediate = extractImageUrl(submitJson);
    if (immediate) return immediate;
    throw new Error("未返回任务 ID：" + JSON.stringify(submitJson).slice(0, 300));
  }

  return wavespeedPoll(predId, apiKey);
}
