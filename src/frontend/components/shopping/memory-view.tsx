/**
 * @fileoverview Viewport 6: Agent Vector Memory & Taste Calibrator (/memory).
 *
 * Scope rail, confidence-weighted memory items, reasoning origins, and manual preference overrides.
 */

import { useEffect, useState } from "react";
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  FilterIcon,
  ShieldCheckIcon,
  SlidersIcon,
  Trash2Icon,
} from "lucide-react";

import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function MemoryView() {
  const [data, setData] = useState<any>(null);
  const [selectedScope, setSelectedScope] = useState("All Scopes");
  const [loading, setLoading] = useState(true);

  const scopes = [
    "All Scopes",
    "Hotels & Hospitality",
    "Airlines & Cabins",
    "Shopping & Luxury",
    "Downtime & Pace",
  ];

  const loadMemoryData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping/memory");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load memory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemoryData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading Agent Vector Memory...
      </div>
    );
  }

  const memoryItems = (data?.memoryItems || []).filter((item: any) =>
    selectedScope === "All Scopes" ? true : item.scope === selectedScope
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
              <BrainCircuitIcon className="mr-1 size-3.5" />
              Calibrated Preference Embeddings
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground mt-1">Agent Vector Memory &amp; Taste Calibrator</h2>
          <p className="text-xs text-muted-foreground">
            View, adjust, and prune retained preferences synthesized from your explicit rules, HITL swipe decisions, and goal contexts.
          </p>
        </div>
      </div>

      {/* Scope Filter Rail */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {scopes.map((scope) => (
          <Button
            key={scope}
            size="sm"
            variant={selectedScope === scope ? "default" : "outline"}
            className={selectedScope === scope ? "bg-indigo-600 text-white" : "border-border text-muted-foreground"}
            onClick={() => setSelectedScope(scope)}
          >
            {scope}
          </Button>
        ))}
      </div>

      {/* Memory Items Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {memoryItems.map((item: any) => (
          <Frame key={item.id}>
            <FramePanel className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-[11px]">
                  {item.scope}
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <ShieldCheckIcon className="size-3.5" />
                  Confidence: {Math.round(item.confidence * 100)}%
                </div>
              </div>

              <p className="text-sm font-medium text-foreground leading-relaxed">
                {item.preference}
              </p>

              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Origin: {item.source}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400 hover:text-white">
                    <SlidersIcon className="mr-1 size-3" /> Adjust Weight
                  </Button>
                </div>
              </div>
            </FramePanel>
          </Frame>
        ))}
      </div>
    </div>
  );
}
