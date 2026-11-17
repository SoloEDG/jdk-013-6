import { ref } from "vue";
import { hotspots } from "../../../shared/content";
import type { Entry, Hotspot, Position } from "../../../shared/types";
import { loadEntries, persist } from "../lib/storage";
export function createJournal() {
  const entries = ref<Entry[]>(loadEntries()),
    error = ref("");
  function commit(next: Entry[]) {
    if (!persist(next)) {
      error.value = "本地空间不足，记录未保存，请先导出手记";
      return;
    }
    entries.value = next;
    error.value = "";
  }
  return {
    entries,
    error,
    has: (id: string) => entries.value.some((e) => e.hotspotId === id),
    save: (hotspot: Hotspot, position: Position) => {
      if (entries.value.some((e) => e.hotspotId === hotspot.id)) return;
      commit([
        ...entries.value,
        {
          id: crypto.randomUUID(),
          hotspotId: hotspot.id,
          chapterId: position.chapterId,
          time: position.time,
          camera: { ...position.camera },
          title: hotspot.title,
          note: "",
          createdAt: Date.now(),
        },
      ]);
    },
    remove: (id: string) => commit(entries.value.filter((e) => e.id !== id)),
    /** 故事节点被删除时：把受影响收藏标记为失效（保留记录，不悄悄改指） */
    markOrphaned: (ids: string[]) =>
      commit(
        entries.value.map((e) =>
          ids.includes(e.id) ? { ...e, orphaned: true } : e,
        ),
      ),
    /** 策展人在重接方案中显式选择后，才把收藏改接到另一个热点故事 */
    rewireTo: (id: string, hotspotId: string) => {
      const h = hotspots.find((h) => h.id === hotspotId);
      if (!h) return;
      commit(
        entries.value.map((e) =>
          e.id === id
            ? {
                ...e,
                hotspotId: h.id,
                chapterId: h.chapterId,
                title: h.title,
                orphaned: false,
              }
            : e,
        ),
      );
    },
    note: (id: string, note: string) =>
      commit(
        entries.value.map((e) =>
          e.id === id ? { ...e, note: note.slice(0, 500) } : e,
        ),
      ),
  };
}
export type Journal = ReturnType<typeof createJournal>;
