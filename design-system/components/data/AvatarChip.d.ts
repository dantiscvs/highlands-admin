export interface AvatarChipProps {
  name: string;
  size?: "sm" | "md";
  /** Adds a small terracotta dot marking the trip organizer/leader among participants. */
  organizer?: boolean;
}
export interface AvatarGroupProps { names: string[]; }
