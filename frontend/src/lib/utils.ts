import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Stable per-browser device id, persisted in localStorage. Used for
 * fitting-room photo save/delete and try-on rate limiting (5/day/device),
 * so a returning visitor is recognized without any login.
 */
export function deviceId(): string {
  const KEY = "twinish_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
