import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Short, quiet movement. Never delay navigation or animate business values.
export const motionTiming = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

export function PageMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.div className="page motion-page" initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={motionTiming}>{children}</motion.div>;
}

export function SelectionIndicator({ id }: { id: string }) {
  const reduced = useReducedMotion();
  return <motion.span aria-hidden="true" className="selection-indicator" layoutId={id} transition={reduced ? { duration: 0 } : motionTiming} />;
}
