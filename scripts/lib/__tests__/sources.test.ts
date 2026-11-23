import { mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cliDocsDir,
  findSource,
  missingCliDocs,
  SIBLINGS_ROOT,
  sourceAssetsPath,
  sourcePath,
} from '../sources.js';

describe('SOURCES — cli consolidated into the aurora-catalyst monorepo', () => {
  const cli = findSource('cli')!;

  it('cli points at the aurora-catalyst monorepo (aurora-catalyst-cli is frozen)', () => {
    expect(cli.repo).toBe('aurora-catalyst');
  });

  it('cli declares an assetsSubdir pointing at packages/cli', () => {
    expect(cli.assetsSubdir).toBe('packages/cli');
  });
});

describe('sourcePath — always the repo root, regardless of assetsSubdir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cli resolves to the monorepo root', () => {
    vi.stubEnv('CATALYST_REPO_PATH', '');
    expect(sourcePath(findSource('cli')!)).toBe(path.resolve(SIBLINGS_ROOT, 'aurora-catalyst'));
  });

  it('cli resolves to CATALYST_REPO_PATH when the checkout has another folder name', () => {
    vi.stubEnv('CATALYST_REPO_PATH', '../catalyst');
    expect(sourcePath(findSource('cli')!)).toBe(path.resolve('../catalyst'));
  });
});

describe('sourceAssetsPath — repo root + assetsSubdir', () => {
  it('cli resolves under packages/cli', () => {
    const cli = findSource('cli')!;
    expect(sourceAssetsPath(cli)).toBe(path.join(sourcePath(cli), 'packages/cli'));
  });
});

describe('missingCliDocs — checked before the sync deletes anything', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the missing folder when the source repo does not exist', () => {
    vi.stubEnv('CATALYST_REPO_PATH', path.join(os.tmpdir(), 'no-such-catalyst-checkout'));
    const cli = findSource('cli')!;
    expect(missingCliDocs(cli)).toBe(cliDocsDir(cli));
  });

  it('names the missing folder when the repo exists but has no oclif docs/', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'catalyst-'));
    mkdirSync(path.join(repo, 'packages/cli'), { recursive: true });
    vi.stubEnv('CATALYST_REPO_PATH', repo);
    const cli = findSource('cli')!;
    expect(missingCliDocs(cli)).toBe(path.join(repo, 'packages/cli/docs'));
  });

  it('returns null when the oclif docs/ folder exists', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'catalyst-'));
    mkdirSync(path.join(repo, 'packages/cli/docs'), { recursive: true });
    vi.stubEnv('CATALYST_REPO_PATH', repo);
    expect(missingCliDocs(findSource('cli')!)).toBeNull();
  });
});
