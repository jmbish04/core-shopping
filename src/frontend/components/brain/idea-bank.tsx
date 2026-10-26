/**
 * @fileoverview The idea bank on `/brain` (maestro cs-gap-idea-bank).
 *
 * The brief asks for accumulation that is drawn FROM, not just added to:
 * "storing ideas for future travel next year ...so that overtime the agent is
 * starting to capture some really good ideas and can easily pull from this
 * collection over time". So a row shows the three things that decide whether
 * to pull it — its season, its confidence, and what it is about — and the
 * action is "Promote to goal", which is the pulling.
 *
 * Real rows or a real empty state, never a placeholder. The empty state says
 * where ideas come from rather than "no data", because an empty idea bank on a
 * new install is correct and a reader needs to know what fills it.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRangeIcon, LightbulbIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/common/shared";
import { apiGet, apiSend, ApiError } from "@/lib/api";

/** One idea, as `GET /api/ideas` answers it. */
interface Idea {
  id: string;
  title: string;
  category: string;
  rationale: string;
  season: string | null;
  confidence: number;
  status: string;
  revisit_after: string | null;
  promoted_goal_id: string | null;
  entities: Array<{ entity_id: string; role: string; title: string; kind: string }>;
  created_at: string;
}

interface IdeasPayload {
  as_of: string;
  ideas: Idea[];
}

const CATEGORY_LABELS: Record<string, string> = {
  experience: "Experience",
  travel: "Travel",
  product: "Product",
  gift: "Gift",
  deal: "Deal",
  research: "Research",
};

/**
 * Confidence as a word plus the figure.
 *
 * A bare 0.8 is not something a person reads, and a bar with no number hides
 * which side of a threshold it is on, so both are shown. A confidence of
 * exactly 0 is "unrated" rather than "no confidence": nothing has scored it
 * yet, and drawing that as 0% would read as a judgement nobody made.
 */
function confidenceLabel(confidence: number): { word: string; figure: string } {
  if (confidence <= 0) return { word: "Unrated", figure: "—" };
  const figure = `${Math.round(confidence * 100).toLocaleString("en-US")}%`;
  if (confidence >= 0.75) return { word: "Strong", figure };
  if (confidence >= 0.4) return { word: "Worth a look", figure };
  return { word: "Early", figure };
}

function IdeaRow({ idea, onPromote, promoting }: {
  idea: Idea;
  onPromote: (id: string) => void;
  promoting: string | null;
}) {
  const confidence = confidenceLabel(idea.confidence);
  const isPromoted = idea.status === "promoted";

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
      <LightbulbIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium">{idea.title}</span>
          <Badge variant="secondary" size="sm">
            {CATEGORY_LABELS[idea.category] ?? idea.category}
          </Badge>
          {idea.season ? (
            <Badge variant="info-light" size="sm">
              <CalendarRangeIcon className="size-3" aria-hidden="true" />
              {idea.season}
            </Badge>
          ) : (
            <Badge variant="secondary" size="sm">
              No season yet
            </Badge>
          )}
          <Badge variant={idea.confidence >= 0.75 ? "success-light" : "secondary"} size="sm">
            {confidence.word} · {confidence.figure}
          </Badge>
        </div>
        {idea.rationale ? (
          <p className="text-muted-foreground text-xs">{idea.rationale}</p>
        ) : null}
        {idea.entities.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {idea.entities.map((entity) => (
              <Badge key={entity.entity_id} variant="outline" size="sm">
                {entity.role ? `${entity.role}: ` : ""}
                {entity.title}
              </Badge>
            ))}
          </div>
        ) : null}
        {idea.revisit_after ? (
          <span className="text-muted-foreground text-xs">
            Held back until {idea.revisit_after}
          </span>
        ) : null}
      </div>
      <div className="shrink-0">
        {isPromoted && idea.promoted_goal_id ? (
          // `Button` here has no `asChild`, so the link carries the variant
          // classes directly rather than being wrapped in one.
          // ponytail: /goals/{slug} does not exist yet (cs-fe-3-1), so this
          // points at the goal's runs, the same stand-in the Overview uses.
          <a
            href={`/runs?goal=${encodeURIComponent(idea.promoted_goal_id)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Promoted
          </a>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={promoting === idea.id}
            onClick={() => onPromote(idea.id)}
          >
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            {promoting === idea.id ? "Promoting…" : "Promote to goal"}
          </Button>
        )}
      </div>
    </li>
  );
}

/** The idea bank. One surface: a `Frame`, matching the rest of `/brain`. */
export function IdeaBank() {
  const [payload, setPayload] = useState<IdeasPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPayload(await apiGet<IdeasPayload>("ideas"));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load the idea bank.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const promote = useCallback(
    async (id: string) => {
      setPromoting(id);
      setError(null);
      try {
        await apiSend("POST", `ideas/${encodeURIComponent(id)}/promote`, {});
        await load();
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Could not promote that idea.");
      } finally {
        setPromoting(null);
      }
    },
    [load],
  );

  const ideas = payload?.ideas ?? [];

  return (
    <Frame>
      <FrameHeader>
        <div className="flex flex-col gap-1">
          <FrameTitle>Idea bank</FrameTitle>
          <FrameDescription>
            Dateless things worth targeting, kept when a dated proposal is declined.
          </FrameDescription>
        </div>
        {ideas.length > 0 ? (
          <Badge variant="secondary" size="sm">
            {ideas.length.toLocaleString("en-US")} {ideas.length === 1 ? "idea" : "ideas"}
          </Badge>
        ) : null}
      </FrameHeader>
      <FramePanel>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!error && payload && ideas.length === 0 ? (
          <EmptyState
            icon={<LightbulbIcon />}
            title="No ideas kept yet"
            description="Declining a dated proposal can keep the idea behind it — a season and a reason, without the dates. Those appear here and in every briefing for the same category."
          />
        ) : null}
        {ideas.length > 0 ? (
          <ul className="divide-border/60 divide-y">
            {ideas.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} onPromote={promote} promoting={promoting} />
            ))}
          </ul>
        ) : null}
      </FramePanel>
    </Frame>
  );
}
