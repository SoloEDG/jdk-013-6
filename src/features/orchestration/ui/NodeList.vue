<script setup lang="ts">
import { computed, ref } from "vue";
import { Flag, Pencil, Trash2 } from "lucide-vue-next";
import { chapters, hotspots, people } from "../../../shared/content";
import { timecode } from "../../../shared/format";
import {
  kindLabel,
  resolveNode,
  type NodeKind,
  type StoryGraph,
  type StoryNode,
} from "../model/types";

const props = defineProps<{
  graph: StoryGraph;
  selectedId: string | null;
  deadEnds: string[];
}>();
const emit = defineEmits<{
  select: [id: string];
  edit: [id: string, patch: { title?: string; note?: string; terminal?: boolean }];
  remove: [id: string];
  setStart: [id: string];
  add: [kind: NodeKind, refId: string];
}>();

/** 尚未进入叙事网络的内容素材，用于"添加段落" */
const catalog = computed(() => {
  const has = (kind: NodeKind, refId: string) =>
    props.graph.nodes.some((n) => n.kind === kind && n.refId === refId);
  return [
    ...chapters
      .filter((c) => !has("chapter", c.id))
      .map((c) => ({ kind: "chapter" as const, refId: c.id, title: c.title })),
    ...hotspots
      .filter((h) => !has("hotspot", h.id))
      .map((h) => ({ kind: "hotspot" as const, refId: h.id, title: h.title })),
    ...people
      .filter((p) => !has("interview", p.id))
      .map((p) => ({ kind: "interview" as const, refId: p.id, title: p.name })),
  ];
});

const groups = computed(() =>
  (["chapter", "hotspot", "interview"] as const).map((kind) => ({
    kind,
    nodes: props.graph.nodes.filter((n) => n.kind === kind),
  })),
);

const editingId = ref<string | null>(null),
  draftTitle = ref(""),
  draftNote = ref(""),
  draftTerminal = ref(false);

function beginEdit(node: StoryNode) {
  editingId.value = node.id;
  draftTitle.value = node.title;
  draftNote.value = node.note;
  draftTerminal.value = node.terminal;
}
function saveEdit() {
  if (!editingId.value) return;
  emit("edit", editingId.value, {
    title: draftTitle.value.trim() || undefined,
    note: draftNote.value,
    terminal: draftTerminal.value,
  });
  editingId.value = null;
}

function meta(node: StoryNode): string {
  const r = resolveNode(node);
  if (r.chapter) return `${r.chapter.location} · ${timecode(r.chapter.duration)}`;
  if (r.hotspot) {
    const c = chapters.find((c) => c.id === r.hotspot!.chapterId);
    return `${c?.title ?? "?"} · ${timecode(r.hotspot.start)}–${timecode(r.hotspot.end)}`;
  }
  if (r.person) return r.person.role;
  return "素材缺失";
}
</script>

<template>
  <section class="node-list">
    <div class="section-heading">
      <h2>叙事段落</h2>
      <span>NODES · {{ graph.nodes.length }}</span>
    </div>
    <details class="add-node">
      <summary>＋ 添加段落（章节 / 热点 / 访谈）</summary>
      <button
        v-for="item in catalog"
        :key="item.kind + item.refId"
        @click="emit('add', item.kind, item.refId)"
      >
        <small>{{ kindLabel[item.kind] }}</small> {{ item.title }}
      </button>
      <p v-if="!catalog.length" class="add-empty">所有素材都已在网络中。</p>
    </details>
    <div v-for="group in groups" :key="group.kind" class="node-group">
      <small v-if="group.nodes.length" class="group-label">{{
        kindLabel[group.kind]
      }}</small>
      <article
        v-for="node in group.nodes"
        :key="node.id"
        class="node-row"
        :class="{
          selected: selectedId === node.id,
          dead: deadEnds.includes(node.id),
        }"
        @click="emit('select', node.id)"
      >
        <template v-if="editingId !== node.id">
          <div class="node-main">
            <small>
              v{{ node.version }}
              <em v-if="graph.startId === node.id" class="tag start">入口</em>
              <em v-if="node.terminal" class="tag terminal">结局</em>
              <em v-if="deadEnds.includes(node.id)" class="tag dead">死胡同</em>
            </small>
            <h3>{{ node.title }}</h3>
            <p>{{ meta(node) }}<template v-if="node.note"> · {{ node.note }}</template></p>
          </div>
          <div class="node-actions">
            <button
              aria-label="设为入口"
              title="设为入口"
              @click.stop="emit('setStart', node.id)"
            >
              <Flag :size="14" />
            </button>
            <button aria-label="编辑段落" title="编辑" @click.stop="beginEdit(node)">
              <Pencil :size="14" />
            </button>
            <button
              aria-label="删除段落"
              title="删除（生成重接方案）"
              @click.stop="emit('remove', node.id)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </template>
        <div v-else class="node-edit" @click.stop>
          <label
            >段落标题
            <input v-model="draftTitle" maxlength="24" />
          </label>
          <label
            >策展备注
            <input v-model="draftNote" maxlength="60" placeholder="仅策展人可见" />
          </label>
          <label class="terminal-toggle">
            <input v-model="draftTerminal" type="checkbox" /> 这是结局段落
          </label>
          <div class="edit-actions">
            <button class="primary" @click="saveEdit">保存（版本 +1）</button>
            <button class="text-button" @click="editingId = null">取消</button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
