import { type HTMLMotionProps, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "neon" | "outline" | "paper" | "ink" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-sans cond font-extrabold uppercase tracking-[0.05em] whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200";

const VARIANTS: Record<ButtonVariant, string> = {
  // The lit tube. Disabled = the same tube switched off.
  neon: "bg-neon text-neon-ink shadow-[var(--shadow-neon)] hover:bg-neon-hi disabled:bg-transparent disabled:text-text-3 disabled:shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
  outline:
    "text-text shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] hover:bg-raised hover:shadow-[inset_0_0_0_1.5px_var(--color-text-3)] disabled:text-text-3 disabled:hover:bg-transparent",
  paper: "bg-paper text-paper-ink hover:bg-white disabled:opacity-50",
  // For use on paper surfaces.
  ink: "bg-paper-ink text-paper hover:bg-black disabled:opacity-40",
  quiet: "text-text-2 hover:text-text disabled:opacity-40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.8125rem]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-14 px-7 text-[1.0625rem]",
};

/** Class list for anchors / router links that should look like a Button. */
export function buttonClass(
  variant: ButtonVariant = "neon",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
};

export function Button({
  variant = "neon",
  size = "md",
  className,
  children,
  disabled,
  onAnimationEnd,
  ...rest
}: Props) {
  // A neon button that becomes enabled "switches on" (one flicker, CSS-only;
  // neutralized by prefers-reduced-motion).
  const [flicker, setFlicker] = useState(false);
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (variant === "neon" && wasDisabled.current && !disabled) setFlicker(true);
    wasDisabled.current = disabled;
  }, [disabled, variant]);

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={cn(buttonClass(variant, size), flicker && "animate-button-on", className)}
      onAnimationEnd={(e) => {
        setFlicker(false);
        onAnimationEnd?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
