"use client";

import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 71) return { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200", stroke: "#10B981" };
    if (score >= 41) return { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200", stroke: "#F59E0B" };
    return { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200", stroke: "#EF4444" };
  };

  const colors = getColor();
  const sizeMap = {
    sm: { container: "h-9 w-9", text: "text-xs", strokeWidth: 3, radius: 14 },
    md: { container: "h-11 w-11", text: "text-sm", strokeWidth: 3, radius: 17 },
    lg: { container: "h-16 w-16", text: "text-lg", strokeWidth: 4, radius: 26 },
  };
  const s = sizeMap[size];
  const circumference = 2 * Math.PI * s.radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (s.radius + s.strokeWidth) * 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center", s.container)}>
      <svg width={svgSize} height={svgSize} className="absolute -rotate-90">
        <circle cx={svgSize/2} cy={svgSize/2} r={s.radius} fill="none" stroke="#e5e7eb" strokeWidth={s.strokeWidth} />
        <circle cx={svgSize/2} cy={svgSize/2} r={s.radius} fill="none" stroke={colors.stroke} strokeWidth={s.strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={cn("font-bold relative z-10", colors.text, s.text)}>{score}</span>
    </div>
  );
}
