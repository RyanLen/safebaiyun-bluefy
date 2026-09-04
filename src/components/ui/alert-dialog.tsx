import React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "../../lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;

type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>;

export const AlertDialogContent = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Content>, AlertDialogContentProps>(function AlertDialogContent({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-[1.4rem] border border-line bg-panel p-5 shadow-2xl focus:outline-none sm:left-1/2 sm:right-auto sm:w-[min(100%-2rem,28rem)] sm:-translate-x-1/2",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
});

export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;
