<script setup lang="ts">
import { computed, ref } from "vue";
import { X } from "lucide-vue-next";
import type { EdgeChoice, FavoriteChoice, RewirePlan } from "../lib/rewire";
import { edgeKindLabel, type StoryGraph } from "../model/types";

const props = defineProps<{ plan: RewirePlan; graph: StoryGraph }>();
const emit = defineEmits<{
  confirm: [edgeChoices: EdgeChoice[], favoriteChoices: FavoriteChoice[]];
  cancel: [];
}>();

/** 入边的默认处理：改接到本段落的主线后继；没有后继则移除 */
const edgeChoices = ref<EdgeChoice[]>(
  props.plan.incoming.map(({ edge, suggestedTarget }) => ({
    edgeId: edge.id,
    action: suggestedTarget ? "retarget" : "remove",
    targetId: suggestedTarget ?? undefined,
  })),
);
/** 收藏默认"标记失效并保留"，绝不悄悄改指到别的故事 */
const favoriteChoices = ref<FavoriteChoice[]>(
  props.plan.favorites.map((e) => ({ entryId: e.id, action: "expire" })),
);

const nodeOptions = computed(() =>
  props.graph.nodes.filter((n) => n.id !== props.plan.nodeId),
);
const hotspotOptions = computed(() =>
  nodeOptions.value.filter((n) => n.kind === "hotspot"),
);

function edgeChoice(edgeId: string) {
  return edgeChoices.value.find((c) => c.edgeId === edgeId)!;
}
function favChoice(entryId: string) {
  return favoriteChoices.value.find((c) => c.entryId === entryId)!;
}
/** 选择"改接"时立即补上默认目标，避免方案处于未决状态 */
function ensureEdgeTarget(c: EdgeChoice) {
  if (c.action === "retarget" && !c.targetId)
    c.targetId = nodeOptions.value[0]?.id;
}
function ensureFavTarget(c: FavoriteChoice) {
  if (c.action === "retarget" && !c.targetNodeId)
    c.targetNodeId = hotspotOptions.value[0]?.id;
}
function title(id: string) {
  return props.graph.nodes.find((n) => n.id === id)?.title ?? id;
}
const nextStartTitle = computed(() =>
  props.plan.nextStartId ? title(props.plan.nextStartId) : "（需要重新指定）",
);
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <section
      class="plan-modal"
      role="dialog"
      aria-modal="true"
      aria-label="删除段落的重接方案"
    >
      <button class="close" aria-label="取消删除" @click="emit('cancel')">
        <X />
      </button>
      <small>REWIRE PLAN · 删除前请检查</small>
      <h2>删除「{{ plan.nodeTitle }}」</h2>
      <p class="plan-intro">
        删除不会立即生效。以下方案列出所有受影响的连线与收藏，确认后才会执行；
        收藏默认保留为失效记录，不会被悄悄指向另一个故事。
      </p>

      <div v-if="plan.isStart" class="plan-warning" role="alert">
        这是入口段落。删除后入口将改为「{{ nextStartTitle }}」。
      </div>

      <section class="plan-section">
        <h3>指向本段落的连线（{{ plan.incoming.length }}）</h3>
        <p v-if="!plan.incoming.length" class="plan-empty">没有入边。</p>
        <div v-for="item in plan.incoming" :key="item.edge.id" class="plan-row">
          <span
            >「{{ item.fromTitle }}」—{{ edgeKindLabel[item.edge.kind] }}→</span
          >
          <select
            :value="edgeChoice(item.edge.id).action"
            @change="
              edgeChoice(item.edge.id).action = (
                $event.target as HTMLSelectElement
              ).value as EdgeChoice['action'];
              ensureEdgeTarget(edgeChoice(item.edge.id));
            "
          >
            <option value="retarget" :disabled="!nodeOptions.length">
              改接到…
            </option>
            <option value="remove">移除这条连线</option>
          </select>
          <select
            v-if="edgeChoice(item.edge.id).action === 'retarget'"
            :value="edgeChoice(item.edge.id).targetId"
            @change="
              edgeChoice(item.edge.id).targetId = (
                $event.target as HTMLSelectElement
              ).value
            "
          >
            <option v-for="n in nodeOptions" :key="n.id" :value="n.id">
              {{ n.title }}
            </option>
          </select>
        </div>
      </section>

      <section v-if="plan.outgoing.length" class="plan-section">
        <h3>本段落发出的连线（{{ plan.outgoing.length }}）</h3>
        <div v-for="e in plan.outgoing" :key="e.id" class="plan-row muted-row">
          <span
            >—{{ edgeKindLabel[e.kind] }}→「{{ title(e.to) }}」：随段落一并移除</span
          >
        </div>
      </section>

      <section class="plan-section">
        <h3>受影响的收藏（{{ plan.favorites.length }}）</h3>
        <p v-if="!plan.favorites.length" class="plan-empty">
          没有观众的收藏指向这个段落。
        </p>
        <div v-for="f in plan.favorites" :key="f.id" class="plan-row fav-row">
          <span class="fav-title">「{{ f.title }}」</span>
          <label>
            <input
              v-model="favChoice(f.id).action"
              type="radio"
              value="expire"
              :name="`fav-${f.id}`"
            />
            标记失效，保留记录
          </label>
          <label>
            <input
              v-model="favChoice(f.id).action"
              type="radio"
              value="retarget"
              :disabled="!hotspotOptions.length"
              :name="`fav-${f.id}`"
              @change="ensureFavTarget(favChoice(f.id))"
            />
            改接到
          </label>
          <select
            v-if="favChoice(f.id).action === 'retarget'"
            v-model="favChoice(f.id).targetNodeId"
          >
            <option v-for="n in hotspotOptions" :key="n.id" :value="n.id">
              {{ n.title }}
            </option>
          </select>
        </div>
      </section>

      <div class="plan-actions">
        <button class="text-button" @click="emit('cancel')">取消</button>
        <button
          class="primary danger"
          @click="emit('confirm', edgeChoices, favoriteChoices)"
        >
          按此方案删除
        </button>
      </div>
    </section>
  </div>
</template>
