import type { CSSProperties } from 'react';

/**
 * Couleurs neutres pour la data viz (recharts). Recharts pose la plupart des
 * couleurs en attributs SVG où `var(--c-*)` ne se résout pas de façon fiable :
 * on calcule donc des valeurs concrètes selon le thème actif (`useIsDark()`).
 * Les couleurs « data » (barres revenus/dépenses, parts du camembert) restent
 * définies à part — ici on ne gère que le chrome neutre.
 */
export interface ChartTheme {
  axisTick: string;
  cursor: string;
  refLine: string;
  tooltipContentStyle: CSSProperties;
  tooltipItemStyle: CSSProperties;
  tooltipLabelStyle: CSSProperties;
}

/** Props communs XAxis / YAxis — évite la répétition dans chaque chart. */
export function axisTickProps(theme: ChartTheme) {
  return {
    tick: { fontSize: 11, fill: theme.axisTick },
    axisLine: false,
    tickLine: false,
  };
}

/** Props de style communs pour Tooltip — évite la répétition dans chaque chart. */
export function tooltipStyleProps(theme: ChartTheme) {
  return {
    contentStyle: theme.tooltipContentStyle,
    itemStyle: theme.tooltipItemStyle,
    labelStyle: theme.tooltipLabelStyle,
  };
}

export function chartTheme(isDark: boolean): ChartTheme {
  return {
    axisTick: isDark ? '#94a3b8' : '#78716c',
    cursor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    refLine: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
    tooltipContentStyle: {
      backgroundColor: isDark ? '#122832' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
      borderRadius: 8,
      fontSize: 12,
      color: isDark ? '#f1f5f9' : '#1c1917',
    },
    tooltipItemStyle: { color: isDark ? '#cbd5e1' : '#44403c' },
    tooltipLabelStyle: { color: isDark ? '#f1f5f9' : '#1c1917' },
  };
}
