<script setup lang="ts">
import { AlertOctagon, MapPinOff } from "lucide-vue-next";
import type { Step, Trap } from "../lib/graph";
import { edgeKindLabel, type StoryGraph } from "../model/types";

const props = defineProps<{
  graph: StoryGraph;
  traps: Trap[];
  deadEnds: string[];
}>();

function title(id: string) {
  return props.graph.nodes.find((n) => n.id === id)?.title ?? id;
}
function via(edgeId: string) {
  const e = props.graph.edges.find((e) => e.id === edgeId);
  return e ? e.label || edgeKindLabel[e.kind] : "→";
}
function stepText(step: Step) {
  return `「${title(step.from)}」—${via(step.edgeId)}→「${title(step.to)}」`;
}
</script>

<template>
  <section v-if="traps.length || deadEnds.length" class="trap-panel">
    <article v-for="(trap, i) in traps" :key="i" class="trap" role="alert">
      <h3><AlertOctagon :size="15" /> 发现无法退出的路径</h3>
      <p class="trap-summary">
        观众进入「{{ trap.members.map(title).join("」「") }}」构成的循环后，
        没有任何连线可以离开，将被困在其中。
      </p>
      <div class="trap-steps">
        <div>
          <small>进入该路径的具体步骤</small>
          <ol v-if="trap.entry.length">
            <li v-for="(step, j) in trap.entry" :key="j">
              {{ stepText(step) }}
            </li>
          </ol>
          <p v-else-if="trap.reachableFromStart" class="trap-note">
            入口段落本身就在循环中。
          </p>
          <p v-else class="trap-note">
            当前入口无法到达该循环（但若以其他方式进入，仍无法退出）。
          </p>
        </div>
        <div>
          <small>循环路径</small>
          <ol v-if="trap.cycle.length">
            <li v-for="(step, j) in trap.cycle" :key="j">
              {{ stepText(step) }}
            </li>
          </ol>
        </div>
      </div>
      <p class="trap-hint">
        修复建议：为循环中的某个段落添加一条指向循环外的连线，或将其中一段标记为结局。
      </p>
    </article>
    <article v-if="deadEnds.length" class="trap dead-end">
      <h3><MapPinOff :size="15" /> 没有后续的段落</h3>
      <p class="trap-summary">
        {{ deadEnds.map(title).join("、") }} ——
        若是有意的结尾，请在段落中标记为「结局」，否则请接出连线。
      </p>
    </article>
  </section>
</template>
