<script setup lang="ts">
import { computed } from "vue";
import {
  ArrowLeft,
  CornerUpLeft,
  History,
  RotateCcw,
  X,
} from "lucide-vue-next";
import { chapters } from "../../../shared/content";
import { timecode } from "../../../shared/format";
import type { Preview } from "../model/preview";
import { kindLabel, resolveNode, type StoryGraph } from "../model/types";

const props = defineProps<{
  preview: Preview;
  graph: StoryGraph;
  sourceLabel: string;
}>();

function title(id: string) {
  return props.graph.nodes.find((n) => n.id === id)?.title ?? "（已删除）";
}
function clueTitle(key: string) {
  const [kind, ...rest] = key.split(":");
  const refId = rest.join(":");
  const node = props.graph.nodes.find(
    (n) => n.kind === kind && n.refId === refId,
  );
  return node?.title ?? key;
}

/** 当前段落的内容摘要：展示锁定版本对应的素材信息 */
const segment = computed(() => {
  const p = props.preview.pinned.value;
  if (!p) return null;
  const r = resolveNode(p);
  if (r.chapter)
    return {
      heading: p.title,
      sub: `章节 · ${r.chapter.location} · 时长 ${timecode(r.chapter.duration)}`,
      body: r.chapter.description,
    };
  if (r.hotspot) {
    const c = chapters.find((c) => c.id === r.hotspot!.chapterId);
    return {
      heading: p.title,
      sub: `热点 · 属于「${c?.title ?? "?"}」 · 出现 ${timecode(r.hotspot.start)}–${timecode(r.hotspot.end)}`,
      body: r.hotspot.summary,
    };
  }
  if (r.person)
    return {
      heading: p.title,
      sub: `访谈 · ${r.person.role}`,
      body: `“${r.person.quote}”`,
    };
  return { heading: p.title, sub: "素材缺失", body: "引用的内容已不存在。" };
});

const exploredList = computed(() => [...props.preview.explored.value]);
const hasBranches = computed(() =>
  props.preview.branchOptions.value.some((o) => o.available),
);
</script>

<template>
  <section class="preview-player">
    <div class="preview-head">
      <small>PREVIEW · {{ sourceLabel }}</small>
      <div class="preview-controls">
        <button
          class="text-button"
          :disabled="!preview.history.value.length"
          @click="preview.back()"
        >
          <ArrowLeft :size="14" /> 上一步
        </button>
        <button class="text-button" @click="preview.restart()">
          <History :size="14" /> 回到入口
        </button>
        <button class="text-button" @click="preview.reset()">
          <RotateCcw :size="14" /> 清空线索重来
        </button>
        <button class="text-button" @click="preview.stop()">
          <X :size="14" /> 关闭预览
        </button>
      </div>
    </div>

    <div v-if="segment" class="preview-body">
      <div class="segment-card">
        <small>
          {{ kindLabel[preview.pinned.value!.kind] }} · 按 v{{
            preview.pinned.value!.version
          }}
          呈现
        </small>
        <h3>{{ segment.heading }}</h3>
        <p class="segment-sub">{{ segment.sub }}</p>
        <p>{{ segment.body }}</p>
        <p v-if="preview.pinned.value!.note" class="segment-note">
          策展备注：{{ preview.pinned.value!.note }}
        </p>
      </div>

      <div v-if="preview.stale.value" class="version-banner" role="status">
        策展人刚修改了本段落（v{{ preview.pinned.value!.version }} → v{{
          preview.current.value!.version
        }}）。当前观众将按 v{{ preview.pinned.value!.version }}
        看完本段落；<b>下一次跳转将采用 v{{ preview.current.value!.version }}</b
        >，后续选择已按新版本计算。
      </div>
      <div v-else-if="preview.removed.value" class="version-banner danger" role="alert">
        本段落在最新草稿中已被删除。当前观众可以看完这一段，但不会再有后续跳转；
        请「回到入口」按新版本继续。
      </div>

      <div class="clue-bar">
        <small>已探索线索</small>
        <span v-if="!exploredList.length" class="clue none">（尚无）</span>
        <span v-for="c in exploredList" :key="c" class="clue">{{
          clueTitle(c)
        }}</span>
      </div>

      <div v-if="!preview.removed.value" class="next-options">
        <small>接下来（依据已探索线索计算）</small>
        <div
          v-for="opt in preview.options.value"
          :key="opt.edge.id"
          class="option-row"
        >
          <button
            class="option"
            :class="[opt.edge.kind, { mainline: opt.edge.kind === 'main' }]"
            :disabled="!opt.available"
            @click="preview.follow(opt.edge.id)"
          >
            <template v-if="opt.edge.kind === 'main'">
              {{ hasBranches ? "拒绝支线，继续主线" : "继续" }} →「{{
                title(opt.edge.to)
              }}」
            </template>
            <template v-else-if="opt.edge.kind === 'return'">
              <CornerUpLeft :size="13" /> 返回「{{ title(opt.edge.to) }}」
            </template>
            <template v-else> 支线 →「{{ title(opt.edge.to) }}」 </template>
            <em v-if="opt.edge.label">{{ opt.edge.label }}</em>
          </button>
          <small v-if="!opt.available" class="missing">
            需要线索：{{ opt.missing.map(clueTitle).join("、") }}
          </small>
        </div>
        <p v-if="!preview.options.value.length" class="option-empty">
          <template v-if="preview.current.value?.terminal">
            —— 故事到此完结 ——
          </template>
          <template v-else>
            此段落没有后续连线（若是结尾，请将其标记为结局）。
          </template>
        </p>
      </div>
    </div>
    <p v-else class="preview-empty">叙事网络为空，请先添加段落。</p>
  </section>
</template>
