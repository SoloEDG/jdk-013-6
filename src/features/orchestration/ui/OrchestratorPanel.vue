<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Eye, Film } from "lucide-vue-next";
import type { Orchestration } from "../model/store";
import { createPreview } from "../model/preview";
import type { EdgeChoice, FavoriteChoice, RewirePlan } from "../lib/rewire";
import type { EdgeKind, NodeKind } from "../model/types";
import GraphMap from "./GraphMap.vue";
import TrapPanel from "./TrapPanel.vue";
import NodeList from "./NodeList.vue";
import EdgeList from "./EdgeList.vue";
import PublishPanel from "./PublishPanel.vue";
import PreviewPlayer from "./PreviewPlayer.vue";
import DeletePlanModal from "./DeletePlanModal.vue";

const props = defineProps<{ orch: Orchestration }>();

const selectedId = ref<string | null>(null);
const plan = ref<RewirePlan | null>(null);
/** 预览来源：草稿 / 已发布版本 */
const previewSource = ref<"draft" | "published" | null>(null);

const previewGraph = computed(() =>
  previewSource.value === "draft"
    ? props.orch.draft.value
    : (props.orch.published.value?.graph ?? null),
);
const preview = createPreview(() => previewGraph.value);
const previewLabel = computed(() =>
  previewSource.value === "draft"
    ? "草稿（未发布）"
    : `已发布 v${props.orch.published.value?.version ?? ""}`,
);

watch(previewSource, (src) => {
  if (src) preview.start();
  else preview.stop();
});

function editNode(
  id: string,
  patch: { title?: string; note?: string; terminal?: boolean },
) {
  props.orch.updateNode(id, patch);
}
function addNode(kind: NodeKind, refId: string) {
  props.orch.addNode(kind, refId);
}
function addEdge(input: {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  requires: string[];
}) {
  props.orch.addEdge(input);
}
function askDelete(id: string) {
  plan.value = props.orch.planDelete(id);
}
function confirmDelete(
  edgeChoices: EdgeChoice[],
  favoriteChoices: FavoriteChoice[],
) {
  if (!plan.value) return;
  props.orch.applyDelete(plan.value, edgeChoices, favoriteChoices);
  plan.value = null;
}
</script>

<template>
  <section class="orch">
    <div class="orch-head">
      <div>
        <p class="eyebrow"><span /> CURATOR STUDIO</p>
        <h2>故事编排</h2>
        <p class="orch-copy">
          把章节、热点与人物访谈连成一张带条件的叙事网络。观众将依据自己探索过的线索，
          走向不同的下一段；也可以随时拒绝支线，回到主线。
        </p>
      </div>
      <div class="orch-actions">
        <button
          class="primary"
          :class="{ active: previewSource === 'draft' }"
          @click="previewSource = previewSource === 'draft' ? null : 'draft'"
        >
          <Eye :size="14" /> 预览草稿
        </button>
        <button
          class="text-button"
          :disabled="!orch.published.value"
          @click="
            previewSource = previewSource === 'published' ? null : 'published'
          "
        >
          <Film :size="14" /> 观看已发布版本
        </button>
      </div>
    </div>

    <TrapPanel
      :graph="orch.draft.value"
      :traps="orch.traps.value"
      :dead-ends="orch.deadEndIds.value"
    />

    <PreviewPlayer
      v-if="previewSource && previewGraph"
      :preview="preview"
      :graph="previewGraph"
      :source-label="previewLabel"
    />

    <div class="orch-grid">
      <div class="orch-col">
        <NodeList
          :graph="orch.draft.value"
          :selected-id="selectedId"
          :dead-ends="orch.deadEndIds.value"
          @select="selectedId = $event"
          @edit="editNode"
          @remove="askDelete"
          @set-start="orch.setStart($event)"
          @add="addNode"
        />
        <EdgeList
          :graph="orch.draft.value"
          @add="addEdge"
          @remove="orch.removeEdge($event)"
        />
        <PublishPanel :orch="orch" />
      </div>
      <div class="orch-col map-col">
        <div class="section-heading">
          <h2>叙事网络图谱</h2>
          <span>STORY MAP</span>
        </div>
        <GraphMap
          :graph="orch.draft.value"
          :traps="orch.traps.value"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
      </div>
    </div>

    <DeletePlanModal
      v-if="plan"
      :plan="plan"
      :graph="orch.draft.value"
      @cancel="plan = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
