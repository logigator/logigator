/** One row of a histogram: what it counts and how much. */
export interface HistogramBucket {
  label: string;
  count: number;
}

export interface HistogramOptions {
  /** Characters the largest bar spans. */
  width?: number;
  /** Character the bars are drawn with. */
  block?: string;
  /** Row shown for a histogram whose buckets are all zero. */
  emptyNote?: string;
}

const DEFAULTS: Required<HistogramOptions> = {
  width: 32,
  block: '█',
  emptyNote: '(empty)'
};

/**
 * Renders `buckets` as a text bar chart. Bars scale to the largest bucket, so
 * they read as a distribution, and a non-zero bucket always gets at least one
 * block so it stays visible next to a dominant one. Returns lines rather than
 * one string, so several histograms can be spliced into one report.
 */
export function formatHistogram(
  title: string,
  buckets: readonly HistogramBucket[],
  options: HistogramOptions = {}
): string[] {
  const { width, block, emptyNote } = { ...DEFAULTS, ...options };
  const lines = [`${title}:`];

  let max = 0;
  let labelWidth = 0;
  for (const bucket of buckets) {
    max = Math.max(max, bucket.count);
    labelWidth = Math.max(labelWidth, bucket.label.length);
  }
  if (max <= 0) {
    lines.push(`  ${emptyNote}`);
    return lines;
  }

  for (const bucket of buckets) {
    const filled =
      bucket.count > 0
        ? Math.max(1, Math.round((bucket.count / max) * width))
        : 0;
    lines.push(
      `  ${bucket.label.padStart(labelWidth)} ${block.repeat(filled).padEnd(width)} ${bucket.count}`
    );
  }
  return lines;
}

/**
 * Renders a count-per-index array, where the index carries the meaning. Holes
 * become zero rows so every bar lines up with its own index.
 */
export function formatIndexHistogram(
  title: string,
  counts: readonly number[],
  options: HistogramOptions = {}
): string[] {
  const buckets = Array.from(counts, (count: number | undefined, index) => ({
    label: String(index),
    count: count ?? 0
  }));
  return formatHistogram(title, buckets, options);
}
