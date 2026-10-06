import type { BugContext } from "./types";

export function collectBugContext(): BugContext {
  return {
    url: window.location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}
