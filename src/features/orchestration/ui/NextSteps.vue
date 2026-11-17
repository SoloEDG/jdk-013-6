<script setup lang="ts">
import { computed } from "vue";
import { CornerUpLeft, GitBranch } from "lucide-vue-next";
import type { EdgeOption } from "../lib/graph";
import type { StoryGraph } from "../model/types";

const props = defineProps<{
  graph: StoryGraph;
  options: EdgeOption[];
  version: number;
}>();
const emit = defineEmits<{ follow: [edgeId: string] }>();

function title(id: string) {
  return props.graph.nodes.find((n) => n.id === id)?.title ?? id;
}
/** 观众只看到条件已满足的分支；未满足的线索不剧透 */
const visible = computed(() => props.options.filter((o) => o.available));
const main = computed(() => visible.value.find((o) => o.edge.kind === "main"));
const branches = computed(() =>
  visible.value.filter((o) => o.edge.kind === "branch"),
);
const returns = computed(() =>
  visible.value.filter((o) => o.edge.kind === "return"),
);
</script>

<template>
  <section v-if="visible.length" class="next-steps">
    <small><GitBranch :size="12" /> 叙事路径 · 已发布 v{{ version }}</small>
    <button
      v-for="opt in branches"
      :key="opt.edge.id"
      class="next-option branch"
      @click="emit('follow', opt.edge.id)"
    >
      支线 →「{{ title(opt.edge.to) }}」
      <em v-if="opt.edge.label">{{ opt.edge.label }}</em>
    </button>
    <button
      v-if="main"
      class="next-option main"
      @click="emit('follow', main.edge.id)"
    >
      {{ branches.length ? "拒绝支线，继续主线" : "继续主线" }} →「{{
        title(main.edge.to)
      }}」
    </button>
    <button
      v-for="opt in returns"
      :key="opt.edge.id"
      class="next-option return"
      @click="emit('follow', opt.edge.id)"
    >
      <CornerUpLeft :size="12" /> {{ opt.edge.label || "返回" }}「{{
        title(opt.edge.to)
      }}」
    </button>
  </section>
</template>
