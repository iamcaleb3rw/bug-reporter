import { createRoot } from "react-dom/client";
import Widget from "./Widget";
import styles from "./styles.css?raw";

export function mountWidget(project: string) {
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
