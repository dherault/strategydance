/*
  The parts of recharts the design agent's global carries as `Recharts`, which a design builds a
  chart from inside a `ChartContainer`: the cartesian charts and the pie, their series, axes, grid
  and reference marks, the shapes a series' `shape` draws with, and the hooks that place a mark of
  a design's own, as the Budget's year places its two clips. The tooltip and the legend are the
  design system's `ChartTooltip` and `ChartLegend`.

  Not the whole namespace: the upload takes no file over 12 MiB, and recharts whole took the bundle
  to 11.96 MiB, these to 11.70. Radar, radial bars, scatter, funnel, treemap, sankey and the brush
  wait for a design that needs them. `buildPackage.ts` exports these, and `checkNames.ts` checks
  each is recharts' and every name a note takes from `Recharts` is one of them
*/
export const RECHARTS_PARTS = [
  'Area',
  'AreaChart',
  'Bar',
  'BarChart',
  'CartesianGrid',
  'Cell',
  'ComposedChart',
  'Curve',
  'Dot',
  'Label',
  'LabelList',
  'Line',
  'LineChart',
  'Pie',
  'PieChart',
  'Rectangle',
  'ReferenceArea',
  'ReferenceDot',
  'ReferenceLine',
  'Sector',
  'Text',
  'XAxis',
  'YAxis',
  'useChartHeight',
  'useChartWidth',
  'usePlotArea',
  'useXAxisScale',
  'useYAxisScale',
]
