import type { StoryEdge, StoryGraph } from "../model/types";

/** 叙事图中的一步：经由某条连线，从一个节点到下一个节点 */
export interface Step {
  edgeId: string;
  from: string;
  to: string;
}

/** 一个"无法退出的路径"：循环节点集合 + 进入它的具体步骤 + 循环本身的具体步骤 */
export interface Trap {
  /** 构成循环的节点 id */
  members: string[];
  /** 从入口到达循环的逐步路径（空数组表示入口本身就在循环里） */
  entry: Step[];
  /** 循环内部的一条具体回路 */
  cycle: Step[];
  reachableFromStart: boolean;
}

export function outEdges(graph: StoryGraph, nodeId: string): StoryEdge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

export function mainEdge(
  graph: StoryGraph,
  nodeId: string,
): StoryEdge | undefined {
  return graph.edges.find((e) => e.from === nodeId && e.kind === "main");
}

export interface EdgeOption {
  edge: StoryEdge;
  /** 已探索线索是否满足条件 */
  available: boolean;
  /** 还缺哪些线索（clue key） */
  missing: string[];
}

/** 预览/观看时的后继选择：依据已探索线索判断每条出边是否出现 */
export function edgeOptions(
  graph: StoryGraph,
  nodeId: string,
  explored: ReadonlySet<string>,
): EdgeOption[] {
  return outEdges(graph, nodeId).map((edge) => {
    const missing = edge.requires.filter((c) => !explored.has(c));
    return { edge, available: missing.length === 0, missing };
  });
}

/** Tarjan 强连通分量（递归实现，叙事图规模很小） */
function stronglyConnected(graph: StoryGraph): string[][] {
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    onStack = new Set<string>(),
    stack: string[] = [],
    out: string[][] = [];
  let counter = 0;
  function visit(id: string) {
    index.set(id, counter);
    low.set(id, counter);
    counter++;
    stack.push(id);
    onStack.add(id);
    for (const e of outEdges(graph, id)) {
      if (!graph.nodes.some((n) => n.id === e.to)) continue;
      if (!index.has(e.to)) {
        visit(e.to);
        low.set(id, Math.min(low.get(id)!, low.get(e.to)!));
      } else if (onStack.has(e.to)) {
        low.set(id, Math.min(low.get(id)!, index.get(e.to)!));
      }
    }
    if (low.get(id) === index.get(id)) {
      const scc: string[] = [];
      let cur = "";
      do {
        cur = stack.pop()!;
        onStack.delete(cur);
        scc.push(cur);
      } while (cur !== id);
      out.push(scc);
    }
  }
  for (const n of graph.nodes) if (!index.has(n.id)) visit(n.id);
  return out;
}

const exists = (graph: StoryGraph, id: string) =>
  graph.nodes.some((n) => n.id === id);

/** 从 from 出发、到达满足 target 的节点的一条边路径（BFS，边级前驱；from 自身命中时返回空路径） */
function findPath(
  graph: StoryGraph,
  from: string,
  target: (id: string) => boolean,
  allowed?: ReadonlySet<string>,
): Step[] | null {
  if (target(from)) return [];
  const prev = new Map<string, Step>(),
    seen = new Set<string>([from]),
    queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of outEdges(graph, cur)) {
      if (seen.has(e.to)) continue;
      if (allowed && !allowed.has(e.to)) continue;
      if (!exists(graph, e.to)) continue;
      prev.set(e.to, { edgeId: e.id, from: cur, to: e.to });
      if (target(e.to)) {
        const steps: Step[] = [];
        let node = e.to;
        while (node !== from) {
          const s = prev.get(node)!;
          steps.unshift(s);
          node = s.from;
        }
        return steps;
      }
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return null;
}

/** 找一条从 start 出发、经过 allowed 内部节点、最终回到 start 的回路（至少一条边） */
function findCycle(
  graph: StoryGraph,
  start: string,
  allowed: ReadonlySet<string>,
): Step[] {
  const prev = new Map<string, Step>(),
    seen = new Set<string>(),
    queue: string[] = [];
  for (const e of outEdges(graph, start)) {
    if (!allowed.has(e.to) || !exists(graph, e.to)) continue;
    if (e.to === start) return [{ edgeId: e.id, from: start, to: start }];
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    prev.set(e.to, { edgeId: e.id, from: start, to: e.to });
    queue.push(e.to);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of outEdges(graph, cur)) {
      if (!allowed.has(e.to) || !exists(graph, e.to)) continue;
      if (e.to === start) {
        const steps: Step[] = [{ edgeId: e.id, from: cur, to: start }];
        let node = cur;
        while (node !== start) {
          const s = prev.get(node)!;
          steps.unshift(s);
          node = s.from;
        }
        return steps;
      }
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { edgeId: e.id, from: cur, to: e.to });
      queue.push(e.to);
    }
  }
  return [];
}

/**
 * 发现"无法退出的路径"：
 * 强连通且带环的分量，若没有任何指向分量外的边、也不含结局节点，
 * 观众一旦进入就再也无法离开。返回进入步骤与循环步骤，便于策展人定位。
 * 条件边按"条件总能满足"处理——即使在最乐观的情况下也无出口，才报告。
 */
export function findTraps(graph: StoryGraph): Trap[] {
  const traps: Trap[] = [];
  for (const scc of stronglyConnected(graph)) {
    const memberSet = new Set(scc);
    const cyclic =
      scc.length > 1 ||
      graph.edges.some((e) => e.from === scc[0] && e.to === scc[0]);
    if (!cyclic) continue;
    const hasExit = graph.edges.some(
      (e) => memberSet.has(e.from) && !memberSet.has(e.to),
    );
    const hasTerminal = scc.some(
      (id) => graph.nodes.find((n) => n.id === id)?.terminal,
    );
    if (hasExit || hasTerminal) continue;
    const entryPath = graph.startId
      ? findPath(graph, graph.startId, (id) => memberSet.has(id))
      : null;
    // 循环演示：从进入点（或分量首节点）出发，在分量内部回到自身
    const entryNode = entryPath?.length
      ? entryPath[entryPath.length - 1]!.to
      : scc[0]!;
    traps.push({
      members: scc,
      entry: entryPath ?? [],
      cycle: findCycle(graph, entryNode, memberSet),
      reachableFromStart: entryPath !== null,
    });
  }
  return traps;
}

/** 没有出边且未标记为结局的节点（死胡同，作为提示而非陷阱） */
export function deadEnds(graph: StoryGraph): string[] {
  return graph.nodes
    .filter((n) => !n.terminal && outEdges(graph, n.id).length === 0)
    .map((n) => n.id);
}

/** 从入口出发不可达的节点 */
export function unreachableFromStart(graph: StoryGraph): string[] {
  if (!graph.startId || !exists(graph, graph.startId))
    return graph.nodes.map((n) => n.id);
  const seen = new Set<string>([graph.startId]),
    queue = [graph.startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of outEdges(graph, cur))
      if (!seen.has(e.to) && exists(graph, e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
  }
  return graph.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
}
