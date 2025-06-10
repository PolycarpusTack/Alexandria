// Simple clsx fallback
type ClassValue = string | number | boolean | undefined | null;

function clsx(...classes: ClassValue[]): string {
  return classes
    .filter(Boolean)
    .join(' ')
    .trim();
}

// Simple twMerge fallback
function twMerge(classString: string): string {
  return classString;
}
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));