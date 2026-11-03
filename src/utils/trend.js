// A trend through noisy counts over time (e.g. vehicles per camera frame): a rolling mean over a
// centred time window, with a 95% interval for that mean from the window's own spread. The
// spread is the observed one, not one assumed from the counts (traffic bunches, so counts vary
// more than random arrivals would, and the detector adds its own misses and doubles).

// Student's t, two-sided 95%, by degrees of freedom; 1.96 beyond the table
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
export const t95 = df => T95[df - 1] ?? 1.96;

// points: [{ time (ms), value }], in time order. Returns, for each point, { time, value, mean,
// low, high, n }, where mean/low/high are null if its window holds fewer than minPoints.
// A gap between points longer than the window starts a new segment (`segment`), so a trend
// line isn't drawn across time with no observations.
export default function trend(points, { window = 10 * 60_000, minPoints = 4 } = {}) {
  let segment = 0;
  return points.map((point, i) => {
    if (i > 0 && point.time - points[i - 1].time > window) segment += 1;
    const inWindow = points.filter(p => Math.abs(p.time - point.time) <= window / 2).map(p => p.value);
    const n = inWindow.length;
    if (n < minPoints) return { ...point, segment, n, mean: null, low: null, high: null };
    const mean = inWindow.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(inWindow.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    const half = (t95(n - 1) * sd) / Math.sqrt(n);
    return { ...point, segment, n, mean, low: Math.max(0, mean - half), high: mean + half };
  });
}
