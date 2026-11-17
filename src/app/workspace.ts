import { computed, ref } from "vue";
import { createCamera } from "../features/panorama";
import { createPlayback } from "../features/chapters";
import { createDiscovery } from "../features/hotspots";
import { createBranch } from "../features/interviews";
import { createJournal } from "../features/journal";
import {
  createOrchestration,
  edgeOptions,
  nodeClue,
} from "../features/orchestration";
import { hotspots } from "../shared/content";
import type { Command, Position } from "../shared/types";
export function createWorkspace() {
  const camera = createCamera(),
    playback = createPlayback(),
    discovery = createDiscovery(() => playback.state),
    branch = createBranch(),
    journal = createJournal(),
    tab = ref("story");
  // 策展人编排工具：草稿 + 已发布版本；收藏适配器让删除节点时按方案处理手记
  const orchestration = createOrchestration({
    entries: () => journal.entries.value,
    expire: (ids) => journal.markOrphaned(ids),
    rewire: (entryId, hotspotId) => journal.rewireTo(entryId, hotspotId),
  });
  // 观众已探索的线索（会话内）：来自手记收藏与本次浏览
  const clues = ref<ReadonlySet<string>>(
    new Set(journal.entries.value.map((e) => `hotspot:${e.hotspotId}`)),
  );
  function addClue(key: string) {
    if (!clues.value.has(key)) clues.value = new Set([...clues.value, key]);
  }
  const position = (): Position => ({
    chapterId: playback.state.chapterId,
    time: playback.state.time,
    camera: { ...camera.camera },
    playing: playback.state.playing,
  });
  function enterPerson(id: string) {
    branch.enter(id, position());
    playback.state.playing = false;
    discovery.close();
    addClue(`interview:${id}`);
  }
  function dispatch(command: Command) {
    switch (command.type) {
      case "chapter":
        if (branch.personId.value) return;
        playback.select(command.id);
        camera.reset();
        discovery.close();
        addClue(`chapter:${command.id}`);
        break;
      case "seek":
        playback.seek(command.time);
        break;
      case "hotspot":
        discovery.select(command.id);
        addClue(`hotspot:${command.id}`);
        break;
      case "return": {
        const saved = branch.leave();
        if (saved) {
          playback.select(saved.chapterId);
          playback.seek(saved.time);
          camera.restore(saved.camera);
          playback.state.playing = saved.playing;
        }
        break;
      }
      case "revisit":
        branch.leave();
        playback.select(command.entry.chapterId);
        playback.seek(command.entry.time);
        camera.restore(command.entry.camera);
        discovery.select(command.entry.hotspotId);
        addClue(`chapter:${command.entry.chapterId}`);
        addClue(`hotspot:${command.entry.hotspotId}`);
        tab.value = "story";
        break;
    }
  }
  function save() {
    const h = discovery.detail.value;
    if (h) journal.save(h, position());
  }
  // —— 已发布叙事网络驱动的观众端"接下来" ——
  const publishedGraph = computed(() => orchestration.published.value?.graph ?? null);
  const narrativeNode = computed(() => {
    const g = publishedGraph.value;
    return (
      g?.nodes.find(
        (n) => n.kind === "chapter" && n.refId === playback.state.chapterId,
      ) ?? null
    );
  });
  const nextOptions = computed(() =>
    publishedGraph.value && narrativeNode.value
      ? edgeOptions(publishedGraph.value, narrativeNode.value.id, clues.value)
      : [],
  );
  /** 观众沿叙事网络跳转：章节直接切换，热点定位到所属章节时刻，访谈进入口述 */
  function followEdge(edgeId: string) {
    const g = publishedGraph.value;
    const edge = g?.edges.find((e) => e.id === edgeId);
    const target = edge && g?.nodes.find((n) => n.id === edge.to);
    if (!g || !target) return;
    addClue(nodeClue(target));
    if (target.kind === "chapter") {
      dispatch({ type: "chapter", id: target.refId });
    } else if (target.kind === "hotspot") {
      const h = hotspots.find((h) => h.id === target.refId);
      if (!h) return;
      branch.leave();
      playback.select(h.chapterId);
      playback.seek(h.start);
      camera.reset();
      discovery.select(h.id);
    } else {
      enterPerson(target.refId);
    }
  }
  return {
    camera,
    playback,
    discovery,
    branch,
    journal,
    orchestration,
    tab,
    position,
    enterPerson,
    dispatch,
    save,
    clues,
    narrativeNode,
    nextOptions,
    followEdge,
  };
}
