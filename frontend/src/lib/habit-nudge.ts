const LAST_LOGGED_KEY = "twinish-last-logged-date";
const NUDGE_DISMISSED_KEY = "twinish-nudge-dismissed";

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export function shouldShowNudge(): boolean {
  const today = todayKey();
  const hour = new Date().getHours();
  const lastLogged = localStorage.getItem(LAST_LOGGED_KEY);
  const dismissedToday = localStorage.getItem(NUDGE_DISMISSED_KEY) === today;

  // Only show after 6am, and only if today hasn't been logged or dismissed
  return hour >= 6 && lastLogged !== today && !dismissedToday;
}

export function markLoggedToday(): void {
  localStorage.setItem(LAST_LOGGED_KEY, todayKey());
}

export function dismissNudgeToday(): void {
  localStorage.setItem(NUDGE_DISMISSED_KEY, todayKey());
}
