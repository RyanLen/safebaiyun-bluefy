import React, { type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-accent text-accent-foreground shadow-soft-glow hover:brightness-105 active:translate-y-px",
  secondary: "border border-line bg-panel text-ink hover:bg-white/10 active:bg-white/15",
  ghost: "text-muted hover:bg-white/8 hover:text-ink",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
};
type Variant = keyof typeof variants;

const sizes = {
  md: "min-h-12 px-5 text-[15px]",
  sm: "min-h-10 px-3.5 text-sm",
  icon: "size-11 p-0"
};
type Size = keyof typeof sizes;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
