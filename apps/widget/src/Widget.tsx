import { useState } from "react";
import { BugButton } from "./components/BugButton";
import { BugDialog } from "./components/BugDialog";

interface WidgetProps {
  project: string;
}

export default function Widget({ project }: WidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BugButton open={open} onClick={() => setOpen((current) => !current)} />

      <BugDialog open={open} project={project} onClose={() => setOpen(false)} />
    </>
  );
}
