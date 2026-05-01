# 案例驱动验收：最小 REST 接口契约（v0.2 草案）

面向产品化：以 **项目案例 `case_id`（演示固定为 `PRJ-DEMO-001`）** 串起闸口、证据与付款就绪度。当前仓库中 **已实现** 的为 `GET /api/meta/*` 演示数据；**未实现** 的 ` /api/v1/...` 为 backlog，字段名与下文实体一致即可平滑落地。

---

## 1. 设计原则

- **案例为根**：所有验收记录、影像、AI 结论均带 `case_id` + `zone`（房间标签）。
- **闸口编排**：隐蔽 → 泥木中期 → 竣工 → 质保，与 `ai-showcase` 叙事一致。
- **双验**：`ai_verdict` 仅为草稿，必经 `human_signoff`。
- **防扯皮**：证据带 `content_hash` + `captured_at`，合同与图纸带 `version_id`（后续版本加字段）。

---

## 2. 实体摘要

| 实体 | 说明 |
|------|------|
| `Case` | 项目案例主数据：面积、状态、闸口模板 |
| `AcceptanceGate` | 闸口实例及状态；可 `blocks_payment_ready` |
| `EvidenceArtifact` | 单条证据：图、PDF、曲线、测距集合 |
| `AcceptanceRecord` | 某闸口某模块的一条验收结论（含 AI 草稿与人签） |
| `PaymentReadiness` | 付款节点就绪度评分与阻塞闸口列表 |

完整字段见 **`server/case-flow-contract.min.json`** 或 **`GET /api/meta/case-flow-contract`**。

---

## 3. 已实现（演示环境，可匿名）

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/meta/case-flow-contract` | 返回本契约 JSON |
| GET | `/api/meta/scenario` | 120㎡ 案例主线 + **room_cases（按房间争议与 AI 价值）** |
| GET | `/api/meta/ai-showcase` | 五维矩阵 + 验收闸口 + 国标对照 |
| GET | `/api/meta/procurement-ai` | 合同/价差/工时演示 |

---

## 4. 产品化 Backlog（建议下一迭代）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/cases/{caseId}` | 案例详情 |
| GET | `/api/v1/cases/{caseId}/gates` | 闸口列表与状态 |
| GET | `/api/v1/cases/{caseId}/gates/{gateId}/records` | 验收记录分页 |
| POST | `/api/v1/cases/{caseId}/gates/{gateId}/evidence` | 批量上传证据元数据（文件先直传 OSS） |
| POST | `/api/v1/cases/{caseId}/gates/{gateId}/ai-evaluate` | 触发 AI 评估（异步可返回 job_id） |
| PATCH | `/api/v1/cases/{caseId}/gates/{gateId}/records/{recordId}/signoff` | 人工签认 / 驳回理由 |
| GET | `/api/v1/cases/{caseId}/payment-readiness` | 与合同里程碑对齐的就绪度 |

---

## 5. 与「按房间案例」数据的对应关系

结构化按房间争议点见 **`server/scenario-120-room-cases.json`**，经 `GET /api/meta/scenario` 的 **`room_cases`** 输出；每条 `pain_points[]` 含：

- `dispute`：争议场景（给销售/法务叙事）
- `ai_value`：AI 可交付的举证/比对/聚合能力（非法律承诺）
- `acceptance_gate` / `dg_module`：对齐闸口与上海团标五大模块演示

刷新（可选）：`npm run case:rooms-deepseek`（需 `DEEPSEEK_API_KEY`）。

---

## 6. 错误与安全（生产）

- 统一 `{ error, code?, details? }`。
- 除 meta 演示外，建议 **`Authorization: Bearer <JWT>`** + RBAC。
- 上传限制：`Content-Length`、MIME 校验、病毒扫描（外包）。

---

*条文与合规边界以正式合同与法规为准；本文为产品与前端对齐用。*
