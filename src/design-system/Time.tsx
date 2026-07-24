"use client";

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function Time({ unixNano }: { unixNano: string | number | undefined }) {
  if (unixNano === undefined) return null;

  const millis = Number(BigInt(unixNano) / BigInt(1_000_000));
  const date = new Date(millis);

  return <time dateTime={date.toISOString()}>{formatter.format(date)}</time>;
}
