const path = require('path');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('../utils/git', () => ({
  cloneGitRepository: jest.fn(),
  getCollectionGitRepoUrl: jest.fn(),
  getCollectionGitRootPath: jest.fn(),
  getCollectionGitData: jest.fn(),
  getChangedFilesInCollectionGit: jest.fn(),
  getAheadBehindCount: jest.fn(),
  getCurrentGitBranch: jest.fn(),
  initGit: jest.fn(),
  stageChanges: jest.fn(),
  unstageChanges: jest.fn(),
  discardChanges: jest.fn(),
  commitChanges: jest.fn(),
  pushGitChanges: jest.fn(),
  pullGitChanges: jest.fn(),
  fetchChanges: jest.fn(),
  fetchRemotes: jest.fn(),
  checkoutGitBranch: jest.fn(),
  getCollectionGitLogs: jest.fn(),
  getCommitFiles: jest.fn(),
  getCommitFileDiff: jest.fn(),
  getStagedFileDiff: jest.fn(),
  getUnstagedFileDiff: jest.fn(),
  supportsVisualDiff: jest.fn(),
  getFileContentForVisualDiff: jest.fn(),
  getWorkingFileContentForVisualDiff: jest.fn()
}));
jest.mock('../utils/filesystem', () => ({
  createDirectory: jest.fn(),
  removeDirectory: jest.fn()
}));
// git handlers only accept collections the user has open — same registry ipc/collection.js trusts
jest.mock('../app/collection-watcher', () => {
  const nodePath = require('path');
  return {
    getAllWatcherPaths: jest.fn(() => [nodePath.join(nodePath.resolve('/tmp/repo'), 'collection')])
  };
});

const gitUtils = require('../utils/git');
const {
  getCollectionGitRemoteUrl,
  resolveInsideRepo,
  getGitStatus,
  stageGitFiles,
  discardGitFiles,
  commitGitChanges,
  pushGitCommits,
  pullGitCommits,
  fetchGitChanges,
  checkoutBranch,
  getGitCommitFiles,
  getGitDiff
} = require('./git');

// Resolved so the fixtures are valid absolute paths on both win32 and posix.
const GIT_ROOT = path.resolve('/tmp/repo');
const COLLECTION_PATH = path.join(GIT_ROOT, 'collection');
const MAIN_WINDOW = { webContents: { send: jest.fn() } };

// Shape returned by getChangedFilesInCollectionGit:
//   { staged: [{ path, type, fileIndex, working_dir }], unstaged: [...],
//     conflicted: [...], totalFiles: number, tooManyFiles: boolean }
const CHANGED_FILES = {
  staged: [{ path: 'collection/a.bru', type: 'staged', fileIndex: 'M', working_dir: ' ' }],
  unstaged: [{ path: 'collection/b.bru', type: 'unstaged', fileIndex: ' ', working_dir: 'M' }],
  conflicted: [],
  totalFiles: 2,
  tooManyFiles: false
};

const mockRepo = () => {
  gitUtils.getCollectionGitRootPath.mockReturnValue(GIT_ROOT);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCollectionGitRemoteUrl', () => {
  it('returns the origin url for the collection path', async () => {
    gitUtils.getCollectionGitRepoUrl.mockResolvedValue('https://github.com/org/repo.git');

    expect(await getCollectionGitRemoteUrl('/tmp/repo/collection')).toBe('https://github.com/org/repo.git');
    expect(gitUtils.getCollectionGitRepoUrl).toHaveBeenCalledWith('/tmp/repo/collection');
  });

  it('maps an empty remote url to null', async () => {
    gitUtils.getCollectionGitRepoUrl.mockResolvedValue('');

    expect(await getCollectionGitRemoteUrl('/tmp/repo')).toBeNull();
  });

  it('returns null when the collection is not a git repo (lookup throws)', async () => {
    gitUtils.getCollectionGitRepoUrl.mockRejectedValue(new Error('not a git repository'));

    expect(await getCollectionGitRemoteUrl('/tmp/not-a-repo')).toBeNull();
  });
});

describe('resolveInsideRepo', () => {
  it('resolves a repo relative path to an absolute path plus a posix relative path', () => {
    expect(resolveInsideRepo(GIT_ROOT, path.join('collection', 'a.bru'))).toEqual({
      absolutePath: path.join(GIT_ROOT, 'collection', 'a.bru'),
      relativePath: 'collection/a.bru'
    });
  });

  it('accepts mixed separators', () => {
    expect(resolveInsideRepo(GIT_ROOT, 'collection\\nested/a.bru').relativePath)
      .toBe(path.sep === '\\' ? 'collection/nested/a.bru' : 'collection\\nested/a.bru');
  });

  it('rejects traversal out of the repository', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, path.join('collection', '..', '..', 'secrets.env')))
      .toThrow('Path is outside the repository');
  });

  it('rejects an absolute path outside the repository', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, path.resolve('/etc/passwd')))
      .toThrow('Path is outside the repository');
  });

  it('rejects a sibling directory that shares the repo root prefix', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, path.join('..', 'repo-evil', 'a.bru')))
      .toThrow('Path is outside the repository');
  });

  it('rejects an empty file path', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, '   ')).toThrow('A file path is required');
  });
});

describe('getGitStatus', () => {
  it('returns { isRepo: false } when the collection is not inside a repo', async () => {
    gitUtils.getCollectionGitRootPath.mockReturnValue(null);

    expect(await getGitStatus(MAIN_WINDOW, COLLECTION_PATH)).toEqual({ isRepo: false });
    expect(gitUtils.getCollectionGitData).not.toHaveBeenCalled();
  });

  it('composes git data, changed files and ahead/behind counts', async () => {
    mockRepo();
    gitUtils.getCollectionGitData.mockResolvedValue({
      gitRootPath: GIT_ROOT,
      gitRepoUrl: 'https://github.com/org/repo.git',
      branches: ['main', 'feature'],
      currentGitBranch: 'feature',
      defaultGitBranch: 'main',
      logs: []
    });
    gitUtils.getChangedFilesInCollectionGit.mockResolvedValue(CHANGED_FILES);
    gitUtils.getAheadBehindCount.mockResolvedValue({ ahead: 2, behind: 1, aheadCommits: [], behindCommits: [] });

    expect(await getGitStatus(MAIN_WINDOW, COLLECTION_PATH)).toEqual({
      isRepo: true,
      gitRootPath: GIT_ROOT,
      currentBranch: 'feature',
      defaultBranch: 'main',
      branches: ['main', 'feature'],
      remoteUrl: 'https://github.com/org/repo.git',
      ahead: 2,
      behind: 1,
      changes: {
        staged: CHANGED_FILES.staged,
        unstaged: CHANGED_FILES.unstaged,
        conflicted: [],
        totalFiles: 2,
        tooManyFiles: false
      }
    });
    expect(gitUtils.getChangedFilesInCollectionGit).toHaveBeenCalledWith(GIT_ROOT, COLLECTION_PATH);
  });

  it('rejects a relative collection path', async () => {
    await expect(getGitStatus(MAIN_WINDOW, 'collection')).rejects.toThrow(
      'A valid absolute collection path is required'
    );
  });
});

describe('file path validation on mutations', () => {
  it('rejects a traversal path before touching git', async () => {
    mockRepo();

    await expect(stageGitFiles(MAIN_WINDOW, COLLECTION_PATH, { files: ['../../evil.bru'] })).rejects.toThrow(
      'Path is outside the repository'
    );
    expect(gitUtils.stageChanges).not.toHaveBeenCalled();
  });

  it('passes absolute in-repo paths to the git util', async () => {
    mockRepo();

    await discardGitFiles(MAIN_WINDOW, COLLECTION_PATH, { files: ['collection/a.bru'] });

    expect(gitUtils.discardChanges).toHaveBeenCalledWith(GIT_ROOT, [path.join(GIT_ROOT, 'collection', 'a.bru')]);
  });

  it('rejects an empty files array', async () => {
    mockRepo();

    await expect(stageGitFiles(MAIN_WINDOW, COLLECTION_PATH, { files: [] })).rejects.toThrow(
      'files must be a non-empty array of file paths'
    );
  });
});

describe('commitGitChanges', () => {
  it('rejects an empty/whitespace commit message', async () => {
    mockRepo();

    await expect(commitGitChanges(MAIN_WINDOW, COLLECTION_PATH, { message: '   ' })).rejects.toThrow(
      'Commit message is required'
    );
    expect(gitUtils.commitChanges).not.toHaveBeenCalled();
  });

  it('commits a trimmed message and resolves undefined', async () => {
    mockRepo();

    await expect(commitGitChanges(MAIN_WINDOW, COLLECTION_PATH, { message: '  feat: add ping  ' })).resolves.toBeUndefined();
    expect(gitUtils.commitChanges).toHaveBeenCalledWith(GIT_ROOT, 'feat: add ping');
  });
});

describe('pullGitCommits', () => {
  it('rejects a strategy outside the whitelist', async () => {
    mockRepo();

    await expect(
      pullGitCommits(MAIN_WINDOW, COLLECTION_PATH, { strategy: '--rebase', remoteBranch: 'main' })
    ).rejects.toThrow('Invalid pull strategy');
    expect(gitUtils.pullGitChanges).not.toHaveBeenCalled();
  });

  it('forwards a whitelisted strategy with the derived git root', async () => {
    mockRepo();

    await pullGitCommits(MAIN_WINDOW, COLLECTION_PATH, {
      strategy: '--no-rebase',
      remoteBranch: 'main',
      processUid: 'uid-1'
    });

    expect(gitUtils.pullGitChanges).toHaveBeenCalledWith(MAIN_WINDOW, {
      gitRootPath: GIT_ROOT,
      processUid: 'uid-1',
      remote: 'origin',
      remoteBranch: 'main',
      strategy: '--no-rebase'
    });
  });
});

describe('getGitCommitFiles', () => {
  it('rejects a malformed commit hash', async () => {
    mockRepo();

    await expect(getGitCommitFiles(MAIN_WINDOW, COLLECTION_PATH, { commitHash: 'nope' })).rejects.toThrow(
      'Invalid commit hash'
    );
  });

  it('returns the util result for a valid hash', async () => {
    mockRepo();
    gitUtils.getCommitFiles.mockResolvedValue([{ path: 'a.bru', status: 'modified' }]);

    expect(await getGitCommitFiles(MAIN_WINDOW, COLLECTION_PATH, { commitHash: 'a1b2c3d' })).toEqual([
      { path: 'a.bru', status: 'modified' }
    ]);
    expect(gitUtils.getCommitFiles).toHaveBeenCalledWith(GIT_ROOT, 'a1b2c3d');
  });
});

describe('getGitDiff', () => {
  it('rejects an unknown diff kind', async () => {
    mockRepo();

    await expect(getGitDiff(MAIN_WINDOW, COLLECTION_PATH, { kind: 'stash', filePath: 'a.bru' })).rejects.toThrow(
      'Invalid diff kind'
    );
  });

  it('returns raw only when the file does not support a visual diff', async () => {
    mockRepo();
    gitUtils.getUnstagedFileDiff.mockResolvedValue('diff --git readme.md');
    gitUtils.supportsVisualDiff.mockReturnValue(false);

    const result = await getGitDiff(MAIN_WINDOW, COLLECTION_PATH, { kind: 'unstaged', filePath: 'readme.md' });

    expect(result).toEqual({ raw: 'diff --git readme.md', visual: null });
    expect(gitUtils.getUnstagedFileDiff).toHaveBeenCalledWith(GIT_ROOT, path.join(GIT_ROOT, 'readme.md'));
    expect(gitUtils.getWorkingFileContentForVisualDiff).not.toHaveBeenCalled();
  });

  it('adds the visual payload for a staged .bru file', async () => {
    mockRepo();
    gitUtils.getStagedFileDiff.mockResolvedValue('diff --git a.bru');
    gitUtils.supportsVisualDiff.mockReturnValue(true);
    gitUtils.getWorkingFileContentForVisualDiff.mockResolvedValue({
      oldContent: 'old',
      newContent: 'new',
      oldParsed: { name: 'old' },
      newParsed: { name: 'new' }
    });

    const result = await getGitDiff(MAIN_WINDOW, COLLECTION_PATH, {
      kind: 'staged',
      filePath: 'collection/a.bru'
    });

    expect(result).toEqual({
      raw: 'diff --git a.bru',
      visual: {
        before: { content: 'old', parsed: { name: 'old' } },
        after: { content: 'new', parsed: { name: 'new' } }
      }
    });
    // visual diff helpers receive the posix repo-relative path, git pathspecs receive the absolute one
    expect(gitUtils.getWorkingFileContentForVisualDiff).toHaveBeenCalledWith(GIT_ROOT, 'collection/a.bru', 'staged');
    expect(gitUtils.getStagedFileDiff).toHaveBeenCalledWith(GIT_ROOT, path.join(GIT_ROOT, 'collection', 'a.bru'));
  });

  it('uses the commit content helper for kind=commit', async () => {
    mockRepo();
    gitUtils.getCommitFileDiff.mockResolvedValue('diff --git a.bru@commit');
    gitUtils.supportsVisualDiff.mockReturnValue(true);
    gitUtils.getFileContentForVisualDiff.mockResolvedValue({
      oldContent: 'old',
      newContent: 'new',
      oldParsed: null,
      newParsed: null
    });

    const result = await getGitDiff(MAIN_WINDOW, COLLECTION_PATH, {
      kind: 'commit',
      filePath: 'collection/a.bru',
      commitHash: 'abcdef1234567'
    });

    expect(result.raw).toBe('diff --git a.bru@commit');
    expect(result.visual).toEqual({
      before: { content: 'old', parsed: null },
      after: { content: 'new', parsed: null }
    });
    expect(gitUtils.getFileContentForVisualDiff).toHaveBeenCalledWith(GIT_ROOT, 'abcdef1234567', 'collection/a.bru');
  });

  it('rejects a diff for a path outside the repository', async () => {
    mockRepo();

    await expect(
      getGitDiff(MAIN_WINDOW, COLLECTION_PATH, { kind: 'staged', filePath: '../../etc/passwd' })
    ).rejects.toThrow('Path is outside the repository');
    expect(gitUtils.getStagedFileDiff).not.toHaveBeenCalled();
  });
});

describe('collection path validation', () => {
  it('rejects a collection that is not open, even when the path is absolute', async () => {
    mockRepo();

    await expect(getGitStatus(MAIN_WINDOW, path.resolve('/tmp/somewhere-else'))).rejects.toThrow('is not open');
    expect(gitUtils.getCollectionGitData).not.toHaveBeenCalled();
  });

  it('accepts a path nested inside an open collection', async () => {
    mockRepo();
    gitUtils.getCollectionGitData.mockResolvedValue({});
    gitUtils.getChangedFilesInCollectionGit.mockResolvedValue(CHANGED_FILES);
    gitUtils.getAheadBehindCount.mockResolvedValue({ ahead: 0, behind: 0 });

    const nested = path.join(COLLECTION_PATH, 'folder');
    expect((await getGitStatus(MAIN_WINDOW, nested)).isRepo).toBe(true);
  });

  it('rejects a sibling directory that shares the open collection prefix', async () => {
    mockRepo();

    await expect(getGitStatus(MAIN_WINDOW, `${COLLECTION_PATH}-evil`)).rejects.toThrow('is not open');
  });

  it('matches the open collection case-insensitively on win32 only', async () => {
    mockRepo();
    gitUtils.getCollectionGitData.mockResolvedValue({});
    gitUtils.getChangedFilesInCollectionGit.mockResolvedValue(CHANGED_FILES);
    gitUtils.getAheadBehindCount.mockResolvedValue({ ahead: 0, behind: 0 });

    const upperCased = COLLECTION_PATH.toUpperCase();
    if (process.platform === 'win32') {
      expect((await getGitStatus(MAIN_WINDOW, upperCased)).isRepo).toBe(true);
    } else {
      await expect(getGitStatus(MAIN_WINDOW, upperCased)).rejects.toThrow('is not open');
    }
  });
});

describe('UNC and case-insensitive path handling', () => {
  it('rejects a UNC network path', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, '\\\\server\\share\\evil.bru')).toThrow(
      'Path is outside the repository'
    );
  });

  it('rejects a posix-style network path', () => {
    expect(() => resolveInsideRepo(GIT_ROOT, '//server/share/evil.bru')).toThrow(
      'Path is outside the repository'
    );
  });

  it('rejects a UNC path on a mutation before touching git', async () => {
    mockRepo();

    await expect(
      stageGitFiles(MAIN_WINDOW, COLLECTION_PATH, { files: ['\\\\server\\share\\evil.bru'] })
    ).rejects.toThrow('Path is outside the repository');
    expect(gitUtils.stageChanges).not.toHaveBeenCalled();
  });

  it('rejects a mixed-separator traversal where `\\` is a separator', async () => {
    mockRepo();
    const filePath = 'collection\\..\\..\\..\\secrets.env';

    if (process.platform === 'win32') {
      await expect(getGitDiff(MAIN_WINDOW, COLLECTION_PATH, { kind: 'staged', filePath })).rejects.toThrow(
        'Path is outside the repository'
      );
      expect(gitUtils.getStagedFileDiff).not.toHaveBeenCalled();
    } else {
      // on posix `\` is not a separator: it stays part of the filename and never leaves the repo
      expect(resolveInsideRepo(GIT_ROOT, filePath).relativePath).toBe(filePath);
    }
  });

  it('compares an in-repo path case-insensitively on win32 only', () => {
    const upperCased = path.join(GIT_ROOT.toUpperCase(), 'a.bru');

    if (process.platform === 'win32') {
      expect(resolveInsideRepo(GIT_ROOT, upperCased).absolutePath).toBe(upperCased);
    } else {
      expect(() => resolveInsideRepo(GIT_ROOT, upperCased)).toThrow('Path is outside the repository');
    }
  });
});

describe('checkoutBranch branch name validation', () => {
  it.each([
    ['a leading dash (argument injection)', '--upload-pack=calc.exe'],
    ['a short flag', '-D'],
    ['a `..` sequence', 'feature/../main'],
    ['a space', 'my branch'],
    ['a `~` character', 'main~1'],
    ['a `:` character', 'main:evil'],
    ['a `?` character', 'main?'],
    ['a `*` character', 'feat/*'],
    ['a `[` character', 'feat/[x]'],
    ['a `@{` sequence', 'main@{upstream}'],
    ['the single `@` ref', '@'],
    ['a trailing `.lock`', 'feature/x.lock'],
    ['a trailing dot', 'feature.'],
    ['a leading slash', '/main'],
    ['a dot-prefixed segment', 'feature/.hidden']
  ])('rejects a branch name with %s', async (_label, branchName) => {
    mockRepo();

    await expect(checkoutBranch(MAIN_WINDOW, COLLECTION_PATH, { branchName })).rejects.toThrow(
      'Invalid branch name'
    );
    expect(gitUtils.checkoutGitBranch).not.toHaveBeenCalled();
  });

  it('rejects an empty branch name', async () => {
    mockRepo();

    await expect(checkoutBranch(MAIN_WINDOW, COLLECTION_PATH, { branchName: '  ' })).rejects.toThrow(
      'Branch name is required'
    );
  });

  it('forwards a valid branch name', async () => {
    mockRepo();

    await checkoutBranch(MAIN_WINDOW, COLLECTION_PATH, {
      branchName: '  feature/git-panel  ',
      shouldCreate: 1,
      processUid: 'uid-2'
    });

    expect(gitUtils.checkoutGitBranch).toHaveBeenCalledWith(MAIN_WINDOW, {
      gitRootPath: GIT_ROOT,
      branchName: 'feature/git-panel',
      processUid: 'uid-2',
      shouldCreate: true
    });
  });
});

describe('remote validation', () => {
  it('defaults to origin without querying the configured remotes', async () => {
    mockRepo();

    await fetchGitChanges(MAIN_WINDOW, COLLECTION_PATH, {});

    expect(gitUtils.fetchChanges).toHaveBeenCalledWith(GIT_ROOT, 'origin');
    expect(gitUtils.fetchRemotes).not.toHaveBeenCalled();
  });

  it('rejects a remote that starts with a dash', async () => {
    mockRepo();

    await expect(fetchGitChanges(MAIN_WINDOW, COLLECTION_PATH, { remote: '--upload-pack=calc.exe' })).rejects.toThrow(
      'Invalid git remote'
    );
    expect(gitUtils.fetchChanges).not.toHaveBeenCalled();
  });

  it('rejects a remote that is not configured on the repository', async () => {
    mockRepo();
    gitUtils.fetchRemotes.mockResolvedValue([{ name: 'origin' }, { name: 'upstream' }]);

    await expect(fetchGitChanges(MAIN_WINDOW, COLLECTION_PATH, { remote: 'evil' })).rejects.toThrow(
      'Unknown git remote: evil'
    );
    expect(gitUtils.fetchChanges).not.toHaveBeenCalled();
  });

  it('accepts a remote returned by fetchRemotes', async () => {
    mockRepo();
    gitUtils.fetchRemotes.mockResolvedValue([{ name: 'origin' }, { name: 'upstream' }]);

    await fetchGitChanges(MAIN_WINDOW, COLLECTION_PATH, { remote: 'upstream' });

    expect(gitUtils.fetchChanges).toHaveBeenCalledWith(GIT_ROOT, 'upstream');
  });

  it('rejects an unknown remote on pull before running git', async () => {
    mockRepo();
    gitUtils.fetchRemotes.mockResolvedValue([{ name: 'origin' }]);

    await expect(
      pullGitCommits(MAIN_WINDOW, COLLECTION_PATH, { remote: 'evil', remoteBranch: 'main' })
    ).rejects.toThrow('Unknown git remote: evil');
    expect(gitUtils.pullGitChanges).not.toHaveBeenCalled();
  });
});

describe('remote branch validation', () => {
  it('rejects a push remote branch that starts with a dash', async () => {
    mockRepo();

    await expect(
      pushGitCommits(MAIN_WINDOW, COLLECTION_PATH, { remoteBranch: '--receive-pack=calc.exe' })
    ).rejects.toThrow('Invalid remote branch name');
    expect(gitUtils.pushGitChanges).not.toHaveBeenCalled();
  });

  it('rejects a pull remote branch that starts with a dash', async () => {
    mockRepo();

    await expect(
      pullGitCommits(MAIN_WINDOW, COLLECTION_PATH, { remoteBranch: '--upload-pack=calc.exe' })
    ).rejects.toThrow('Invalid remote branch name');
    expect(gitUtils.pullGitChanges).not.toHaveBeenCalled();
  });

  it('falls back to the current branch when none is supplied', async () => {
    mockRepo();
    gitUtils.getCurrentGitBranch.mockResolvedValue('main');

    await pushGitCommits(MAIN_WINDOW, COLLECTION_PATH, { processUid: 'uid-3' });

    expect(gitUtils.pushGitChanges).toHaveBeenCalledWith(MAIN_WINDOW, {
      gitRootPath: GIT_ROOT,
      processUid: 'uid-3',
      remote: 'origin',
      remoteBranch: 'main'
    });
  });
});

describe('commit message limits', () => {
  it('rejects a commit message beyond the 10k cap', async () => {
    mockRepo();

    await expect(
      commitGitChanges(MAIN_WINDOW, COLLECTION_PATH, { message: 'a'.repeat(10001) })
    ).rejects.toThrow('Commit message is too long');
    expect(gitUtils.commitChanges).not.toHaveBeenCalled();
  });

  it('accepts a commit message at the cap', async () => {
    mockRepo();
    const message = 'a'.repeat(10000);

    await commitGitChanges(MAIN_WINDOW, COLLECTION_PATH, { message });

    expect(gitUtils.commitChanges).toHaveBeenCalledWith(GIT_ROOT, message);
  });
});

describe('registerGitIpc', () => {
  it('registers every renderer:git:* channel', () => {
    const { ipcMain } = require('electron');
    const registerGitIpc = require('./git');

    registerGitIpc(MAIN_WINDOW);

    const channels = ipcMain.handle.mock.calls.map(([channel]) => channel);
    expect(channels).toEqual(
      expect.arrayContaining([
        'renderer:git:status',
        'renderer:git:init',
        'renderer:git:stage',
        'renderer:git:unstage',
        'renderer:git:discard',
        'renderer:git:commit',
        'renderer:git:push',
        'renderer:git:pull',
        'renderer:git:fetch',
        'renderer:git:checkout-branch',
        'renderer:git:log',
        'renderer:git:commit-files',
        'renderer:git:diff'
      ])
    );
  });
});
