/**
 * Local storage that never breaks reading.
 *
 * Progress and settings are conveniences: private browsing, a full quota, or a
 * blocked origin must degrade to a still-readable book, not an error screen.
 */

export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Storage is optional. */
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}

export function safeKeys(): string[] {
  try {
    return Object.keys(window.localStorage);
  } catch {
    return [];
  }
}
