<script setup lang="ts">
import { CircleCheck, CircleX, TriangleAlert, UploadCloud } from "lucide-vue-next";
import type { Orchestration } from "../model/store";

const props = defineProps<{ orch: Orchestration }>();

function fmt(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <section class="publish-panel">
    <div class="section-heading">
      <h2>校验与发布</h2>
      <span>PUBLISH</span>
    </div>
    <div class="publish-status">
      <p>
        草稿：{{ props.orch.draft.value.nodes.length }} 个段落 ·
        {{ props.orch.draft.value.edges.length }} 条连线
      </p>
      <p v-if="props.orch.published.value">
        线上版本：v{{ props.orch.published.value.version }} · 发布于
        {{ fmt(props.orch.published.value.publishedAt) }}
      </p>
      <p v-else>尚未发布过版本，观众仍按固定三章观看。</p>
    </div>
    <div class="publish-actions">
      <button class="text-button" @click="props.orch.check()">校验草稿</button>
      <button
        class="primary"
        :disabled="props.orch.publishState.value === 'checking'"
        @click="props.orch.publish()"
      >
        <UploadCloud :size="15" />
        {{
          props.orch.publishState.value === "checking"
            ? "正在校验素材…"
            : "校验并发布"
        }}
      </button>
    </div>
    <p v-if="props.orch.publishState.value === 'ok'" class="publish-ok" role="status">
      <CircleCheck :size="14" /> 已发布 v{{ props.orch.published.value?.version }}。
      观众端即刻切换到新的叙事网络。
    </p>
    <p
      v-if="props.orch.publishState.value === 'failed'"
      class="publish-failed"
      role="alert"
    >
      <CircleX :size="14" /> 发布未生效：请先解决下列问题。草稿已保留，可继续编辑；
      <template v-if="props.orch.published.value">
        线上 v{{ props.orch.published.value.version }} 不受影响，观众仍可正常观看。
      </template>
      <template v-else>观众端保持固定三章的默认体验。</template>
    </p>
    <ul v-if="props.orch.checked.value" class="issue-list">
      <li
        v-for="(issue, i) in props.orch.issues.value"
        :key="i"
        :class="issue.level"
      >
        <CircleX v-if="issue.level === 'error'" :size="13" />
        <TriangleAlert v-else :size="13" />
        {{ issue.message }}
      </li>
      <li v-if="!props.orch.issues.value.length" class="ok">
        <CircleCheck :size="13" /> 素材、时间范围与结构检查全部通过。
      </li>
    </ul>
  </section>
</template>
