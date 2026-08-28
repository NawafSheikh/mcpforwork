/** Bar chart for a Chart of kind "bar". One bar group per label, one colour per series. */

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "../../types";
import { formatNumber, formatTooltipValue } from "../format";
import { pointsDomain } from "./domain";
import { colorAt } from "./palette";
import { LABEL_KEY, toChartData, toSeriesData } from "./series";
import { useChartTheme } from "./theme";

export interface BarChartViewProps {
  readonly points: readonly ChartPoint[];
}

export function BarChartView({ points }: BarChartViewProps) {
  const theme = useChartTheme();
  const { rows, keys } = useMemo(() => toSeriesData(points), [points]);
  const axis = useMemo(() => pointsDomain(points), [points]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={toChartData(rows)} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey={LABEL_KEY}
          tick={theme.tick}
          tickLine={false}
          axisLine={theme.axisLine}
          minTickGap={4}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={theme.tick}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={[axis.min, axis.max]}
          ticks={[...axis.ticks]}
          allowDecimals={axis.allowDecimals}
          tickFormatter={formatNumber}
        />
        <Tooltip {...theme.tooltip} cursor={{ fill: theme.cursor }} formatter={(value) => formatTooltipValue(value)} />
        {keys.length > 1 ? <Legend iconSize={8} wrapperStyle={theme.legend} /> : null}
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={colorAt(index, theme.colors)} radius={[4, 4, 0, 0]} maxBarSize={38} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
