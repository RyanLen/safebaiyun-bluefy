import React, { type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-40 w-full resize-y rounded-control border border-line bg-black/20 px-4 py-3 text-[16px] leading-6 text-ink placeholder:text-muted/65 focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/15",
        className
      )}
      {...props}
    />
  );
});
