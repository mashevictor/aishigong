/**
 * 演示用外链图（Picsum 固定 seed）+ 本站占位 SVG。
 * 「120㎡ 全案装修」场景：区分房间、效果图 vs 现场实拍。
 * 若存在 scenario-image-urls.generated.json（npm run scenario:images），则优先使用 Wavespeed 出图 URL。
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LOCAL_FALLBACK = "/assets/demo/concrete.svg";

function loadScenario120FromSpecs() {
  const specsPath = join(__dirname, "scenario-image-specs.json");
  const generatedPath = join(__dirname, "scenario-image-urls.generated.json");
  if (!existsSync(specsPath)) {
    return null;
  }
  let specs;
  try {
    specs = JSON.parse(readFileSync(specsPath, "utf8"));
  } catch {
    return null;
  }
  let urlMap = {};
  if (existsSync(generatedPath)) {
    try {
      urlMap = JSON.parse(readFileSync(generatedPath, "utf8"));
    } catch {
      urlMap = {};
    }
  }
  const noteKey = "工序要点";
  return specs.map((s) => ({
    id: s.id,
    zone: s.zone,
    photo_kind: s.photo_kind,
    caption: s.caption,
    url: urlMap[s.id] || s.fallback_url,
    ...(s[noteKey] ? { construction_note: s[noteKey] } : {}),
  }));
}

const _scenario120 = loadScenario120FromSpecs();

/** 通用图库（工作台 / 客户视图轮播） */
export const DEMO_GALLERY = [
  { id: "g1", caption: "模拟·主体结构外立面", url: "https://picsum.photos/seed/aishi-g1/800/450", tags: ["进度", "外观"] },
  { id: "g2", caption: "模拟·钢筋绑扎验收前", url: "https://picsum.photos/seed/aishi-g2/800/450", tags: ["隐蔽工程"] },
  { id: "g3", caption: "模拟·幕墙龙骨安装", url: "https://picsum.photos/seed/aishi-g3/800/450", tags: ["幕墙"] },
  { id: "g4", caption: "模拟·卫生间防水闭水", url: "https://picsum.photos/seed/aishi-g4/800/450", tags: ["防水"] },
  { id: "g5", caption: "模拟·现场材料堆放区", url: "https://picsum.photos/seed/aishi-g5/800/450", tags: ["材料"] },
  { id: "g6", caption: "模拟·安全通道与围挡", url: "https://picsum.photos/seed/aishi-g6/800/450", tags: ["安全文明"] },
];

/** specs 缺失或损坏时的内置列表（与早期演示一致） */
const LEGACY_SCENARIO_120_GALLERY = [
  { zone: "客厅", photo_kind: "效果图", caption: "客厅｜效果图 · 电视墙与无主灯方案", url: "https://picsum.photos/seed/aishi-rm-living-eff/960/540" },
  { zone: "客厅", photo_kind: "现场实拍", caption: "客厅｜现场 · 吊顶龙骨放线完成", url: "https://picsum.photos/seed/aishi-rm-living-site1/960/540" },
  { zone: "客厅", photo_kind: "现场实拍", caption: "客厅｜现场 · 地砖铺贴完成·成品保护", url: "https://picsum.photos/seed/aishi-rm-living-site2/960/540" },
  { zone: "主卧", photo_kind: "效果图", caption: "主卧｜效果图 · 床头背景与衣柜一体化", url: "https://picsum.photos/seed/aishi-rm-bed-eff/960/540" },
  { zone: "主卧", photo_kind: "现场实拍", caption: "主卧｜现场 · 墙面腻子打磨·等待乳胶漆", url: "https://picsum.photos/seed/aishi-rm-bed-site/960/540" },
  { zone: "厨房", photo_kind: "效果图", caption: "厨房｜效果图 · U 型橱柜与电器位", url: "https://picsum.photos/seed/aishi-rm-kitch-eff/960/540" },
  { zone: "厨房", photo_kind: "现场实拍", caption: "厨房｜现场 · 瓷砖铺贴·烟道止逆阀安装", url: "https://picsum.photos/seed/aishi-rm-kitch-site/960/540" },
  { zone: "卫生间", photo_kind: "效果图", caption: "卫生间｜效果图 · 干湿分离布局", url: "https://picsum.photos/seed/aishi-rm-bath-eff/960/540" },
  { zone: "卫生间", photo_kind: "现场实拍", caption: "卫生间｜现场 · 防水涂刷第二遍·闭水前", url: "https://picsum.photos/seed/aishi-rm-bath-site1/960/540" },
  { zone: "卫生间", photo_kind: "整改前后", caption: "卫生间｜整改 · 地漏坡度复查（二次找平）", url: "https://picsum.photos/seed/aishi-rm-bath-fix/960/540" },
  { zone: "阳台", photo_kind: "效果图", caption: "阳台｜效果图 · 家政柜与洗烘叠放", url: "https://picsum.photos/seed/aishi-rm-balc-eff/960/540" },
  { zone: "阳台", photo_kind: "现场实拍", caption: "阳台｜现场 · 窗外渗水点外墙涂刷（雨后复查）", url: "https://picsum.photos/seed/aishi-rm-balc-site/960/540" },
];

/**
 * 120㎡ 演示场景专用图集：房间 ×（效果图｜现场实拍｜整改）
 * 与客户 / 经理 / 工人端「按房间」对照使用。
 */
export const SCENARIO_120_GALLERY =
  _scenario120 && _scenario120.length > 0 ? _scenario120 : LEGACY_SCENARIO_120_GALLERY;

function orderedZones(gallery) {
  const seen = new Set();
  const rooms = [];
  for (const g of gallery) {
    if (!seen.has(g.zone)) {
      seen.add(g.zone);
      rooms.push(g.zone);
    }
  }
  return rooms;
}

export const SCENARIO_120_ROOMS = orderedZones(SCENARIO_120_GALLERY);

/** 主演示项目封面：优先客厅效果图（生成图或 Picsum） */
export const SCENARIO_120_COVER =
  SCENARIO_120_GALLERY.find((g) => g.zone === "客厅" && g.photo_kind === "效果图")?.url ||
  "https://picsum.photos/seed/aishi-120-living-cover/1200/675";

export const DEMO_PROJECT_COVERS = {
  "PRJ-DEMO-001": SCENARIO_120_COVER,
  "PRJ-DEMO-002": "https://picsum.photos/seed/aishi-office-renov/1200/675",
};

/** 供 /api/meta/scenario 与静态页使用的结构化说明 */
export function getScenario120Meta() {
  return {
    id: "scenario-120",
    title: "滨江花园 · 120㎡ 全案精装（演示主线）",
    area_sqm: 120,
    project_code: "PRJ-DEMO-001",
    rooms: SCENARIO_120_ROOMS,
    gallery: SCENARIO_120_GALLERY,
    renovation_phases: [
      {
        phase: "隐蔽工程",
        items: ["水电改造（强弱电箱、线管弯径）", "卫生间与阳台防水涂刷", "地暖 / 打压记录"],
      },
      {
        phase: "硬装",
        items: ["瓦工地砖墙砖与找平", "木工吊顶与窗帘盒", "油工腻子打磨与乳胶漆"],
      },
      {
        phase: "安装与交付",
        items: ["橱柜卫浴五金", "地板与室内门", "开关灯具与保洁交付"],
      },
    ],
    role_flow: [
      {
        role: "客户",
        summary: "在业主端查看效果图对照、进度百分比、里程碑与留言；可在质保期提交工单。",
        pages: ["/portal.html", "/client.html", "/tickets.html"],
      },
      {
        role: "项目经理",
        summary: "派单与验收节点、材料到货核对、看板汇总异常工单与任务状态分布。",
        pages: ["/portal.html", "/manager.html", "/materials.html", "/index.html"],
      },
      {
        role: "工人",
        summary: "极简视图更新任务状态、上传现场影像记录（URL）、查看归属工序。",
        pages: ["/portal.html", "/worker.html"],
      },
      {
        role: "售后",
        summary: "受理报修、回访与工单状态流转。",
        pages: ["/portal.html", "/tickets.html"],
      },
      {
        role: "管理员",
        summary: "项目与成员授权、封面图、AI 调用留痕与运营统计。",
        pages: ["/admin.html", "/multimodal.html"],
      },
    ],
    typical_issues: [
      "卫生间地漏异响 / 坡度积水 → 工单 + 整改影像",
      "阳台窗框渗水 → 雨后现场拍照 + 工单优先级 P0",
      "乳胶漆色差 → 任务「整改中」+ 现场比对照片",
    ],
  };
}
