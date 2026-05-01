/** 演示用外链图（Picsum 固定 id，便于稳定展示）；另含本地 SVG 兜底 */

export const DEMO_PROJECT_COVERS = {
  "PRJ-DEMO-001": "https://picsum.photos/id/28/1200/675",
  "PRJ-DEMO-002": "https://picsum.photos/id/48/1200/675",
};

/** 全站可见的模拟「现场图库」（登录后工作台一并拉取） */
export const DEMO_GALLERY = [
  { key: "local-svg", caption: "模拟·塔吊与结构（本地矢量）", url: "/assets/demo/construction.svg", tag: "示意图" },
  { key: "site-a", caption: "模拟·主体结构外观", url: "https://picsum.photos/id/28/800/500", tag: "外链" },
  { key: "site-b", caption: "模拟·外立面施工", url: "https://picsum.photos/id/48/800/500", tag: "外链" },
  { key: "site-c", caption: "模拟·钢筋绑扎", url: "https://picsum.photos/id/155/800/500", tag: "外链" },
  { key: "site-d", caption: "模拟·安全通道", url: "https://picsum.photos/id/175/800/500", tag: "外链" },
  { key: "site-e", caption: "模拟·材料堆放区", url: "https://picsum.photos/id/193/800/500", tag: "外链" },
];
