import type { ComponentProps } from "react";
import { cn } from "cnfast";

export function Skeleton(props: ComponentProps<"div">) {
  const { className, ...rest } = props;
  return <div className={cn("animate-pulse rounded-md bg-panel-border-subtle", className)} {...rest} />;
}
