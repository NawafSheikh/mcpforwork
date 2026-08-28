/** Bar chart for a Chart of kind "bar". One bar group per label, one colour per series. */

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "../../types";
import { formatNumber, formatTooltipValue } from "../format";
import {
  AXIS_LINE,
  AXIS_TICK,
  CURSOR_FILL,
  GRID_COLOR,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
  colorAt,
} from "./palette";
import { LABEL_KEY, toChartData, toSeriesData } from "./series";

export interface BarChartViewProps {
  readonly points: readonly ChartPoint[];
}

export function BarChartView({ points }: BarChartViewProps) {
  const { rows, keys } = toSeriesData(points);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={toChartData(rows)} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={LABEL_KEY}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={AXIS_LINE}
          minTickGap={4}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={formatNumber} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: CURSOR_FILL }} formatter={(value) => formatTooltipValue(value)} />
        {keys.length > 1 ? <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} /> : null}
        {keys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={colorAt(index)} radius={[4, 4, 0, 0]} maxBarSize={38} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
