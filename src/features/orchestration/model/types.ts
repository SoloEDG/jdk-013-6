import { chapters, hotspots, people } from "../../../shared/content";
import type { Chapter, Hotspot, Person } from "../../../shared/types";

/** 叙事节点承载的内容类型：章节 / 热点 / 人物访谈 */
export type NodeKind = "chapter" | "hotspot" | "interview";
/** 连线类型：主线 / 支线 / 返回边 */
export type EdgeKind = "main" | "branch" | "return";

export interface StoryNode {
  id: string;
  kind: NodeKind;
  /** 指向既有内容：章节 id / 热点 id / 人物 id */
  refId: string;
  title: string;
  note: string;
  /** 标记为结局节点：没有出边时不视为死胡同 */
  terminal: boolean;
  /** 每次修改 +1，预览会话据此判断"下一次跳转采用哪个版本" */
  version: number;
  updatedAt: number;
}

export interface StoryEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  /** 生效条件：需要观众已探索的线索（clue key 列表），全部满足才出现 */
  requires: string[];
}

export interface StoryGraph {
  startId: string;
  nodes: StoryNode[];
  edges: StoryEdge[];
}

export interface PublishedStory {
  version: number;
  publishedAt: number;
  graph: StoryGraph;
}

/** 线索 key：`kind:refId`，观众探索过某节点对应的内容即获得 */
export function clueKey(kind: NodeKind, refId: string): string {
  return `${kind}:${refId}`;
}
export function nodeClue(node: Pick<StoryNode, "kind" | "refId">): string {
  return clueKey(node.kind, node.refId);
}

export function findNode(graph: StoryGraph, id: string) {
  return graph.nodes.find((n) => n.id === id);
}
export function nodeByRef(graph: StoryGraph, kind: NodeKind, refId: string) {
  return graph.nodes.find((n) => n.kind === kind && n.refId === refId);
}

export interface ResolvedNode {
  chapter?: Chapter;
  hotspot?: Hotspot;
  person?: Person;
}
/** 把节点解析回既有内容素材 */
export function resolveNode(node: Pick<StoryNode, "kind" | "refId">): ResolvedNode {
  if (node.kind === "chapter")
    return { chapter: chapters.find((c) => c.id === node.refId) };
  if (node.kind === "hotspot")
    return { hotspot: hotspots.find((h) => h.id === node.refId) };
  return { person: people.find((p) => p.id === node.refId) };
}

export function defaultTitle(kind: NodeKind, refId: string): string {
  const r = resolveNode({ kind, refId });
  return r.chapter?.title ?? r.hotspot?.title ?? r.person?.name ?? refId;
}

/** 节点对应内容的素材地址（用于发布前校验素材可达性） */
export function nodeAssets(node: Pick<StoryNode, "kind" | "refId">): string[] {
  const r = resolveNode(node);
  if (node.kind === "chapter" && r.chapter)
    return [r.chapter.panorama, r.chapter.video].filter(Boolean);
  if (node.kind === "hotspot" && r.hotspot) {
    const c = chapters.find((c) => c.id === r.hotspot!.chapterId);
    return c ? [c.panorama, c.video].filter(Boolean) : [];
  }
  return [];
}

export const kindLabel: Record<NodeKind, string> = {
  chapter: "章节",
  hotspot: "热点",
  interview: "访谈",
};
export const edgeKindLabel: Record<EdgeKind, string> = {
  main: "主线",
  branch: "支线",
  return: "返回",
};
