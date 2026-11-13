import { PartyPopper, X } from "lucide-react";

export type Celebration = { id: number; title: string; body: string };

export function MilestoneCelebration({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  return (
    <div className="milestone" role="status" aria-live="polite">
      <div className="milestone__confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
      </div>
      <span className="milestone__icon"><PartyPopper className="h-6 w-6" /></span>
      <div className="min-w-0">
        <p className="font-bold text-foreground">{celebration.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{celebration.body}</p>
      </div>
      <button type="button" className="btn btn--ghost btn--icon ml-auto" onClick={onClose} aria-label="Dismiss celebration">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
