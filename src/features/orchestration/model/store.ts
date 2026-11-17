import { computed, ref } from "vue";
import type { Entry } from "../../../shared/types";
import { seedGraph } from "./seed";
import type {
  EdgeKind,
  NodeKind,
  PublishedStory,
  StoryEdge,
  StoryGraph,
  StoryNode,
} from "./types";
import { defaultTitle } from "./types";
import { deadEnds, findTraps } from "../lib/graph";
import { clone } from "../lib/clone";
import { validateGraph, type Issue } from "../lib/validate";
import {
  applyRewire,
  buildRewirePlan,
  type EdgeChoice,
  type FavoriteChoice,
  type RewirePlan,
} from "../lib/rewire";
import {
  loadDraft,
  loadPublished,
  persistDraft,
  persistPublished,
} from "../lib/persistence";

/** 由工作区注入的收藏（探索手记）适配器：删除节点时按方案处理受影响的收藏 */
export interface FavoritesAdapter {
  entries: () => Entry[];
  expire: (ids: string[]) => void;
  rewire: (entryId: string, hotspotId: string) => void;
}

export function createOrchestration(favorites: FavoritesAdapter) {
  const draft = ref<StoryGraph>(loadDraft() ?? seedGraph());
  const published = ref<PublishedStory | null>(loadPublished());
  const issues = ref<Issue[]>([]);
  const publishState = ref<"idle" | "checking" | "failed" | "ok">("idle");
  const checked = ref(false);

  const traps = computed(() => findTraps(draft.value));
  const deadEndIds = computed(() => deadEnds(draft.value));

  function commit(next: StoryGraph) {
    draft.value = next;
    persistDraft(next);
    // 草稿一变，之前的校验结论即过期
    checked.value = false;
    publishState.value = "idle";
  }

  // —— 段落（节点） ——
  function addNode(kind: NodeKind, refId: string): StoryNode {
    const existing = draft.value.nodes.find(
      (n) => n.kind === kind && n.refId === refId,
    );
    if (existing) return existing;
    const node: StoryNode = {
      id: crypto.randomUUID(),
      kind,
      refId,
      title: defaultTitle(kind, refId),
      note: "",
      terminal: false,
      version: 1,
      updatedAt: Date.now(),
    };
    commit({ ...draft.value, nodes: [...draft.value.nodes, node] });
    return node;
  }

  /** 修改节点会提升版本号：预览中的观众看完当前段落后，下一次跳转才采用新版本 */
  function updateNode(
    id: string,
    patch: Partial<Pick<StoryNode, "title" | "note" | "terminal">>,
  ) {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    commit({
      ...draft.value,
      nodes: draft.value.nodes.map((n) =>
        n.id === id
          ? { ...n, ...clean, version: n.version + 1, updatedAt: Date.now() }
          : n,
      ),
    });
  }

  function setStart(id: string) {
    if (draft.value.nodes.some((n) => n.id === id))
      commit({ ...draft.value, startId: id });
  }

  // —— 连线 ——
  function addEdge(input: {
    from: string;
    to: string;
    kind: EdgeKind;
    label: string;
    requires: string[];
  }): StoryEdge | null {
    if (input.from === input.to) return null;
    if (
      draft.value.edges.some(
        (e) => e.from === input.from && e.to === input.to && e.kind === input.kind,
      )
    )
      return null;
    const edge: StoryEdge = { id: crypto.randomUUID(), ...input };
    commit({ ...draft.value, edges: [...draft.value.edges, edge] });
    return edge;
  }

  function removeEdge(id: string) {
    commit({
      ...draft.value,
      edges: draft.value.edges.filter((e) => e.id !== id),
    });
  }

  // —— 删除：先生成可检查的重接方案，策展人确认后才应用 ——
  function planDelete(nodeId: string): RewirePlan | null {
    return buildRewirePlan(draft.value, nodeId, favorites.entries());
  }

  function applyDelete(
    plan: RewirePlan,
    edgeChoices: EdgeChoice[],
    favoriteChoices: FavoriteChoice[],
  ) {
    // 收藏：默认标记失效保留；只有策展人显式选择时才改接到另一个热点节点
    const expireIds = favoriteChoices
      .filter((c) => c.action === "expire")
      .map((c) => c.entryId);
    if (expireIds.length) favorites.expire(expireIds);
    for (const c of favoriteChoices) {
      if (c.action !== "retarget" || !c.targetNodeId) continue;
      const target = draft.value.nodes.find((n) => n.id === c.targetNodeId);
      if (target?.kind === "hotspot") favorites.rewire(c.entryId, target.refId);
    }
    commit(applyRewire(draft.value, plan, edgeChoices));
  }

  // —— 校验与发布 ——
  async function check(): Promise<Issue[]> {
    const found = await validateGraph(draft.value);
    issues.value = found;
    checked.value = true;
    return found;
  }

  /** 发布：校验失败时草稿原样保留、已发布版本不受影响 */
  async function publish(): Promise<boolean> {
    publishState.value = "checking";
    const found = await check();
    if (found.some((i) => i.level === "error")) {
      publishState.value = "failed";
      return false;
    }
    const next: PublishedStory = {
      version: (published.value?.version ?? 0) + 1,
      publishedAt: Date.now(),
      graph: clone(draft.value),
    };
    published.value = next;
    persistPublished(next);
    publishState.value = "ok";
    return true;
  }

  return {
    draft,
    published,
    issues,
    checked,
    publishState,
    traps,
    deadEndIds,
    addNode,
    updateNode,
    setStart,
    addEdge,
    removeEdge,
    planDelete,
    applyDelete,
    check,
    publish,
  };
}

export type Orchestration = ReturnType<typeof createOrchestration>;
