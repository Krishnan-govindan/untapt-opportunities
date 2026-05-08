export type SourceDetail = {
  platform: string;
  snippet: string;
  url: string;
};

export type Opportunity = {
  id: string;
  title: string;
  pain_summary: string;
  sources: string[];
  sources_detail?: SourceDetail[];
  tam_estimate: string;
  urgency_score: number;
  icp: string;
  pain_description: string;
  competitors: { name: string; pricing?: string; pricing_hint?: string; weakness?: string }[];
  why_now: string;
  mvp_features: string[];
  is_hot: boolean;
  created_at: string;
};

export type IdeaFile = {
  name: string;
  path: string;
  size: number;
  type: string;
};

export type UserIdea = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  files: IdeaFile[];
  video_url: string | null;
  research_results: Opportunity[] | null;
  created_at: string;
  updated_at: string;
};

export const IDEA_CATEGORIES = [
  "Market Research",
  "SaaS Idea",
  "Side Project",
  "Agency",
  "Marketplace",
  "Consumer App",
] as const;

export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];
