"use client";

import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 85) return { stroke: "#2D7A3E", text: "text-emerald-700", ring: "#2D7A3E" };
    if (score >= 70) return { stroke: "#3D8A7D", text: "text-teal-700", ring: "#3D8A7D" };
    if (score >= 40) return { stroke: "#C9A84C", text: "text-amber-700", ring: "#C9A84C" };
    return { stroke: "#A32D2D", text: "text-red-700", ring: "#A32D2D" };
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
        <circle cx={svgSize / 2} cy={svgSize / 2} r={s.radius} fill="none" stroke="var(--border-primary, #E5E0D5)" strokeWidth={s.strokeWidth} />
        <circle cx={svgSize / 2} cy={svgSize / 2} r={s.radius} fill="none" stroke={colors.stroke} strokeWidth={s.strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={cn("font-bold relative z-10", s.text)} style={{ color: colors.ring }}>{score}</span>
    </div>
  );
}
