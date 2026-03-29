import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XOctagon,
  X,
} from "lucide-react";

const alertToastVariants = cva(
  "relative w-full max-w-sm overflow-hidden rounded-lg shadow-lg flex items-start p-4 space-x-4",
  {
    variants: {
      variant: {
        success: "",
        warning: "",
        info: "",
        error: "",
      },
      styleVariant: {
        default: "bg-background border",
        filled: "",
      },
    },
    compoundVariants: [
      {
        variant: "success",
        styleVariant: "default",
        className: "text-success-foreground border-green-200",
      },
      {
        variant: "warning",
        styleVariant: "default",
        className: "text-warning-foreground border-yellow-200",
      },
      {
        variant: "info",
        styleVariant: "default",
        className: "text-info-foreground border-blue-200",
      },
      {
        variant: "error",
        styleVariant: "default",
        className: "text-destructive-foreground border-red-200",
      },
      {
        variant: "success",
        styleVariant: "filled",
        className: "bg-success text-success-foreground",
      },
      {
        variant: "warning",
        styleVariant: "filled",
        className: "bg-warning text-warning-foreground",
      },
      {
        variant: "info",
        styleVariant: "filled",
        className: "bg-info text-info-foreground",
      },
      {
        variant: "error",
        styleVariant: "filled",
        className: "bg-destructive text-destructive-foreground",
      },
    ],
    defaultVariants: {
      variant: "info",
      styleVariant: "default",
    },
  }
);

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: XOctagon,
};

const iconColorClasses: Record<string, Record<string, string>> = {
  default: {
    success: "text-green-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
    error: "text-red-500",
  },
  filled: {
    success: "text-success-foreground",
    warning: "text-warning-foreground",
    info: "text-info-foreground",
    error: "text-destructive-foreground",
  },
};

export interface AlertToastProps
  extends VariantProps<typeof alertToastVariants> {
  title: string;
  description: string;
  onClose: () => void;
  className?: string;
}

const AlertToast = React.forwardRef<HTMLDivElement, AlertToastProps>(
  (
    {
      className,
      variant = "info",
      styleVariant = "default",
      title,
      description,
      onClose,
    },
    ref
  ) => {
    const Icon = iconMap[variant!];

    return (
      <motion.div
        ref={ref}
        role="alert"
        layout
        initial={{ opacity: 0, y: 50, scale: 0.3 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.5 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
        }}
        className={cn(
          alertToastVariants({ variant, styleVariant }),
          className
        )}
      >
        <div className="flex-shrink-0">
          <Icon
            className={cn(
              "h-6 w-6",
              iconColorClasses[styleVariant!][variant!]
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm opacity-90">{description}</p>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "p-1 rounded-full opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2",
              styleVariant === "default"
                ? "text-foreground/70 hover:bg-muted"
                : "hover:bg-black/20"
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    );
  }
);

AlertToast.displayName = "AlertToast";

export { AlertToast, alertToastVariants };
