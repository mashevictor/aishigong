# AI + 智能建造矩阵 · AI 验收闸口 — 功能说明（演示站）

> 对应页面：`/ai-showcase.html`  
> 服务端配置：`server/ai-construction-showcase.json`（经 `GET /api/meta/ai-showcase` 输出）  
> 静态降级：`public/assets/ai-showcase-fallback.json`（仅静态部署、无 Node 接口时由页面自动拉取）

---

## 1. BIM 是什么？

**BIM（Building Information Modeling，建筑信息模型）**在工程语境里指：用软件建立**可计算、带业务属性的建筑数字表达**，而不仅是三维效果图。

- **几何**：墙、板、柱、门窗洞口、机电管线等的空间关系。  
- **属性**：材料规格、做法、安装工序、构件编码、版本与变更。  
- **用途**：专业协同、碰撞检查、工程量统计、施工深化与**数字化验收对照**。

常见误解：BIM = 做一张好看的效果图或漫游动画。  
正解：效果呈现只是副产品；核心是**构件级信息**能否支撑「按图施工、按模型验收」。

### LOD（精细度）简述

**LOD（Level of Detail）**表示模型在不同阶段的精细程度。家装/精装演示通常强调**关键节点**达到可对照施工图与验收的深度（叙事上常称 LOD300～LOD350 区间），而非全屋超高精度扫描。

### BIM 与二维施工图的关系

| 维度 | 传统二维为主 | BIM / 模型化 |
| --- | --- | --- |
| 空间表达 | 多张图叠图，靠经验脑补 | 三维一体，平立剖联动 |
| 协同 | 错漏碰缺靠会审与现场补救 | 管线碰撞等可预先检测并留痕 |
| 变更 | 蓝图注释分散 | 构件级变更可版本化（依赖企业管理） |
| 对接 AI 验收 | 抽检面有限 | 可提供节点摘要与净尺寸链，供与影像/测距/曲线比对 |

---

## 2. AI 验收点是什么？

**AI 验收点**指：在合同或标准约定的工序**闸口**上，由 AI（影像识别、传感器读数、规则/BIM 比对等）形成**结构化结论并留痕**，用于：

- 是否允许进入**下一道工序**；  
- 是否满足**节点付款**就绪条件（与合同演示联动）；  
- 是否满足**监管/协会抽检**与信用叙事所需的**数据留存**。

与「拍几张照片应付」的区别：需要**可比对目标（图纸/模型/阈值）+ 原始传感或影像 + 算法版本快照**，形成可复核证据链。

---

## 3. 本页模块说明（与站内路由）

| 区块 | 含义 | 主要跳转 |
| --- | --- | --- |
| AI 验收闸口 | 隐蔽 / 泥木 / 竣工 / 质保 四闸口与合规纲要 | 锚点 `#acceptance` |
| 国标/团标对照 | GB 与 DG/TJ08 叙事对照（宣讲骨架） | `#standardsDeepseek` |
| 五大模块深化 | 尺寸、防水、水电、空鼓、空气质量 | multimodal、scenario 等 |
| 环节 × 功能矩阵 | 生命周期 × 功能映射 | 见 JSON `stage_feature_integration` |
| 五维能力矩阵 | 设计—装备—过程—绿色安全—生态人才 | 政策 chips |

推荐站内联动：**multimodal.html**（多模态对照）、**contract-ai.html**（合同与付款节点）、**scenario-120.html**（120㎡ 主线叙事）。

---

## 4. 「生成功能」说明

页面提供 **导出 Markdown**：在浏览器本地根据当前已加载的 JSON 拼接 `.md` 文件并下载，**不经过服务器生成接口**，便于归档与打印宣讲稿。

完整书面版亦可直接下载本文件：`/docs/ai-showcase-guide.md`。

---

## 5. 部署注意事项（避免线上空白）

若线上仅有 Nginx/静态资源、**未反代** Node 的 `/api/meta/ai-showcase`，浏览器会因接口失败而空白。  
对策：

1. **配置反向代理**：`/api/` 指向 Node 服务；或  
2. **保留并更新** `public/assets/ai-showcase-fallback.json`（与 `server/ai-construction-showcase.json` 同步）。  

发布脚本示例（自行适配 CI）：

```bash
cp server/ai-construction-showcase.json public/assets/ai-showcase-fallback.json
```

---

## 6. DeepSeek 与数据刷新

在 `server` 目录配置 `.env` 中 `DEEPSEEK_API_KEY` 后，可执行：

```bash
npm run showcase:deepseek
```

脚本会合并 DeepSeek 输出，并按 `public/*.html` **白名单自动校正路由**（详见 `server/lib/showcase-route-align.mjs`）。

---

*文档版本随仓库迭代；法规与标准条文请以正式出版物为准。*
