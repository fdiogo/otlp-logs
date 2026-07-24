export interface LogHistogramBucket {
  /** Bucket start, unix ms */
  time: number;
  count: number;
}

export interface StackedHistogramSeries {
  key: string;
  label: string;
}

export interface StackedHistogramBucket {
  /** Bucket start, unix ms */
  time: number;
  total: number;
  /** Per-series count for this bucket, keyed by StackedHistogramSeries.key. */
  counts: Record<string, number>;
}

interface LogHistogramBaseProps {
  /** Width of each bucket, in ms. Used for axis tick formatting. */
  bucketDurationMs: number;
  height?: number;
  className?: string;
}

export interface FlatLogHistogramProps extends LogHistogramBaseProps {
  variant?: "flat";
  buckets: LogHistogramBucket[];
}

export interface StackedLogHistogramProps extends LogHistogramBaseProps {
  variant: "stacked";
  buckets: StackedHistogramBucket[];
  /** Stack order, bottom to top. */
  series: StackedHistogramSeries[];
}

export type LogHistogramProps = FlatLogHistogramProps | StackedLogHistogramProps;
