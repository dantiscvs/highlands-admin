export interface BadgeProps {
  /** status = semantic pill (readiness, ledger balance, sharing state); activity = trip-type chip with a colored dot. */
  kind?: "status" | "activity";
  status?: "success" | "warning" | "danger" | "info" | "neutral";
  activity?: "cycling" | "hiking" | "driving" | "kayaking" | "transit";
  children: React.ReactNode;
}
