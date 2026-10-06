/**
 * @fileoverview Viewport 3: HITL (Human-in-the-Loop) Triage & Swipe Arena (/triage).
 *
 * Tinder-style swiping and keyboard controls (X / C / S) for review candidates,
 * with structured rejection questionnaires that feed directly into pgvector memory.
 */

import { useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  MapPinIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  XIcon,
} from "lucide-react";

import { Frame, FramePanel } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TriageView() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [userNotes, setUserNotes] = useState("");

  const loadTriageQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping/triage");
      const json = await res.json();
      setCandidates(json.data || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to load triage candidates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTriageQueue();
  }, []);

  const currentCandidate = candidates[currentIndex];

  const handleAction = async (action: "swipe_right" | "swipe_left" | "silent_track") => {
    if (!currentCandidate) return;

    if (action === "swipe_left" && !rejecting) {
      setRejecting(true);
      return;
    }

    try {
      await fetch(`/api/shopping/triage/${currentCandidate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReasonTags: selectedTags,
          userNotes,
        }),
      });

      setRejecting(false);
      setSelectedTags([]);
      setUserNotes("");
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      console.error("Action error:", err);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (rejecting) return;
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "x") {
        handleAction("swipe_left");
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "c") {
        handleAction("swipe_right");
      } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
        handleAction("silent_track");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCandidate, rejecting, selectedTags, userNotes]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading candidate queue...
      </div>
    );
  }

  if (!currentCandidate || currentIndex >= candidates.length) {
    return (
      <Frame>
        <FramePanel className="p-12 text-center flex flex-col items-center justify-center gap-4">
          <SparklesIcon className="size-10 text-emerald-400" />
          <h3 className="text-lg font-semibold text-foreground">Triage Queue Clear!</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            All candidate proposals have been reviewed. Scheduled agents will continue looking for top deals and opportunities.
          </p>
          <Button size="sm" onClick={loadTriageQueue}>
            Refresh Queue
          </Button>
        </FramePanel>
      </Frame>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-3xl mx-auto w-full">
      {/* Triage Status Bar */}
      <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
        <span>Candidate {currentIndex + 1} of {candidates.length}</span>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">X / ←</kbd> Reject</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">S / ↓</kbd> Silent Radar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">C / →</kbd> Approve</span>
        </div>
      </div>

      {/* Main Candidate Card */}
      <Frame className="w-full overflow-hidden border-zinc-800 bg-zinc-950">
        <FramePanel className="p-0">
          {/* Cover Image */}
          {currentCandidate.imageUrl && (
            <div className="relative h-64 w-full overflow-hidden bg-zinc-900">
              <img
                src={currentCandidate.imageUrl}
                alt={currentCandidate.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge className="bg-emerald-500/90 text-zinc-950 font-bold">
                  Quality: {currentCandidate.qualityScore}%
                </Badge>
                <Badge className="bg-indigo-500/90 text-white font-semibold">
                  Uniqueness: {currentCandidate.uniquenessScore}%
                </Badge>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-xl font-bold text-white drop-shadow">{currentCandidate.title}</h3>
                <div className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
                  <MapPinIcon className="size-3.5 text-emerald-400" />
                  <span>{currentCandidate.location}</span>
                </div>
              </div>
            </div>
          )}

          {/* Details Content */}
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-zinc-300">
              {currentCandidate.description}
            </p>

            {/* Badges and Price Information */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-zinc-800 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Price / Redemption</div>
                <div className="text-lg font-bold text-emerald-400">
                  {currentCandidate.cashPrice ? `$${currentCandidate.cashPrice}` : "Points Deal"}
                  {currentCandidate.pointsRequired ? (
                    <span className="text-xs font-normal text-indigo-300 ml-2">
                      ({currentCandidate.pointsRequired.toLocaleString()} pts via {currentCandidate.pointsProgram})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                  Calendar Fit: Clear
                </Badge>
                <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs">
                  Transit: &lt; 400m
                </Badge>
              </div>
            </div>

            {/* Turnkey Itinerary Preview */}
            {currentCandidate.itineraryPlan?.legs?.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md bg-zinc-900/60 border border-zinc-800/80 p-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <SparklesIcon className="size-3.5 text-amber-400" />
                  Turnkey Itinerary Preview ({currentCandidate.itineraryPlan.legs.length} Legs)
                </div>
                {currentCandidate.itineraryPlan.legs.map((leg: any, idx: number) => (
                  <div key={idx} className="text-xs text-zinc-300 flex justify-between border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0">
                    <span><strong>Leg {idx + 1}:</strong> {leg.city} ({leg.days} Days)</span>
                    <span className="text-muted-foreground">Hotel: {leg.hotel?.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rejection Questionnaire Sheet */}
            {rejecting && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 flex flex-col gap-3">
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                  Feedback Questionnaire: Why Reject?
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    "Venue veto (acoustics / bad area)",
                    "Schedule conflict with calendar",
                    "Insufficient detail / low ROI",
                    "Unfavorable flight schedule",
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`p-2 rounded border text-left transition-colors ${
                        selectedTags.includes(tag)
                          ? "border-red-500 bg-red-500/30 text-white font-medium"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      {selectedTags.includes(tag) ? "✓ " : ""}{tag}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Optional notes for agent memory..."
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-white focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAction("swipe_left")}>
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!rejecting && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Button
                  variant="outline"
                  className="border-red-500/30 hover:bg-red-500/20 text-red-400 h-12"
                  onClick={() => handleAction("swipe_left")}
                >
                  <ArrowLeftIcon className="mr-2 size-4" /> Reject (X)
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/30 hover:bg-amber-500/20 text-amber-300 h-12"
                  onClick={() => handleAction("silent_track")}
                >
                  <ArrowDownIcon className="mr-2 size-4" /> Silent Radar (S)
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold h-12"
                  onClick={() => handleAction("swipe_right")}
                >
                  Approve (C) <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            )}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
