import { BugIcon } from "@phosphor-icons/react";

interface BugButtonProps {
  open: boolean;
  onClick: () => void;
}

export function BugButton({ open, onClick }: BugButtonProps) {
  return (
    <button
      type="button"
      aria-label={open ? "Close bug reporter" : "Report a bug"}
      aria-expanded={open}
      onClick={onClick}
      className={`bug-button ${open ? "is-open" : ""}`}
    >
      <BugIcon size={18} weight="bold" className="bug-button-icon" />

      <span>Report an issue</span>
    </button>
  );
}
