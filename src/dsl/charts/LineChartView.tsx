/** Line chart for a Chart of kind "line". Trends over the label axis. */

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "../../types";
import { formatNumber, formatTooltipValue } from "../format";
import {
  AXIS_LINE,
  AXIS_TICK,
  GRID_COLOR,
  LEGEND_STYLE,
  TOOLTIP_STYLE,
  colorAt,
} from "./palette";
import { LABEL_KEY, toChartData, toSeriesData } from "./series";

export interface LineChartViewProps {
  readonly points: readonly ChartPoint[];
}

export function LineChartView({ points }: LineChartViewProps) {
  const { rows, keys } = toSeriesData(points);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={toChartData(rows)} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={LABEL_KEY}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={AXIS_LINE}
          minTickGap={8}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={formatNumber} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTooltipValue(value)} />
        {keys.length > 1 ? <Legend iconSize={8} wrapperStyle={LEGEND_STYLE} /> : null}
        {keys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colorAt(index)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
