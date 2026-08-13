/**
 * Theme resolution — Functional Core.
 *
 * The `theme` prop on <evidenceone-chat> accepts 'light' | 'dark' | 'auto'.
 * 'auto' delegates to the host's `prefers-color-scheme`; the component layer
 * owns the matchMedia subscription and feeds `prefersDark` in here.
 */
export type ThemePreference = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Resolve the partner-provided theme preference to the concrete theme applied
 * as `data-theme` on `.eo-scope`. Accepts raw attribute strings — anything
 * other than 'dark' / 'auto' (including unknown values) resolves to 'light'.
 */
export function resolveTheme(
  preference: string | undefined | null,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'auto') return prefersDark ? 'dark' : 'light';
  return 'light';
}
