import { chapters } from "../../../shared/content";
import { deadEnds, findTraps, outEdges, unreachableFromStart } from "./graph";
import {
  nodeAssets,
  nodeClue,
  resolveNode,
  type StoryGraph,
} from "../model/types";

export interface Issue {
  level: "error" | "warning";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/** 探测素材地址是否可达；网络异常返回 null（无法判断，按警告处理） */
async function probe(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return null;
  }
}

/**
 * 发布前校验：素材与时间范围为硬性错误，结构问题（无法退出的循环）同样阻止发布；
 * 死胡同、不可达、条件不可满足等作为警告，不阻止发布。
 */
export async function validateGraph(graph: StoryGraph): Promise<Issue[]> {
  const issues: Issue[] = [];
  const error = (message: string, nodeId?: string, edgeId?: string) =>
    issues.push({ level: "error", message, nodeId, edgeId });
  const warn = (message: string, nodeId?: string, edgeId?: string) =>
    issues.push({ level: "warning", message, nodeId, edgeId });
  const titleOf = (id: string) =>
    graph.nodes.find((n) => n.id === id)?.title ?? id;

  if (!graph.nodes.length) error("叙事网络还是空的，请先添加段落。");
  if (!graph.startId || !graph.nodes.some((n) => n.id === graph.startId))
    error("尚未指定有效的入口段落，观众将无从进入。");

  // —— 节点：素材引用与时间范围 ——
  for (const node of graph.nodes) {
    const r = resolveNode(node);
    if (node.kind === "chapter") {
      if (!r.chapter) {
        error(`「${node.title}」引用的章节素材已不存在。`, node.id);
        continue;
      }
      if (!r.chapter.panorama || !r.chapter.video)
        error(`「${node.title}」的全景或影像素材缺失。`, node.id);
      if (!(r.chapter.duration > 0))
        error(`「${node.title}」的章节时长无效。`, node.id);
    } else if (node.kind === "hotspot") {
      if (!r.hotspot) {
        error(`「${node.title}」引用的热点素材已不存在。`, node.id);
        continue;
      }
      const h = r.hotspot,
        c = chapters.find((c) => c.id === h.chapterId);
      if (!c) {
        error(`「${node.title}」所属章节不存在。`, node.id);
        continue;
      }
      if (!(h.start >= 0 && h.end > h.start && h.end <= c.duration))
        error(
          `「${node.title}」的时间范围无效（${h.start}s–${h.end}s，章节时长 ${c.duration}s）。`,
          node.id,
        );
    } else if (!r.person) {
      error(`「${node.title}」引用的人物访谈已不存在。`, node.id);
    }
  }

  // —— 素材可达性（HEAD 探测，去重） ——
  const urls = [...new Set(graph.nodes.flatMap(nodeAssets))];
  const results = await Promise.all(urls.map(async (u) => [u, await probe(u)] as const));
  for (const [url, ok] of results) {
    if (ok === false) error(`素材无法访问：${url}`);
    else if (ok === null) warn(`素材可达性无法确认（网络原因）：${url}`);
  }

  // —— 连线 ——
  const collectible = new Set(graph.nodes.map(nodeClue));
  for (const edge of graph.edges) {
    if (!graph.nodes.some((n) => n.id === edge.from))
      error(`连线「${edge.label || edge.id}」的起点不存在。`, undefined, edge.id);
    if (!graph.nodes.some((n) => n.id === edge.to))
      error(`连线「${edge.label || edge.id}」的终点不存在。`, undefined, edge.id);
    const impossible = edge.requires.filter((c) => !collectible.has(c));
    if (impossible.length)
      warn(
        `「${titleOf(edge.from)} → ${titleOf(edge.to)}」的条件引用了网络中不存在的线索，永远不会满足。`,
        edge.from,
        edge.id,
      );
    if (edge.kind === "main" && edge.requires.length)
      warn(
        `主线「${titleOf(edge.from)} → ${titleOf(edge.to)}」带有条件，观众拒绝支线时可能无路可走。`,
        edge.from,
        edge.id,
      );
  }
  for (const node of graph.nodes) {
    const mains = outEdges(graph, node.id).filter((e) => e.kind === "main");
    if (mains.length > 1)
      error(`「${node.title}」有多条主线出边，观众拒绝支线时将无法确定去向。`, node.id);
    if (node.terminal && outEdges(graph, node.id).length)
      warn(`「${node.title}」已标记为结局，但仍有出边。`, node.id);
  }

  // —— 结构：无法退出的循环 / 死胡同 / 不可达 ——
  for (const trap of findTraps(graph))
    error(
      `存在无法退出的循环：${trap.members.map(titleOf).join(" → ")}。观众进入后将无法离开。`,
      trap.members[0],
    );
  for (const id of deadEnds(graph))
    warn(`「${titleOf(id)}」没有后续段落；若是有意的结尾，请标记为结局。`, id);
  for (const id of unreachableFromStart(graph))
    warn(`「${titleOf(id)}」从入口不可达，观众永远不会看到。`, id);

  return issues;
}
