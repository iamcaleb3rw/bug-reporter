import { createRoot } from "react-dom/client";
import Widget from "./Widget";
import styles from "./styles.css?raw";

const script = document.currentScript;

function bootstrap(script: HTMLScriptElement) {
  const project = script.dataset.project;

  if (!project) {
    console.error("[BugReporter] Missing required `data-project` attribute.");
    return;
  }

  const host = document.createElement("div");

  host.setAttribute("data-bug-reporter", "");

  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({
    mode: "closed",
  });

  const style = document.createElement("style");

  style.textContent = styles;

  shadowRoot.appendChild(style);

  const root = createRoot(shadowRoot);

  root.render(<Widget project={project} />);
}

if (script instanceof HTMLScriptElement) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootstrap(script), {
      once: true,
    });
  } else {
    bootstrap(script);
  }
} else {
  console.error("[BugReporter] Could not identify the widget script.");
}
