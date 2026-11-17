import type { Entry } from "../../../shared/types";
import type { StoryEdge, StoryGraph } from "../model/types";
import { mainEdge } from "./graph";

/**
 * 删除节点前生成的"重接方案"：列出所有受影响的连线与收藏，
 * 由策展人逐项确认后才会执行——收藏默认标记失效，绝不悄悄指向另一个故事。
 */
export interface RewirePlan {
  nodeId: string;
  nodeTitle: string;
  isStart: boolean;
  /** 指向本节点的连线：默认改接到本节点的主线后继（若有），否则移除 */
  incoming: { edge: StoryEdge; fromTitle: string; suggestedTarget: string | null }[];
  /** 本节点发出的连线：随节点一并移除 */
  outgoing: StoryEdge[];
  /** 受影响的收藏（探索手记条目） */
  favorites: Entry[];
  /** 若删除的是入口节点，删除后入口将改到这里（可能为空，需要策展人后续指定） */
  nextStartId: string;
}

export function buildRewirePlan(
  graph: StoryGraph,
  nodeId: string,
  entries: Entry[],
): RewirePlan | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const successor = mainEdge(graph, nodeId)?.to ?? null;
  const incoming = graph.edges
    .filter((e) => e.to === nodeId && e.from !== nodeId)
    .map((edge) => ({
      edge,
      fromTitle: graph.nodes.find((n) => n.id === edge.from)?.title ?? edge.from,
      suggestedTarget: successor,
    }));
  const outgoing = graph.edges.filter((e) => e.from === nodeId);
  // 收藏按内容引用匹配：热点节点 → hotspotId；章节节点 → chapterId
  const favorites = entries.filter((e) =>
    node.kind === "hotspot"
      ? e.hotspotId === node.refId
      : node.kind === "chapter"
        ? e.chapterId === node.refId
        : false,
  );
  const isStart = graph.startId === nodeId;
  const nextStartId = isStart
    ? (successor ?? graph.nodes.find((n) => n.id !== nodeId)?.id ?? "")
    : graph.startId;
  return {
    nodeId,
    nodeTitle: node.title,
    isStart,
    incoming,
    outgoing,
    favorites,
    nextStartId,
  };
}

/** 策展人对每条入边的决定：改接到指定节点，或移除 */
export interface EdgeChoice {
  edgeId: string;
  action: "retarget" | "remove";
  targetId?: string;
}
/** 策展人对每条收藏的决定：标记失效（保留记录），或显式改接到另一个热点节点 */
export interface FavoriteChoice {
  entryId: string;
  action: "expire" | "retarget";
  targetNodeId?: string;
}

/** 把方案应用到草稿图上（收藏部分由调用方交给 journal 处理），返回新的图 */
export function applyRewire(
  graph: StoryGraph,
  plan: RewirePlan,
  edgeChoices: EdgeChoice[],
): StoryGraph {
  const removedEdgeIds = new Set(
    edgeChoices.filter((c) => c.action === "remove").map((c) => c.edgeId),
  );
  const retargets = new Map(
    edgeChoices
      .filter((c) => c.action === "retarget" && c.targetId)
      .map((c) => [c.edgeId, c.targetId!]),
  );
  const nodes = graph.nodes.filter((n) => n.id !== plan.nodeId);
  const edges = graph.edges
    .filter((e) => {
      if (e.from === plan.nodeId) return false; // 出边随节点移除
      if (removedEdgeIds.has(e.id)) return false; // 策展人选择移除的入边
      if (e.to === plan.nodeId && !retargets.has(e.id)) return false; // 未改接的入边
      return true;
    })
    .map((e) => (retargets.has(e.id) ? { ...e, to: retargets.get(e.id)! } : e));
  return {
    startId: plan.isStart ? plan.nextStartId : graph.startId,
    nodes,
    edges,
  };
}
