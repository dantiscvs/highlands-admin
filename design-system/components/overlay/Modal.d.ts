export interface ModalProps {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  /** Switches the confirm button to the danger variant for destructive confirmations. */
  danger?: boolean;
}
