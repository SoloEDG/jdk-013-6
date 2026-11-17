import type { PublishedStory, StoryGraph } from "../model/types";

const DRAFT_KEY = "tidal-story-draft-v1";
const PUBLISHED_KEY = "tidal-story-published-v1";

function isGraph(raw: unknown): raw is StoryGraph {
  if (!raw || typeof raw !== "object") return false;
  const g = raw as StoryGraph;
  return (
    typeof g.startId === "string" &&
    Array.isArray(g.nodes) &&
    Array.isArray(g.edges) &&
    g.nodes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.refId === "string" &&
        typeof n.title === "string" &&
        Number.isFinite(n.version),
    ) &&
    g.edges.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.from === "string" &&
        typeof e.to === "string" &&
        Array.isArray(e.requires),
    )
  );
}

export function loadDraft(): StoryGraph | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return isGraph(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function persistDraft(graph: StoryGraph): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(graph));
  } catch {
    /* 本地空间不足时草稿仅保留在内存中 */
  }
}

export function loadPublished(): PublishedStory | null {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(PUBLISHED_KEY) || "null",
    );
    if (
      raw &&
      typeof raw === "object" &&
      Number.isFinite((raw as PublishedStory).version) &&
      isGraph((raw as PublishedStory).graph)
    )
      return raw as PublishedStory;
    return null;
  } catch {
    return null;
  }
}

export function persistPublished(story: PublishedStory): void {
  try {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(story));
  } catch {
    /* 同上 */
  }
}
