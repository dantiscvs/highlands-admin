export interface InputProps {
  label?: string;
  /** Native input type — text, number, date all share this component's styling. */
  type?: "text" | "number" | "date" | "email" | "search";
  placeholder?: string;
  help?: string;
  /** Error message; also switches the field into the error visual state. */
  error?: string;
  disabled?: boolean;
  defaultValue?: string;
}
