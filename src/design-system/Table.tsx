import type { ComponentProps } from "react";
import { cn } from "cnfast";

function TableRoot(props: ComponentProps<"table">) {
  const { className, ...rest } = props;
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...rest} />;
}

function Header(props: ComponentProps<"thead">) {
  const { className, ...rest } = props;
  return <thead className={className} {...rest} />;
}

function Body(props: ComponentProps<"tbody">) {
  const { className, ...rest } = props;
  return <tbody className={className} {...rest} />;
}

function Row(props: ComponentProps<"tr">) {
  const { className, ...rest } = props;
  return <tr className={className} {...rest} />;
}

function Head(props: ComponentProps<"th">) {
  const { className, ...rest } = props;
  return (
    <th
      className={cn("border-b border-panel-border px-3 py-2 font-medium text-panel-muted", className)}
      {...rest}
    />
  );
}

function Cell(props: ComponentProps<"td">) {
  const { className, ...rest } = props;
  return (
    <td
      className={cn("border-b border-panel-border-subtle px-3 py-2 align-top", className)}
      {...rest}
    />
  );
}

export const Table = Object.assign(TableRoot, { Header, Body, Row, Head, Cell });
