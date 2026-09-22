// Presentation mode: the demo business without its labels, for a recording. Nothing about the data changes;
// the badges, notices, and the assistant's "this is a demo" line are hidden, and a simulated write answers like
// a real one. Per Mac, in localStorage; toggled from the command palette.
import { useEffect, useState } from "react";

const KEY = "whopdesktop.presentation";
const EVENT = "whopdesktop:presentation";

export function presentation(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPresentation(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePresentation(): boolean {
  const [on, setOn] = useState(presentation);
  useEffect(() => {
    const refresh = () => setOn(presentation());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return on;
}
