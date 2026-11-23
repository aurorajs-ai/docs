import { existsSync } from 'node:fs';
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
  /**
   * Environment variable that overrides the sibling-folder lookup, for a
   * checkout cloned under another folder name. A relative value resolves
   * against the current directory.
   */
  pathEnv?: string;
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
    pathEnv: 'CATALYST_REPO_PATH',
  },
];

export function sourcePath(source: Source): string {
  const override = source.pathEnv ? process.env[source.pathEnv] : undefined;
  return override ? path.resolve(override) : path.resolve(SIBLINGS_ROOT, source.repo);
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

/** The oclif `docs/` folder that `pnpm sync` mirrors into `reference/cli-commands/`. */
export function cliDocsDir(source: Source): string {
  return path.join(sourceAssetsPath(source), 'docs');
}

/**
 * The CLI docs folder when it does not exist, otherwise `null`. The sync checks
 * this BEFORE it empties the destination: a missing source must fail the run,
 * never leave the reference deleted behind an exit code 0.
 */
export function missingCliDocs(source: Source): string | null {
  const dir = cliDocsDir(source);
  return existsSync(dir) ? null : dir;
}

export function findSource(slug: string): Source | undefined {
  return SOURCES.find((s) => s.slug === slug);
}

export function targetFor(locale: Locale, subdir: string): string {
  return path.join(DOCS_ROOT, 'src/content/docs', locale, subdir);
}
