/** Scores from 0 to 1 as a line, oldest first, on a fixed scale so noise looks like noise; nothing with fewer than 2. */
export function Sparkline({
  values,
  label,
  width = 120,
  height = 28,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - v * (height - 4)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible text-foreground"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
