export interface SelectProps {
  label?: string;
  options: string[];
  defaultValue?: string;
  disabled?: boolean;
}
export interface OpenMenuProps {
  /** Renders the open/expanded state of a custom dropdown for previewing menu styling. */
  items: string[];
  selected?: string;
}
