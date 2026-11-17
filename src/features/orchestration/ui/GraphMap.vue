<script setup lang="ts">
import { computed } from "vue";
import type { Trap } from "../lib/graph";
import {
  edgeKindLabel,
  kindLabel,
  type StoryGraph,
} from "../model/types";

const props = defineProps<{
  graph: StoryGraph;
  traps: Trap[];
  selectedId: string | null;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const COL_W = 196,
  ROW_H = 82,
  NODE_W = 156,
  NODE_H = 54,
  PAD = 16;

/** 按距入口的 BFS 深度分栏；不可达节点归入最后的"未连接"栏 */
const layout = computed(() => {
  const g = props.graph,
    depth = new Map<string, number>();
  if (g.startId && g.nodes.some((n) => n.id === g.startId)) {
    depth.set(g.startId, 0);
    const queue = [g.startId];
    while (queue.length) {
      const cur = queue.shift()!,
        d = depth.get(cur)!;
      for (const e of g.edges)
        if (e.from === cur && !depth.has(e.to) && g.nodes.some((n) => n.id === e.to)) {
          depth.set(e.to, d + 1);
          queue.push(e.to);
        }
    }
  }
  const unreached = g.nodes.filter((n) => !depth.has(n.id));
  const maxD = Math.max(0, ...depth.values());
  const columns: string[][] = [];
  if (depth.size) for (let i = 0; i <= maxD; i++) columns.push([]);
  for (const n of g.nodes) {
    const d = depth.get(n.id);
    if (d !== undefined) columns[d]!.push(n.id);
  }
  if (unreached.length) columns.push(unreached.map((n) => n.id));
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((ids, c) =>
    ids.forEach((id, r) =>
      pos.set(id, { x: PAD + c * COL_W, y: PAD + 26 + r * ROW_H }),
    ),
  );
  const labels = columns.map((_, c) =>
    unreached.length && c === columns.length - 1 ? "未连接" : `第 ${c + 1} 步`,
  );
  return {
    pos,
    labels,
    width: PAD * 2 + columns.length * COL_W,
    height: PAD * 2 + 26 + Math.max(1, ...columns.map((c) => c.length)) * ROW_H,
  };
});

const trapMembers = computed(
  () => new Set(props.traps.flatMap((t) => t.members)),
);

const paths = computed(() => {
  const g = props.graph;
  return g.edges
    .map((e) => {
      const a = layout.value.pos.get(e.from),
        b = layout.value.pos.get(e.to);
      if (!a || !b) return null;
      const x1 = a.x + NODE_W,
        y1 = a.y + NODE_H / 2,
        x2 = b.x,
        y2 = b.y + NODE_H / 2,
        forward = b.x > a.x;
      const d = forward
        ? `M ${x1} ${y1} C ${x1 + 54} ${y1}, ${x2 - 54} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1 + 46} ${y1 + 96}, ${x2 - 46} ${y2 + 96}, ${x2} ${y2}`;
      return { id: e.id, d, kind: e.kind, label: e.label || edgeKindLabel[e.kind] };
    })
    .filter((p) => p !== null);
});

function nodeClasses(id: string, kind: string) {
  return {
    [`kind-${kind}`]: true,
    trapped: trapMembers.value.has(id),
    selected: props.selectedId === id,
    start: props.graph.startId === id,
  };
}
</script>

<template>
  <div class="graph-map-scroll">
    <div
      class="graph-map"
      :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
    >
      <svg :width="layout.width" :height="layout.height" aria-hidden="true">
        <defs>
          <marker
            v-for="kind in ['main', 'branch', 'return']"
            :id="`arrow-${kind}`"
            :key="kind"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" :class="`arrow-${kind}`" />
          </marker>
        </defs>
        <path
          v-for="p in paths"
          :key="p.id"
          :d="p.d"
          :class="['edge-line', `edge-${p.kind}`]"
          :marker-end="`url(#arrow-${p.kind})`"
        >
          <title>{{ p.label }}</title>
        </path>
      </svg>
      <small
        v-for="(label, c) in layout.labels"
        :key="c"
        class="col-label"
        :style="{ left: PAD + c * COL_W + 'px' }"
        >{{ label }}</small
      >
      <button
        v-for="n in graph.nodes"
        :key="n.id"
        class="graph-node"
        :class="nodeClasses(n.id, n.kind)"
        :style="{
          left: layout.pos.get(n.id)!.x + 'px',
          top: layout.pos.get(n.id)!.y + 'px',
          width: NODE_W + 'px',
          height: NODE_H + 'px',
        }"
        @click="emit('select', n.id)"
      >
        <small>{{ kindLabel[n.kind] }} · v{{ n.version }}</small>
        <strong>{{ n.title }}</strong>
        <em v-if="graph.startId === n.id">入口</em>
        <em v-else-if="n.terminal">结局</em>
      </button>
    </div>
    <p class="graph-legend">
      <span class="lg-main">— 主线</span>
      <span class="lg-branch">- - 支线</span>
      <span class="lg-return">… 返回</span>
      <span class="lg-trap">红框 = 无法退出的循环成员</span>
    </p>
  </div>
</template>
