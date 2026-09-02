import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignalCard } from "./SignalCard";
import { TimeframePanel } from "./TimeframePanel";
import { PnlText, StatusBadge } from "./status";
import { formatPrice } from "@/lib/mock/data";
import type { TradingSignal } from "@/lib/mock/types";

export function SignalDetailModal({
  signal,
  onClose,
}: {
  signal: TradingSignal | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!signal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="font-mono">Détail du signal {signal?.symbol ?? ""}</DialogTitle>
        </DialogHeader>
        {signal && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={signal.status} />
              <PnlText value={signal.pnl_percent} />
              {signal.closed_price !== null && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  Clôture : {formatPrice(signal.closed_price)}
                </span>
              )}
            </div>
            <SignalCard signal={signal} />
            <TimeframePanel items={signal.timeframe_analysis} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
