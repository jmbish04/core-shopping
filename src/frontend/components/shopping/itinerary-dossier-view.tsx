/**
 * @fileoverview Viewport 4: Turnkey Experiential Proposal & Choose-Your-Own-Adventure Dossier (/itineraries).
 *
 * 3-Pane Command Layout (Left: Trip Outline & Legs; Center: Turnkey Day-by-Day with transit & rest blocks; Right: Choose-Your-Own-Adventure forks).
 */

import { useEffect, useState } from "react";
import {
  CalendarIcon,
  ClockIcon,
  CompassIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MoonIcon,
  NavigationIcon,
  PlaneIcon,
  SparklesIcon,
  ShoppingBagIcon,
  UtensilsIcon,
} from "lucide-react";

import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ItineraryDossierView() {
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<any>(null);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadItineraries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping/itineraries");
      const json = await res.json();
      setItineraries(json.data || []);
      if (json.data?.length > 0) {
        setSelectedItinerary(json.data[0]);
      }
    } catch (err) {
      console.error("Failed to load itineraries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItineraries();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading turnkey itinerary dossiers...
      </div>
    );
  }

  if (!selectedItinerary) {
    return (
      <Frame>
        <FramePanel className="p-8 text-center text-sm text-muted-foreground">
          No approved itineraries found. Swipe right on candidates in the HITL Swipe Arena to generate turnkey dossiers.
        </FramePanel>
      </Frame>
    );
  }

  const legs = selectedItinerary.itineraryPlan?.legs || [];
  const currentLeg = legs[activeLegIndex] || legs[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Verified Turnkey Dossier
            </Badge>
            <span className="text-xs text-muted-foreground">{selectedItinerary.location}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mt-1">{selectedItinerary.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Est. Cost / Points</div>
            <div className="text-sm font-bold text-emerald-400">
              ${selectedItinerary.cashPrice || 0} + {selectedItinerary.pointsRequired?.toLocaleString() || 0} pts
            </div>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold">
            Book Flights &amp; Hotels
          </Button>
        </div>
      </div>

      {/* 3-Pane Command Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Pane (Col 1-3): Trip Outline & City Legs */}
        <Frame className="lg:col-span-3">
          <FramePanel className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PlaneIcon className="size-3.5 text-indigo-400" />
              Trip Outline ({legs.length} City Legs)
            </div>

            <div className="flex flex-col gap-2">
              {legs.map((leg: any, idx: number) => {
                const isSelected = activeLegIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveLegIndex(idx)}
                    className={`flex flex-col items-start rounded-md border p-3 text-left transition-all ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-xs font-bold text-foreground">
                      <span>Leg {idx + 1}: {leg.city}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {leg.days} Days
                      </Badge>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPinIcon className="size-3 text-emerald-400" />
                      <span className="truncate">{leg.hotel?.name}</span>
                    </div>

                    <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">
                      {leg.hotel?.why}
                    </p>
                  </button>
                );
              })}
            </div>
          </FramePanel>
        </Frame>

        {/* Center Pane (Col 4-8): Turnkey Day-by-Day Schedule */}
        <Frame className="lg:col-span-6">
          <FramePanel className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {currentLeg?.city} Day-by-Day Itinerary
                </h3>
                <p className="text-xs text-muted-foreground">
                  Hotel: {currentLeg?.hotel?.name} ({currentLeg?.hotel?.transitWalkMinutes} min walk to MRT)
                </p>
              </div>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400">
                Transit Connected
              </Badge>
            </div>

            {/* Micro-Scheduled Activity Blocks */}
            <div className="flex flex-col gap-3">
              {currentLeg?.activities?.map((act: any, idx: number) => {
                const isRestBlock = act.name?.includes("REST") || act.name?.includes("NAP");
                return (
                  <div
                    key={idx}
                    className={`flex flex-col gap-1 rounded-md border p-3 ${
                      isRestBlock
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-border bg-zinc-900/60 text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold">
                        {isRestBlock ? (
                          <MoonIcon className="size-3.5 text-amber-400" />
                        ) : (
                          <ClockIcon className="size-3.5 text-emerald-400" />
                        )}
                        <span>{act.time}</span>
                        <span className="text-foreground">{act.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <NavigationIcon className="size-3 text-indigo-400" />
                        <span>{act.transit}</span>
                      </div>
                    </div>

                    {act.bookingUrl && (
                      <div className="mt-1 flex justify-end">
                        <a
                          href={act.bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          Reservation Link <ExternalLinkIcon className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </FramePanel>
        </Frame>

        {/* Right Pane (Col 9-12): "Choose-Your-Own-Adventure" Pre-Selected Forks */}
        <Frame className="lg:col-span-3">
          <FramePanel className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CompassIcon className="size-3.5 text-amber-400" />
              Choose-Your-Own-Adventure Forks
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pre-vetted alternative activity options for {currentLeg?.city} if you want to switch things up.
            </p>

            <div className="flex flex-col gap-3 mt-1">
              {currentLeg?.adventureForks?.map((fork: any, idx: number) => (
                <div key={idx} className="rounded-md border border-zinc-800 bg-zinc-900/90 p-3 flex flex-col gap-1">
                  <div className="text-xs font-semibold text-emerald-400">{fork.title}</div>
                  <p className="text-[11px] text-zinc-300">{fork.description}</p>
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}
