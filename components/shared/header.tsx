"use client";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-8 pt-8 pb-2">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
