import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { findSource, SIBLINGS_ROOT, sourceAssetsPath, sourcePath } from '../sources.js';

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
