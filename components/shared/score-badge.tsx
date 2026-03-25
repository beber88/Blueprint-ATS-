"use client";

import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getColor = () => {
    if (score >= 80) return { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-500" };
    if (score >= 60) return { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-500" };
    if (score >= 40) return { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-500" };
    return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
  };

  const colors = getColor();
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold ring-2",
        colors.bg,
        colors.text,
        colors.ring,
        sizeClasses[size]
      )}
    >
      {score}
    </div>
  );
}
