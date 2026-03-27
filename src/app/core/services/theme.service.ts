import { Injectable, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mode = signal<ThemeMode>('light');

  readonly isDark = computed(() => this.mode() === 'dark');

  init(): void {
    const stored = this.safeReadLocalStorageTheme();
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;

    const initialMode: ThemeMode =
      stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light';

    this.setMode(initialMode);
  }

  toggle(): void {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private setMode(next: ThemeMode): void {
    this.mode.set(next);
    const root = document?.documentElement;
    const body = document?.body;
    root?.classList.toggle('dark', next === 'dark');
    body?.classList.toggle('dark', next === 'dark');
    this.safeWriteLocalStorageTheme(next);
  }

  private safeReadLocalStorageTheme(): ThemeMode | null {
    try {
      const v = localStorage.getItem('zimra-theme');
      if (v === 'dark' || v === 'light') return v;
    } catch {
      // ignore
    }
    return null;
  }

  private safeWriteLocalStorageTheme(mode: ThemeMode): void {
    try {
      localStorage.setItem('zimra-theme', mode);
    } catch {
      // ignore
    }
  }
}

