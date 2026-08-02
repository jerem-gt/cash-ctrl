import { useId } from 'react';
import {
  Area,
  AreaChart,
  DefaultTooltipContent,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';

import { useIsDark } from '@/hooks/useTheme';
import { axisTickProps, chartTheme, tooltipStyleProps } from '@/lib/chartTheme';
import { fmtCurrency, fmtDateShort } from '@/lib/format';

interface ForecastChartPoint {
  date: string;
  balance: number;
}

interface Props {
  points: ForecastChartPoint[];
  goesNegativeOn: string | null;
  label: string;
  /** Date (incluse côté passé) séparant trait plein (historique) et pointillés (projeté). */
  splitDate?: string;
  /** Libellé i18n affiché sur le repère vertical à splitDate (ex. "Aujourd'hui"). */
  splitLabel?: string;
}

interface ChartDatum {
  date: string;
  balance: number;
  pastBalance: number | undefined;
  futureBalance: number | undefined;
}

function buildChartData(points: ForecastChartPoint[], splitDate: string | undefined): ChartDatum[] {
  return points.map((p) => ({
    date: p.date,
    balance: p.balance,
    pastBalance: splitDate === undefined || p.date <= splitDate ? p.balance : undefined,
    futureBalance: splitDate !== undefined && p.date >= splitDate ? p.balance : undefined,
  }));
}

/** Arrondit un pas brut au multiple "lisible" le plus proche (1/2/5 × 10^n), à la d3. */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(roughStep));
  const base = 10 ** exponent;
  const fraction = roughStep / base;
  let niceFraction: number;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * base;
}

/**
 * Domaine Y ajusté aux données : marge = max(10 % de l'amplitude, plancher pour les
 * séries plates). 0 n'est inclus que si min >= 0 et s'en approche naturellement, ou
 * si la série traverse déjà le négatif.
 */
export function computeYDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const amplitude = max - min;
  const scaleRef = Math.max(Math.abs(min), Math.abs(max));
  const flatMargin = Math.max(scaleRef * 0.05, 10);
  const margin = Math.max(amplitude * 0.1, flatMargin);
  let rawLower: number;
  if (min >= 0) {
    rawLower = Math.max(0, min - margin);
  } else {
    rawLower = min - margin;
  }
  const rawUpper = max + margin;
  const step = niceStep(margin);
  const lower = Math.floor(rawLower / step) * step;
  const upper = Math.ceil(rawUpper / step) * step;
  return [lower, upper];
}

/** Construit les ticks X en garantissant toujours le premier et le dernier point. */
export function buildXTicks(dates: readonly string[], maxTicks = 6): string[] {
  if (dates.length <= 1) return [...dates];
  const lastIndex = dates.length - 1;
  const step = Math.max(1, Math.round(lastIndex / (maxTicks - 1)));
  const indices: number[] = [];
  for (let i = 0; i <= lastIndex; i += step) indices.push(i);
  if (indices.at(-1) !== lastIndex) indices.push(lastIndex);
  return indices.map((i) => dates[i]);
}

const BRAND_COLOR = '#139AAE';

// Formatter pour les dates (axe X et tooltip)
export const formatDateShort = (v: unknown): string => fmtDateShort(v as string);

/** Retire les entrées (name, value) identiques : le point de jonction passé/futur les duplique. */
export function dedupeTooltipPayload<T extends { name?: unknown; value?: unknown }>(
  payload: readonly T[] | undefined,
): T[] {
  const seen = new Set<string>();
  return (payload ?? []).filter((entry) => {
    const key = `${String(entry.name)}:${String(entry.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupedTooltipContent(props: TooltipContentProps) {
  return <DefaultTooltipContent {...props} payload={dedupeTooltipPayload(props.payload)} />;
}

export default function ForecastAreaChart({
  points,
  goesNegativeOn,
  label,
  splitDate,
  splitLabel,
}: Readonly<Props>) {
  const isDark = useIsDark();
  const theme = chartTheme(isDark);
  const axisTick = axisTickProps(theme);
  const dangerColor = isDark ? '#f87171' : '#b91c1c';
  const hasNegative = points.some((p) => p.balance < 0);
  const color = hasNegative ? dangerColor : BRAND_COLOR;
  const elementId = useId();
  const gradId = `fcg${elementId.replaceAll(':', '')}`;
  const negativePoint = goesNegativeOn ? points.find((p) => p.date === goesNegativeOn) : undefined;
  const chartData = buildChartData(points, splitDate);
  const xTicks = buildXTicks(chartData.map((d) => d.date));
  const yDomain = computeYDomain(chartData.map((d) => d.balance));
  const showZeroLine = yDomain[0] <= 0 && yDomain[1] >= 0;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          ticks={xTicks}
          interval="preserveStartEnd"
          tickFormatter={formatDateShort}
          {...axisTick}
        />
        <YAxis
          {...axisTick}
          domain={yDomain}
          tickFormatter={(v) => fmtCurrency(Number(v))}
          width={80}
        />
        <Tooltip
          labelFormatter={formatDateShort}
          formatter={(v) => [fmtCurrency(Number(v)), label]}
          content={dedupedTooltipContent}
          {...tooltipStyleProps(theme)}
          cursor={{ stroke: theme.refLine, strokeWidth: 1 }}
        />
        {showZeroLine && <ReferenceLine y={0} stroke={theme.refLine} strokeWidth={1} />}
        {splitDate !== undefined && (
          <ReferenceLine
            x={splitDate}
            stroke={theme.refLine}
            strokeWidth={1}
            strokeDasharray="2 4"
            label={
              splitLabel === undefined
                ? undefined
                : {
                    value: splitLabel,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: theme.axisTick,
                  }
            }
          />
        )}
        {splitDate === undefined ? (
          <Area
            type="monotone"
            dataKey="balance"
            name={label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        ) : (
          <>
            <Area
              type="monotone"
              dataKey="pastBalance"
              name={label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="futureBalance"
              name={label}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="5 5"
              fillOpacity={0}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </>
        )}
        {negativePoint && (
          <ReferenceDot
            x={negativePoint.date}
            y={negativePoint.balance}
            r={5}
            fill={dangerColor}
            stroke="none"
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
