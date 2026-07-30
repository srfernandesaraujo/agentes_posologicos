import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface EvidenceGrade {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
}

const PUBMED_LINK_RE = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i;

/** Extracts distinct PMIDs referenced as PubMed links anywhere in a message. */
export function extractPubmedIds(content: string): string[] {
  const ids = new Set<string>();
  const re = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) ids.add(match[1]);
  return Array.from(ids);
}

/** Looks up deterministic (non-LLM) evidence grades for a message's PubMed citations. */
export function usePubmedEvidenceGrades(pmids: string[]) {
  const sortedIds = [...pmids].sort();
  return useQuery({
    queryKey: ["pubmed-evidence-grade", sortedIds],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pubmed-evidence-grade", { body: { pmids: sortedIds } });
      if (error) throw error;
      return (data?.grades || {}) as Record<string, EvidenceGrade>;
    },
    enabled: sortedIds.length > 0,
    staleTime: Infinity, // a study's publication type never changes
  });
}

const TIER_STYLE: Record<EvidenceGrade["tier"], string> = {
  1: "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-300",
  2: "border-[hsl(174,62%,47%)]/40 bg-[hsl(174,62%,47%)]/[0.12] text-[hsl(174,62%,67%)]",
  3: "border-amber-500/40 bg-amber-500/[0.12] text-amber-300",
  4: "border-white/20 bg-white/[0.06] text-white/60",
  5: "border-white/10 bg-white/[0.04] text-white/40",
};

function EvidenceBadge({ grade }: { grade: EvidenceGrade }) {
  return (
    <span
      title={`Grau de evidência: ${grade.label}`}
      className={`ml-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide align-middle ${TIER_STYLE[grade.tier]}`}
    >
      {grade.label}
    </span>
  );
}

/** Builds a ReactMarkdown `a` component override: styled external links that open
 * in a new tab, with an evidence-grade badge appended to PubMed citation links. */
export function makeCitationLinkComponent(grades: Record<string, EvidenceGrade> | undefined) {
  return function CitationLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    const pmidMatch = href?.match(PUBMED_LINK_RE);
    const grade = pmidMatch ? grades?.[pmidMatch[1]] : undefined;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[hsl(174,62%,67%)] hover:underline underline-offset-2 break-words"
        {...props}
      >
        {children}
        <ExternalLink className="inline h-3 w-3 ml-0.5 mb-0.5 opacity-60" />
        {grade && <EvidenceBadge grade={grade} />}
      </a>
    );
  };
}
