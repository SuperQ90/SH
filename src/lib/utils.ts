import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** ES2020-safe alternative to `String.prototype.replaceAll` for status/plan labels. */
export function formatUnderscores(value: string): string {
  return value.replace(/_/g, " ");
}
