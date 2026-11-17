import { chapters, hotspots, people } from "../../../shared/content";
import type { StoryEdge, StoryGraph, StoryNode } from "./types";
import { defaultTitle } from "./types";

/**
 * 首次打开编排工具时，把现有"固定三章"体验还原成一张等价的叙事网络：
 * 章节之间是主线，热点作为支线挂在所属章节上，人物访谈接在人物热点之后，
 * 访谈结束通过返回边回到主线章节。策展人在此基础上继续编排。
 */
export function seedGraph(): StoryGraph {
  const now = Date.now();
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const nodeId = (kind: string, refId: string) => `n-${kind}-${refId}`;
  const push = (kind: StoryNode["kind"], refId: string, terminal = false) =>
    nodes.push({
      id: nodeId(kind, refId),
      kind,
      refId,
      title: defaultTitle(kind, refId),
      note: "",
      terminal,
      version: 1,
      updatedAt: now,
    });
  chapters.forEach((c, i) =>
    push("chapter", c.id, i === chapters.length - 1),
  );
  hotspots.forEach((h) => push("hotspot", h.id));
  people.forEach((p) => push("interview", p.id));
  for (let i = 0; i < chapters.length - 1; i++)
    edges.push({
      id: `e-main-${chapters[i]!.id}`,
      from: nodeId("chapter", chapters[i]!.id),
      to: nodeId("chapter", chapters[i + 1]!.id),
      kind: "main",
      label: "下一章",
      requires: [],
    });
  for (const h of hotspots) {
    edges.push({
      id: `e-branch-${h.id}`,
      from: nodeId("chapter", h.chapterId),
      to: nodeId("hotspot", h.id),
      kind: "branch",
      label: "探索热点",
      requires: [],
    });
    if (h.personId)
      edges.push({
        id: `e-talk-${h.id}`,
        from: nodeId("hotspot", h.id),
        to: nodeId("interview", h.personId),
        kind: "branch",
        label: "进入访谈",
        requires: [],
      });
    edges.push({
      id: `e-back-${h.id}`,
      from: nodeId("hotspot", h.id),
      to: nodeId("chapter", h.chapterId),
      kind: "return",
      label: "返回主线",
      requires: [],
    });
  }
  for (const p of people) {
    const h = hotspots.find((h) => h.personId === p.id);
    if (h)
      edges.push({
        id: `e-return-${p.id}`,
        from: nodeId("interview", p.id),
        to: nodeId("chapter", h.chapterId),
        kind: "return",
        label: "结束访谈，回到主线",
        requires: [],
      });
  }
  return { startId: nodeId("chapter", chapters[0]!.id), nodes, edges };
}
