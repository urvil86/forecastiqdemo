"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Computing sensitivity at current operating point…",
  "Sampling elasticity curves across six levers…",
  "Running portfolio optimization…",
  "Generating rationale…",
];

export function GrowthLoading() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setStep(i), i * 600));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="card text-center py-10">
      <div className="font-heading text-h4 text-secondary mb-2">{STEPS[step]}</div>
      <div className="w-3/4 mx-auto bg-background rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}
