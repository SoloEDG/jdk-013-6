<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import {
  edgeKindLabel,
  nodeClue,
  type EdgeKind,
  type StoryGraph,
} from "../model/types";

const props = defineProps<{ graph: StoryGraph }>();
const emit = defineEmits<{
  add: [
    input: {
      from: string;
      to: string;
      kind: EdgeKind;
      label: string;
      requires: string[];
    },
  ];
  remove: [id: string];
}>();

const from = ref(""),
  to = ref(""),
  kind = ref<EdgeKind>("branch"),
  label = ref(""),
  requires = ref<string[]>([]);

/** 网络中所有可被探索到的线索，作为条件候选 */
const clueOptions = computed(() =>
  props.graph.nodes.map((n) => ({
    key: nodeClue(n),
    title: n.title,
    kind: n.kind,
  })),
);

function title(id: string) {
  return props.graph.nodes.find((n) => n.id === id)?.title ?? id;
}
function clueTitle(key: string) {
  return (
    clueOptions.value.find((c) => c.key === key)?.title ?? `${key}（已失效）`
  );
}
function toggleClue(key: string) {
  requires.value = requires.value.includes(key)
    ? requires.value.filter((c) => c !== key)
    : [...requires.value, key];
}
function submit() {
  if (!from.value || !to.value) return;
  emit("add", {
    from: from.value,
    to: to.value,
    kind: kind.value,
    label: label.value.trim(),
    requires: [...requires.value],
  });
  label.value = "";
  requires.value = [];
}
const kindHint: Record<EdgeKind, string> = {
  main: "主线：观众拒绝支线时的默认去向（每段最多一条）",
  branch: "支线：条件满足时出现，观众可以选择或拒绝",
  return: "返回边：指回之前的段落，允许构成循环",
};
</script>

<template>
  <section class="edge-list">
    <div class="section-heading">
      <h2>叙事连线</h2>
      <span>EDGES · {{ graph.edges.length }}</span>
    </div>
    <form class="edge-form" @submit.prevent="submit">
      <div class="edge-form-row">
        <select v-model="from" aria-label="起点段落">
          <option value="" disabled>从…</option>
          <option v-for="n in graph.nodes" :key="n.id" :value="n.id">
            {{ n.title }}
          </option>
        </select>
        <select v-model="to" aria-label="终点段落">
          <option value="" disabled>到…</option>
          <option
            v-for="n in graph.nodes.filter((n) => n.id !== from)"
            :key="n.id"
            :value="n.id"
          >
            {{ n.title }}
          </option>
        </select>
        <select v-model="kind" aria-label="连线类型">
          <option value="main">主线</option>
          <option value="branch">支线</option>
          <option value="return">返回边</option>
        </select>
      </div>
      <p class="edge-hint">{{ kindHint[kind] }}</p>
      <div class="edge-form-row">
        <input
          v-model="label"
          maxlength="16"
          placeholder="连线说明（可选，如「听完访谈再继续」）"
          aria-label="连线说明"
        />
        <details class="clue-picker">
          <summary>
            条件线索<template v-if="requires.length"
              >（已选 {{ requires.length }}）</template
            >
          </summary>
          <label v-for="c in clueOptions" :key="c.key">
            <input
              type="checkbox"
              :checked="requires.includes(c.key)"
              @change="toggleClue(c.key)"
            />
            已探索「{{ c.title }}」
          </label>
          <p v-if="!clueOptions.length">先添加段落，才能设置条件。</p>
        </details>
        <button class="primary" type="submit" :disabled="!from || !to">
          <Plus :size="14" /> 添加连线
        </button>
      </div>
    </form>
    <article v-for="e in graph.edges" :key="e.id" class="edge-row">
      <span class="edge-kind" :class="e.kind">{{ edgeKindLabel[e.kind] }}</span>
      <div class="edge-row-main">
        <b>「{{ title(e.from) }}」 → 「{{ title(e.to) }}」</b>
        <small v-if="e.label">{{ e.label }}</small>
        <small v-if="e.requires.length" class="requires">
          需要线索：{{ e.requires.map(clueTitle).join("、") }}
        </small>
      </div>
      <button aria-label="删除连线" @click="emit('remove', e.id)">
        <Trash2 :size="14" />
      </button>
    </article>
  </section>
</template>
