import { computed, ref } from "vue";
import type { StoryGraph, StoryNode } from "./types";
import { nodeClue } from "./types";
import { edgeOptions } from "../lib/graph";
import { clone } from "../lib/clone";

/**
 * 预览会话：模拟观众在叙事网络中行走。
 * 进入节点时锁定该节点的版本快照——策展人此时修改节点，
 * 当前观众仍按锁定的版本看完本段落；后继选择始终按最新草稿计算，
 * 即"下一次跳转采用新版本"。
 */
export function createPreview(source: () => StoryGraph | null) {
  const currentId = ref<string | null>(null);
  /** 进入当前节点时锁定的版本快照（展示以它为准） */
  const pinned = ref<StoryNode | null>(null);
  /** 已探索的线索 */
  const explored = ref<ReadonlySet<string>>(new Set());
  const history = ref<string[]>([]);

  const graph = computed(() => source());
  const current = computed(() =>
    currentId.value
      ? (graph.value?.nodes.find((n) => n.id === currentId.value) ?? null)
      : null,
  );
  /** 当前节点在预览期间被修改过：本段落按锁定版本播完，下次跳转用新版本 */
  const stale = computed(
    () =>
      !!current.value &&
      !!pinned.value &&
      current.value.version > pinned.value.version,
  );
  /** 当前节点在预览期间被删除：让观众看完本段落，但不再有后续跳转 */
  const removed = computed(() => !!pinned.value && !current.value);

  const options = computed(() =>
    currentId.value && graph.value
      ? edgeOptions(graph.value, currentId.value, explored.value)
      : [],
  );
  const mainOption = computed(
    () => options.value.find((o) => o.edge.kind === "main") ?? null,
  );
  const branchOptions = computed(() =>
    options.value.filter((o) => o.edge.kind === "branch"),
  );
  const returnOptions = computed(() =>
    options.value.filter((o) => o.edge.kind === "return"),
  );

  function enter(id: string) {
    const node = graph.value?.nodes.find((n) => n.id === id);
    if (!node) return;
    pinned.value = clone(node);
    currentId.value = id;
    const next = new Set(explored.value);
    next.add(nodeClue(node));
    explored.value = next;
  }

  function start() {
    history.value = [];
    const startId = graph.value?.startId;
    if (startId) enter(startId);
  }

  /** 重新开始：保留已探索线索（观众的记忆还在） */
  function restart() {
    start();
  }

  /** 完全重置：清空线索与历史 */
  function reset() {
    explored.value = new Set();
    start();
  }

  function follow(edgeId: string) {
    const edge = graph.value?.edges.find((e) => e.id === edgeId);
    if (!edge || !currentId.value) return;
    history.value = [...history.value, currentId.value];
    enter(edge.to);
  }

  /** 观众拒绝支线：沿主线继续 */
  function decline() {
    const main = mainOption.value;
    if (main && main.available) follow(main.edge.id);
  }

  function back() {
    const prev = history.value[history.value.length - 1];
    if (!prev) return;
    history.value = history.value.slice(0, -1);
    enter(prev);
  }

  function stop() {
    currentId.value = null;
    pinned.value = null;
    history.value = [];
  }

  return {
    currentId,
    pinned,
    explored,
    history,
    current,
    stale,
    removed,
    options,
    mainOption,
    branchOptions,
    returnOptions,
    start,
    restart,
    reset,
    follow,
    decline,
    back,
    stop,
  };
}

export type Preview = ReturnType<typeof createPreview>;
