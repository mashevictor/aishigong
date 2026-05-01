/**
 * 演示用外链图（Picsum 固定 seed，便于稳定加载）+ 本站占位 SVG。
 * 若外网受限，前端可对 img onerror 切换到 /assets/demo/*.svg
 */
export const LOCAL_FALLBACK = "/assets/demo/concrete.svg";

export const DEMO_PROJECT_COVERS = {
  "PRJ-DEMO-001": "https://picsum.photos/seed/aishi-site1/1200/675",
  "PRJ-DEMO-002": "https://picsum.photos/seed/aishi-site2/1200/675",
};

/** 模拟「现场图库 / 进度影像」——与具体项目可任意关联展示 */
export const DEMO_GALLERY = [
  { id: "g1", caption: "模拟·主体结构外立面", url: "https://picsum.photos/seed/aishi-g1/800/450", tags: ["进度", "外观"] },
  { id: "g2", caption: "模拟·钢筋绑扎验收前", url: "https://picsum.photos/seed/aishi-g2/800/450", tags: ["隐蔽工程"] },
  { id: "g3", caption: "模拟·幕墙龙骨安装", url: "https://picsum.photos/seed/aishi-g3/800/450", tags: ["幕墙"] },
  { id: "g4", caption: "模拟·卫生间防水闭水", url: "https://picsum.photos/seed/aishi-g4/800/450", tags: ["防水"] },
  { id: "g5", caption: "模拟·现场材料堆放区", url: "https://picsum.photos/seed/aishi-g5/800/450", tags: ["材料"] },
  { id: "g6", caption: "模拟·安全通道与围挡", url: "https://picsum.photos/seed/aishi-g6/800/450", tags: ["安全文明"] },
];
