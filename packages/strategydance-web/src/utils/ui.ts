import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Conditional classes, then a Tailwind-aware merge so a `className` prop beats the variant it
// overrides rather than landing next to it and losing on source order
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
