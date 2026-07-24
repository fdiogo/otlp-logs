export interface LogHistogramBucket {
  /** Bucket start, unix ms */
  time: number;
  count: number;
}

export interface LogHistogramProps {
  buckets: LogHistogramBucket[];
  /** Width of each bucket, in ms. Used for axis tick formatting. */
  bucketDurationMs: number;
  height?: number;
  className?: string;
  /** Fired when a bucket is clicked, e.g. to filter the log list to that time range. */
  onBucketClick?: (bucket: LogHistogramBucket) => void;
}
