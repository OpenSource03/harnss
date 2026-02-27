/**
 * Utility to detect and extract `<proposed_plan>` XML blocks from assistant messages.
 * Both Claude (via system prompt) and Codex (via collaborationMode) produce plans in
 * this format, so the parser is engine-agnostic.
 */

export interface ProposedPlan {
  title: string;
  content: string;
  /** The full raw match including XML tags */
  raw: string;
}

const PLAN_REGEX = /<proposed_plan(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/proposed_plan>/;

/** Extract a proposed_plan block from message content. Returns null if none found. */
export function extractProposedPlan(content: string): ProposedPlan | null {
  const match = PLAN_REGEX.exec(content);
  if (!match) return null;
  return {
    title: match[1] || "Implementation Plan",
    content: match[2].trim(),
    raw: match[0],
  };
}

/** Check if content contains a partial/streaming proposed_plan opening tag (not yet closed). */
export function hasPartialPlanTag(content: string): boolean {
  return content.includes("<proposed_plan") && !content.includes("</proposed_plan>");
}

/** Get the text content BEFORE the plan block (analysis/discussion). */
export function getPrePlanContent(content: string): string {
  const match = PLAN_REGEX.exec(content);
  if (!match) return content;
  return content.slice(0, match.index).trim();
}
