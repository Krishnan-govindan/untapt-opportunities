import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Opportunity } from "@/lib/types";

export type PageContext =
  | { type: "feed"; query?: string; filter?: string }
  | {
      type: "explore";
      query?: string;
      mode?: "saved" | "research";
      resultCount?: number;
      opportunities?: Pick<
        Opportunity,
        | "id"
        | "title"
        | "pain_summary"
        | "icp"
        | "tam_estimate"
        | "urgency_score"
        | "why_now"
        | "mvp_features"
        | "pain_description"
        | "sources"
        | "sources_detail"
        | "competitors"
      >[];
    }
  | { type: "opportunity"; opportunity: Opportunity }
  | { type: "demo"; opportunity: Opportunity };

interface AgentContextValue {
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  toggle: () => void;
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);

  return (
    <AgentContext.Provider
      value={{
        isOpen,
        setOpen,
        toggle: () => setOpen((v) => !v),
        pageContext,
        setPageContext,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside AgentProvider");
  return ctx;
}
