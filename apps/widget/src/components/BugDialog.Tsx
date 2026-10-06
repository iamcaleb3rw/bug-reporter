import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRightIcon,
  CameraIcon,
  CaretDownIcon,
  CheckIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { createBugReport } from "../lib/api";
import { collectBugContext } from "../lib/context";

import type { BugReport, BugType } from "../lib/types";

interface BugDialogProps {
  open: boolean;
  project: string;
  onClose: () => void;
}

const bugTypes: Array<{
  value: BugType;
  label: string;
}> = [
  {
    value: "functional",
    label: "Doesn't work",
  },
  {
    value: "visual",
    label: "Looks wrong",
  },
  {
    value: "performance",
    label: "Too slow",
  },
  {
    value: "content",
    label: "Content",
  },
  {
    value: "accessibility",
    label: "Accessibility",
  },
  {
    value: "other",
    label: "Other",
  },
];

export function BugDialog({ open, project, onClose }: BugDialogProps) {
  const [description, setDescription] = useState("");

  const [type, setType] = useState<BugType>("functional");

  const [reproductionSteps, setReproductionSteps] = useState("");

  const [showReproduction, setShowReproduction] = useState(false);

  const [showScreenshot, setShowScreenshot] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      descriptionRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setSubmitting(false);
      setSubmitError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const canSubmit = description.trim().length > 0 && !submitting && !submitted;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    const report: BugReport = {
      project,

      description: description.trim(),

      type,

      reproductionSteps: reproductionSteps.trim() || undefined,

      context: collectBugContext(),
    };

    try {
      await createBugReport(report);

      setSubmitted(true);
    } catch (error) {
      console.error("[BugReporter] Failed to create report:", error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn't send your report. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) {
      return;
    }

    onClose();
  }

  return (
    <div
      className="bug-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className={`bug-dialog ${submitted ? "is-submitted" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-dialog-title"
      >
        {submitted ? (
          <div className="bug-success">
            <div className="bug-success-icon">
              <CheckIcon size={20} weight="bold" />
            </div>

            <div className="bug-success-content">
              <h2>Report received</h2>

              <p>Thanks. We've captured the details and page context.</p>
            </div>

            <button
              type="button"
              className="bug-primary bug-success-button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <header className="bug-dialog-header">
              <div className="bug-dialog-heading">
                <span className="bug-dialog-kicker">Feedback</span>

                <h2 id="bug-dialog-title">Report an issue</h2>
              </div>

              <button
                type="button"
                className="bug-close"
                aria-label="Close"
                onClick={handleClose}
                disabled={submitting}
              >
                <XIcon size={18} weight="bold" />
              </button>
            </header>

            <div className="bug-dialog-scroll" tabIndex={0}>
              <form className="bug-form" onSubmit={handleSubmit}>
                <div className="bug-primary-field">
                  <label htmlFor="bug-description" className="bug-field-label">
                    What's happening?
                  </label>

                  <textarea
                    ref={descriptionRef}
                    id="bug-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);

                      if (submitError) {
                        setSubmitError(null);
                      }
                    }}
                    placeholder="Tell us what went wrong..."
                    rows={4}
                    disabled={submitting}
                  />
                </div>

                <fieldset className="bug-type-field">
                  <legend className="bug-field-label">
                    What kind of issue?
                  </legend>

                  <div className="bug-type-grid">
                    {bugTypes.map((bugType) => {
                      const selected = type === bugType.value;

                      return (
                        <label
                          key={bugType.value}
                          className={`bug-type-option ${
                            selected ? "is-selected" : ""
                          } ${submitting ? "is-disabled" : ""}`}
                        >
                          <input
                            type="radio"
                            name="bug-type"
                            value={bugType.value}
                            checked={selected}
                            disabled={submitting}
                            onChange={() => setType(bugType.value)}
                          />

                          <span>{bugType.label}</span>

                          {selected && (
                            <CheckIcon
                              size={14}
                              weight="bold"
                              className="bug-type-check"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="bug-secondary-options">
                  <button
                    type="button"
                    className={`bug-disclosure ${
                      showReproduction ? "is-open" : ""
                    }`}
                    onClick={() => setShowReproduction((current) => !current)}
                    aria-expanded={showReproduction}
                    disabled={submitting}
                  >
                    <span className="bug-disclosure-main">
                      <span className="bug-disclosure-icon">
                        <ArrowUpRightIcon size={15} weight="bold" />
                      </span>

                      <span>Add reproduction steps</span>
                    </span>

                    <CaretDownIcon
                      size={15}
                      weight="bold"
                      className="bug-disclosure-chevron"
                    />
                  </button>

                  {showReproduction && (
                    <div className="bug-disclosure-content">
                      <textarea
                        value={reproductionSteps}
                        onChange={(event) => {
                          setReproductionSteps(event.target.value);

                          if (submitError) {
                            setSubmitError(null);
                          }
                        }}
                        placeholder={"1. Open...\n2. Click...\n3. Notice..."}
                        rows={4}
                        disabled={submitting}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className={`bug-disclosure ${
                      showScreenshot ? "is-open" : ""
                    }`}
                    onClick={() => setShowScreenshot((current) => !current)}
                    aria-expanded={showScreenshot}
                    disabled={submitting}
                  >
                    <span className="bug-disclosure-main">
                      <span className="bug-disclosure-icon">
                        <CameraIcon size={15} weight="bold" />
                      </span>

                      <span>Add a screenshot</span>
                    </span>

                    <CaretDownIcon
                      size={15}
                      weight="bold"
                      className="bug-disclosure-chevron"
                    />
                  </button>

                  {showScreenshot && (
                    <div className="bug-disclosure-content">
                      <div className="bug-screenshot-placeholder">
                        <CameraIcon size={20} weight="regular" />

                        <div>
                          <strong>Screenshot capture</strong>

                          <span>Capture will be available here soon.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bug-context">
                  <div className="bug-context-line">
                    <span>Page</span>

                    <code>{window.location.pathname || "/"}</code>
                  </div>

                  <div className="bug-context-line">
                    <span>Viewport</span>

                    <code>
                      {window.innerWidth} × {window.innerHeight}
                    </code>
                  </div>
                </div>

                {submitError && (
                  <div className="bug-submit-error" role="alert">
                    <WarningCircleIcon size={16} weight="bold" />

                    <span>{submitError}</span>
                  </div>
                )}

                <footer className="bug-actions">
                  <button
                    type="button"
                    className="bug-secondary"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="bug-primary"
                    disabled={!canSubmit}
                  >
                    <span>
                      {submitting
                        ? "Sending..."
                        : submitError
                          ? "Try again"
                          : "Send report"}
                    </span>

                    {!submitting && (
                      <ArrowUpRightIcon size={15} weight="bold" />
                    )}
                  </button>
                </footer>

                <div className="bug-form-bottom-space" aria-hidden="true" />
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
