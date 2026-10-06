/**
 * @fileoverview Viewport 2: Goal Matrix & Rule Engine (/goals).
 *
 * Configurable system prompts, budget parameters, "Break the Rules" emergency buy triggers,
 * hotel cleanliness blacklist/whitelist, loyalty points ratios, and calendar sweet spots.
 */

import { useEffect, useState } from "react";
import {
  AlertOctagonIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  HotelIcon,
  PlusIcon,
  SparklesIcon,
  TargetIcon,
  XCircleIcon,
} from "lucide-react";

import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function GoalsView() {
  const [goals, setGoals] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [goalsRes, rulesRes] = await Promise.all([
        fetch("/api/shopping/goals"),
        fetch("/api/shopping/rules"),
      ]);
      const goalsData = await goalsRes.json();
      const rulesData = await rulesRes.json();

      setGoals(goalsData.data || []);
      setRules(rulesData.data || []);
      if (goalsData.data?.length > 0 && !selectedGoal) {
        setSelectedGoal(goalsData.data[0]);
        setEditingPrompt(goalsData.data[0].systemPrompt || "");
      }
    } catch (err) {
      console.error("Failed to load goals:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGoalSelect = (goal: any) => {
    setSelectedGoal(goal);
    setEditingPrompt(goal.systemPrompt || "");
  };

  const handleSavePrompt = async () => {
    if (!selectedGoal) return;
    setSaving(true);
    try {
      await fetch(`/api/shopping/goals/${selectedGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: editingPrompt }),
      });
      await loadData();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Experiential Goals &amp; Rule Engine</h2>
          <p className="text-xs text-muted-foreground">
            System prompts, "Break the Rules" overrides, hotel integrity filters, and points arbitrage thresholds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Rail: Shopping Goal List */}
        <Frame className="lg:col-span-1">
          <FramePanel className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Shopping Goals ({goals.length})
            </div>
            <div className="flex flex-col gap-2">
              {goals.map((g) => {
                const isSelected = selectedGoal?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGoalSelect(g)}
                    className={`flex flex-col items-start rounded-md border p-3 text-left transition-all ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-xs font-semibold text-foreground">
                      <span>{g.title}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {g.category}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs line-clamp-2 text-muted-foreground">
                      {g.systemPrompt}
                    </div>
                    <div className="mt-2 flex items-center justify-between w-full text-[11px]">
                      <span>Budget: ${g.budgetMin} - ${g.budgetMax}</span>
                      <span className="text-emerald-400 font-medium">{g.runScheduleCron}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </FramePanel>
        </Frame>

        {/* Center/Right Pane: Goal Editor & Rule Matrices */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Selected Goal Configuration */}
          {selectedGoal && (
            <Frame>
              <FramePanel className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{selectedGoal.title}</h3>
                    <p className="text-xs text-muted-foreground">Goal ID: {selectedGoal.id}</p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Cron: {selectedGoal.runScheduleCron}
                  </Badge>
                </div>

                {/* System Prompt Editor */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Agent System Prompt &amp; Evaluation Directives
                  </label>
                  <textarea
                    rows={4}
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    className="w-full rounded-md border border-border bg-zinc-900/90 p-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSavePrompt} disabled={saving}>
                      {saving ? "Saving..." : "Save System Prompt"}
                    </Button>
                  </div>
                </div>

                {/* "Break the Rules" Emergency Trigger Card */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wide">
                    <AlertOctagonIcon className="size-4" />
                    "Break the Rules" Emergency Buy Triggers
                  </div>
                  <p className="mt-1 text-xs text-amber-200/80">
                    If an agent finds any item matching these conditions, override standard distance/budget constraints and immediately escalate for purchase.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedGoal.emergencyTriggers?.map((trigger: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="border-amber-500/50 bg-amber-500/20 text-amber-300 text-xs">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </div>
              </FramePanel>
            </Frame>
          )}

          {/* Self-Serve Rules Engine: Hotel Whitelist/Blacklist, Points, Travel Pace */}
          <Frame>
            <FramePanel className="p-5 flex flex-col gap-4">
              <FrameHeader className="p-0 pb-2">
                <FrameTitle className="text-sm font-semibold flex items-center gap-2">
                  <HotelIcon className="size-4 text-indigo-400" />
                  Self-Serve Rules Matrix
                </FrameTitle>
              </FrameHeader>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Hotel Blacklist Card */}
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase">
                    <XCircleIcon className="size-4" />
                    Hotel Blacklist (Hygiene &amp; Bugs)
                  </div>
                  <div className="text-xs text-red-200/90 font-medium">Hilton Palm Springs</div>
                  <p className="text-[11px] text-red-300/70">
                    "Dead bugs found in sheets and pillows during friend's wedding trip. Unacceptable hygiene standards."
                  </p>
                </div>

                {/* Hotel Whitelist Card */}
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase">
                    <CheckCircle2Icon className="size-4" />
                    Hotel Whitelist (Boutique &amp; Transit)
                  </div>
                  <div className="text-xs text-emerald-200/90 font-medium">Boutique Hotels &lt; 400m from Subway</div>
                  <p className="text-[11px] text-emerald-300/70">
                    "Kimpton Da An Taipei, The Clan Hotel Singapore. High cleanliness scores, quiet high floor, non-resort."
                  </p>
                </div>
              </div>

              {/* Loyalty Points Arbitrage Card */}
              <div className="rounded-md border border-border bg-zinc-900/60 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase">
                  <CreditCardIcon className="size-4 text-indigo-400" />
                  Loyalty Points Inventory &amp; Arbitrage Ratio
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-1">
                  <div className="border border-border/60 rounded p-2 bg-zinc-950">
                    <div className="text-muted-foreground text-[10px]">Chase Sapphire Reserve</div>
                    <div className="font-bold text-foreground mt-0.5">280,000 pts</div>
                  </div>
                  <div className="border border-border/60 rounded p-2 bg-zinc-950">
                    <div className="text-muted-foreground text-[10px]">Amex Platinum</div>
                    <div className="font-bold text-foreground mt-0.5">320,000 pts</div>
                  </div>
                  <div className="border border-border/60 rounded p-2 bg-zinc-950">
                    <div className="text-muted-foreground text-[10px]">Singapore Airlines KrisFlyer</div>
                    <div className="font-bold text-foreground mt-0.5">110,000 pts</div>
                  </div>
                </div>
              </div>
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  );
}
