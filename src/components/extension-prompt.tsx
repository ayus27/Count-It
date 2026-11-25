import { useEffect, useState } from "react";
import { Download, HelpCircle, Puzzle, X } from "lucide-react";

export const CHROME_EXTENSION_ZIP = "/count-it-extension.zip";
const DISMISSED_KEY = "countit_ext_prompt_dismissed";

function isPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setPromptDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

export function ExtensionPrompt() {
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  useEffect(() => {
    setDismissed(isPromptDismissed());
  }, []);

  if (dismissed && !showInstructions) return null;

  const dismiss = () => {
    setPromptDismissed();
    setDismissed(true);
    setShowInstructions(false);
  };

  return (
    <>
      {!dismissed && (
        <div
          className="section-panel mt-4 flex flex-wrap items-center justify-between gap-3 py-3 px-4 border border-primary/20 bg-card"
          role="region"
          aria-label="Chrome extension download"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Puzzle className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Get the Count-It Chrome Extension</p>
              <p className="text-xs text-muted-foreground">
                Auto-tally CLMS calls, fast remarks, and floating widget on your screen. Free local install.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap">
            <button
              type="button"
              className="btn btn--sm btn--outline text-xs gap-1.5"
              onClick={() => setShowInstructions(true)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>How to install</span>
            </button>
            <a
              href={CHROME_EXTENSION_ZIP}
              download="count-it-extension.zip"
              className="btn btn--sm btn--primary text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Download ZIP</span>
            </a>
            <button
              type="button"
              className="btn btn--sm btn--ghost text-xs text-muted-foreground hover:text-foreground"
              onClick={dismiss}
              aria-label="Dismiss Chrome extension prompt"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="section-panel max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Puzzle className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground text-base">Install Extension (30 seconds)</h3>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-1 rounded"
                onClick={() => setShowInstructions(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-xs text-foreground/90 list-decimal list-inside">
              <li className="leading-relaxed">
                Click <b>Download ZIP</b> and extract (unzip) the downloaded folder on your computer.
              </li>
              <li className="leading-relaxed">
                In Chrome, open <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">chrome://extensions</code> (paste it in the address bar).
              </li>
              <li className="leading-relaxed">
                Turn on the <b>Developer mode</b> switch in the top-right corner.
              </li>
              <li className="leading-relaxed">
                Click <b>Load unpacked</b> (top-left) and select the extracted folder.
              </li>
            </ol>

            <div className="mt-4 rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground">
              💡 <b>Note:</b> The extension automatically logs and mirrors your CLMS call notes into this Count-It tab, so there is no need to manually tap + on Count-It when working in CLMS!
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-border">
              <a
                href={CHROME_EXTENSION_ZIP}
                download="count-it-extension.zip"
                className="btn btn--sm btn--primary text-xs flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Extension ZIP</span>
              </a>
              <button
                type="button"
                className="btn btn--sm btn--outline text-xs"
                onClick={() => setShowInstructions(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
