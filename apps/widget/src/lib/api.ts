import type { BugReport } from "./types";

interface CreateBugReportResponse {
  id: string;
  status: "open";
  createdAt: string;
}

const apiUrl = import.meta.env.VITE_BUG_REPORTER_API_URL;

if (!apiUrl) {
  throw new Error("[BugReporter] Missing VITE_BUG_REPORTER_API_URL.");
}

export async function createBugReport(
  report: BugReport,
): Promise<CreateBugReportResponse> {
  const response = await fetch(`${apiUrl}/v1/bug-reports`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(report),
  });

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // The API may return an empty/non-JSON response.
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "We couldn't send your report.";

    throw new Error(message);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string"
  ) {
    throw new Error("The server returned an invalid response.");
  }

  return body as CreateBugReportResponse;
}
