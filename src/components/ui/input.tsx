import React, { type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-12 w-full rounded-control border border-line bg-black/20 px-4 text-[16px] text-ink placeholder:text-muted/65 focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/15",
        className
      )}
      {...props}
    />
  );
});
