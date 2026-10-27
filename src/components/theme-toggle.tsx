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
  return <div className="flex gap-1" aria-label="Appearance">
    <Button variant={theme === "light" ? "secondary" : "ghost"} size="icon" aria-label="Light mode" title="Light mode" aria-pressed={theme === "light"} onClick={() => change("light")}><Sun /></Button>
    <Button variant={theme === "dark" ? "secondary" : "ghost"} size="icon" aria-label="Dark mode" title="Dark mode" aria-pressed={theme === "dark"} onClick={() => change("dark")}><Moon /></Button>
  </div>;
}