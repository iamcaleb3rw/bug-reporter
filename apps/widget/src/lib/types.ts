export type BugType =
  | "functional"
  | "visual"
  | "performance"
  | "content"
  | "accessibility"
  | "other";

export interface BugReportDraft {
  description: string;
  type: BugType;
  reproductionSteps: string;
}

export interface BugContext {
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
  };
}

export interface BugReport {
  project: string;
  description: string;
  type: BugType;
  reproductionSteps?: string;
  context: BugContext;
}
