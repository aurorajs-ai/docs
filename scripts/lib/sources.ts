import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
export const SIBLINGS_ROOT = path.resolve(DOCS_ROOT, '..');

export const CONTENT_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof CONTENT_LOCALES)[number];

export interface Source {
  slug: string;
  repo: string;
  hasCli: boolean;
  label: { en: string; es: string };
  /**
   * Subdirectory within `repo` where THIS source's CLI-specific build
   * artifacts live (oclif `docs/`). Omit when the artifacts sit at the repo
   * root.
   *
   * Applies ONLY to `sourceAssetsPath`; `sourcePath` always resolves from the
   * repo root (the CLI lives in `packages/cli` of the `aurora-catalyst`
   * monorepo).
   */
  assetsSubdir?: string;
}

export const SOURCES: Source[] = [
  {
    slug: 'cli',
    // `aurora-catalyst-cli` was consolidated into this monorepo as
    // `packages/cli` (archived change 2026-08-03-consolidate-cli-into-monorepo).
    // The standalone repo is frozen; treat it as historical only.
    repo: 'aurora-catalyst',
    hasCli: true,
    label: { en: 'Aurora Catalyst CLI', es: 'Aurora Catalyst CLI' },
    assetsSubdir: 'packages/cli',
  },
];

export function sourcePath(source: Source): string {
  return path.resolve(SIBLINGS_ROOT, source.repo);
}

/**
 * Where THIS source's CLI-specific build artifacts (oclif `docs/`) live — the
 * repo root, or `assetsSubdir` under it when declared.
 */
export function sourceAssetsPath(source: Source): string {
  return source.assetsSubdir
    ? path.join(sourcePath(source), source.assetsSubdir)
    : sourcePath(source);
}

export function findSource(slug: string): Source | undefined {
  return SOURCES.find((s) => s.slug === slug);
}

export function targetFor(locale: Locale, subdir: string): string {
  return path.join(DOCS_ROOT, 'src/content/docs', locale, subdir);
}
