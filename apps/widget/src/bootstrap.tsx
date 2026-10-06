import { mountWidget } from "./mount";

const script = document.currentScript;

function bootstrap() {
  if (!(script instanceof HTMLScriptElement)) {
    console.error("[BugReporter] Could not identify the widget script.");
    return;
  }

  const project = script.dataset.project;

  if (!project) {
    console.error("[BugReporter] Missing required `data-project` attribute.");
    return;
  }

  mountWidget(project);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, {
    once: true,
  });
} else {
  bootstrap();
}
