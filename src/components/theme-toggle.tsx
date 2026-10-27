import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("call-tally-theme");
    const next = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset['theme'] = next;
  }, []);
  const change = (next: "light" | "dark") => {
    setTheme(next);
    document.documentElement.dataset['theme'] = next;
    localStorage.setItem("call-tally-theme", next);
  };
  return (
    <div className="segmented-toggle" role="group" aria-label="Appearance">
      <button
        type="button"
        className={`segmented-toggle__btn ${theme === "light" ? "segmented-toggle__btn--active" : ""}`}
        aria-label="Light mode"
        title="Light mode"
        aria-pressed={theme === "light"}
        onClick={() => change("light")}
      >
        <Sun className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`segmented-toggle__btn ${theme === "dark" ? "segmented-toggle__btn--active" : ""}`}
        aria-label="Dark mode"
        title="Dark mode"
        aria-pressed={theme === "dark"}
        onClick={() => change("dark")}
      >
        <Moon className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}