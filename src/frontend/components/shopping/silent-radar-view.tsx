/**
 * @fileoverview Viewport 5: Silent Price Radar & Wishlist (/radar).
 *
 * Zero-spam background tracking for conflict-vetoed proposals with price delta history.
 */

import { useEffect, useState } from "react";
import {
  ActivityIcon,
  ArrowDownIcon,
  BellOffIcon,
  EyeIcon,
  MapPinIcon,
  TrendingDownIcon,
} from "lucide-react";

import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";

export function SilentRadarView() {
  const [trackedItems, setTrackedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRadarData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping/radar");
      const json = await res.json();
      setTrackedItems(json.data || []);
    } catch (err) {
      console.error("Failed to load radar items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRadarData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        Loading Silent Price Radar...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
              <BellOffIcon className="mr-1 size-3" />
              Zero-Spam Background Radar Active
            </Badge>
          </div>
          <h2 className="text-lg font-bold text-foreground mt-1">Silent Price Radar &amp; Deferred Opportunities</h2>
          <p className="text-xs text-muted-foreground">
            Monitors secondary ticket markets and flight award drops for schedule-vetoed items without dispatching notifications until actionable price thresholds are passed.
          </p>
        </div>
      </div>

      {/* Grid of Tracked Items */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {trackedItems.map((item) => (
          <Frame key={item.id}>
            <FramePanel className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <MapPinIcon className="size-3.5 text-emerald-400" />
                    <span>{item.location}</span>
                  </div>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  Silent Tracking
                </Badge>
              </div>

              <p className="text-xs text-zinc-300">{item.description}</p>

              {/* Price Log Delta Timeline */}
              <div className="flex flex-col gap-2 rounded-md bg-zinc-900/80 border border-zinc-800 p-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <TrendingDownIcon className="size-3.5 text-emerald-400" />
                  Price Observation History
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  {item.priceLogs?.map((log: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-1 last:border-0 last:pb-0">
                      <span className="text-zinc-400">{new Date(log.loggedAt).toLocaleDateString()}</span>
                      <span className="font-mono font-semibold text-emerald-400">${log.loggedPrice}</span>
                      <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">{log.notes}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FramePanel>
          </Frame>
        ))}
      </div>
    </div>
  );
}
