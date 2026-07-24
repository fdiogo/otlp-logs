"use client";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});
const timeOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: "medium",
});

export function Time(props: {
  unixNano: string | number | undefined;
  /** Renders only the time-of-day, omitting the date. @default false */
  timeOnly?: boolean;
}) {
  const { unixNano, timeOnly = false } = props;
  if (unixNano === undefined) return null;

  const millis = Number(BigInt(unixNano) / BigInt(1_000_000));
  const date = new Date(millis);

  return (
    <time dateTime={date.toISOString()}>{(timeOnly ? timeOnlyFormatter : dateTimeFormatter).format(date)}</time>
  );
}
