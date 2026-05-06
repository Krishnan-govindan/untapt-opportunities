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
  competitors: { name: string; pricing: string }[];
  why_now: string;
  mvp_features: string[];
  is_hot: boolean;
  created_at: string;
};
