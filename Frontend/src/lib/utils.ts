import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility helper for merging conditional Tailwind CSS classes cleanly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
