import type { components } from "@/lib/api-schema";

type Schemas = components["schemas"];
export type Me = Schemas["MeOut"];
export type Membership = Schemas["MembershipOut"];
export type Workspace = Schemas["WorkspaceOut"];
export type Item = Schemas["ItemOut"];
export type ItemPage = Schemas["ItemPage"];
export type ItemPatch = Schemas["ItemPatch"];
export type Comment = Schemas["CommentOut"];
export type Activity = Schemas["ActivityOut"];
export type Source = Schemas["SourceOut"];
export type Health = Schemas["HealthOut"];

export const STATUSES = ["to_check", "in_progress", "verified", "published"] as const;
export type Status = (typeof STATUSES)[number];

export const VERDICTS = ["true", "misleading", "false", "unverifiable"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type Origin = "facebook" | "whatsapp" | "tiktok" | "radio" | "press" | "other";

/** The claim fields kept in `item.data` (see the API's generic item model). */
export type ClaimData = {
  ref?: string;
  first_seen_at?: string;
  origin?: Origin;
  verdict?: Verdict | null;
  verdict_suggested?: Verdict | null;
  source_count?: number;
  assignee_id?: string | null;
  analysis?: Analysis;
  // Written by the signing route only (`POST …/items/{id}/sign`), never by a PATCH.
  reason?: string;
  signed_by?: string;
  signed_at?: string;
  byline?: { newsroom?: string; journalist?: string; signed_at?: string };
  voice_note?: { file_id: string; seconds?: number | null; language?: string };
};

/** A signed verdict: the newsroom's byline is on it (« Signer et publier »). */
export const isSigned = (d: ClaimData) => !!d.verdict && !!d.signed_by;

export type Analysis = {
  claims: string[];
  evidence: { source_id?: string; source?: string; stance: string; quote: string }[];
  reason: string;
  missing?: string;
  model?: string;
};

/** What the link check streams back in its `result` event. */
export type CheckResult = {
  url: string | null;
  platform: string | null;
  kind?: string;
  final_url?: string | null;
  title?: string;
  site?: string | null;
  author?: string | null;
  excerpt?: string;
  summary?: string;
  claims?: string[];
  signals?: { type: string; quote: string; why: string }[];
  results?: { n: number; kind: string; title: string; url: string; snippet: string }[];
  analysis?: {
    verdict: Verdict;
    reason: string;
    evidence: { result: number; stance: string; quote: string }[];
    missing: string;
    model?: string;
  };
  image?: { ai_markers?: string[]; content_credentials?: boolean; exif?: Record<string, string> };
  file?: { filename: string; mime: string; meta: { ai_markers?: string[]; content_credentials?: boolean; duration_s?: number; language?: string } };
  reverse_search?: { name: string; url: string }[];
  tracked?: { item_id: string; ref?: string | null; title: string } | null;
  source_id?: string;
  needs_text?: boolean;
  read_error?: string;
};
