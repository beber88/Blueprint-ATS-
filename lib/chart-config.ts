const CHART_COLORS = [
  '#C9A84C',  // gold - primary
  '#1A1A1A',  // black
  '#8A7D6B',  // warm gray
  '#D4B85A',  // light gold
  '#A88B3D',  // dark gold
  '#B0A48E',  // beige
  '#6B6356',  // dark beige
  '#3A3A3A',  // charcoal
  '#E5E0D5',  // light border
  '#C4BFB2',  // medium gray
];

const CHART_COLORS_DARK = [
  '#D4B85A',  // light gold
  '#F0EDE6',  // off-white
  '#9A8E7A',  // warm gray
  '#C9A84C',  // gold
  '#B0A48E',  // beige
  '#7A7060',  // muted
  '#E5E0D5',  // light
  '#6B6356',  // medium
  '#4A4A4A',  // dark
  '#8A7D6B',  // tertiary
];

export function getChartColors(isDark: boolean) {
  return isDark ? CHART_COLORS_DARK : CHART_COLORS;
}

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border-primary)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  labelStyle: { color: 'var(--text-secondary)', fontSize: '12px' },
  cursor: { fill: 'var(--brand-gold)', opacity: 0.06 },
};

export const AXIS_STYLE = {
  tick: { fill: 'var(--text-secondary)', fontSize: 12 },
  axisLine: { stroke: 'var(--border-primary)' },
  tickLine: false as const,
};

export const GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke: 'var(--border-light, #F0EDE6)',
  vertical: false as const,
};

export const SCORE_COLORS = {
  low: '#A32D2D',     // 0-39
  medium: '#C9A84C',  // 40-69
  high: '#3D8A7D',    // 70-84
  top: '#2D7A3E',     // 85-100
};

export function getScoreColor(score: number) {
  if (score >= 85) return SCORE_COLORS.top;
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}
