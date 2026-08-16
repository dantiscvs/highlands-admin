export interface ButtonProps {
  /** Visual role. primary = main CTA (trail green fill); secondary = outline/neutral; danger = destructive action; ghost = lowest-emphasis, text-only. */
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** md is default (10px/18px padding); sm for dense toolbars and inline row actions. */
  size?: "md" | "sm";
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  children: React.ReactNode;
}
