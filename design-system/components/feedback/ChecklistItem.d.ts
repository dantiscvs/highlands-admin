export interface ChecklistItemProps {
  /** warning = unresolved, non-blocking notice; done = resolved. There is no "blocking/error" state by design — the readiness checklist never stops the organizer. */
  status?: "warning" | "done";
  title: string;
  description?: string;
  actionLabel?: string;
}
