/** Donut for a Chart of kind "donut". Share of a total, legend on the right. */

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartPoint } from "../../types";
import { formatTooltipValue } from "../format";
import { LEGEND_STYLE, TOOLTIP_STYLE, colorAt } from "./palette";
import { LABEL_KEY, VALUE_KEY, toSliceData } from "./series";

export interface DonutChartViewProps {
  readonly points: readonly ChartPoint[];
}

export function DonutChartView({ points }: DonutChartViewProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={toSliceData(points)}
          dataKey={VALUE_KEY}
          nameKey={LABEL_KEY}
          cx="38%"
          innerRadius="56%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {points.map((point, index) => (
            <Cell key={`${point.label}-${index}`} fill={colorAt(index)} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => formatTooltipValue(value)} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconSize={8}
          iconType="circle"
          wrapperStyle={LEGEND_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
