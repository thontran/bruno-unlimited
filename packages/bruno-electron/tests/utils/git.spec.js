const path = require('path');

jest.mock('@usebruno/filestore', () => ({ parseRequest: jest.fn() }), { virtual: true });

// `simple-git` is called once per repo root and the instance is cached in the module, so every
// test shares one fake whose per-command behaviour is swapped in `beforeEach`.
const mockGit = {
  status: jest.fn(),
  reset: jest.fn(),
  raw: jest.fn(),
  add: jest.fn()
};
jest.mock('simple-git', () => jest.fn(() => mockGit));

const { getChangedFilesInCollectionGit, unstageChanges, getCommitFiles } = require('../../src/utils/git');

const GIT_ROOT = path.resolve('/tmp/git-root');

// Shape of a `simple-git` status entry: the two porcelain columns plus the repo relative path.
const statusEntry = (filePath, index, workingDir, extra = {}) => ({
  path: filePath,
  index,
  working_dir: workingDir,
  ...extra
});

const mockStatus = (files, renamed = []) => {
  mockGit.status.mockImplementation((args, callback) => {
    const status = { files, renamed };
    if (typeof callback === 'function') {
      callback(null, status);
      return undefined;
    }
    return Promise.resolve(status);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGit.reset.mockResolvedValue('reset');
  mockGit.raw.mockResolvedValue('');
});

describe('getChangedFilesInCollectionGit', () => {
  it('lists a working-tree deletion as unstaged', async () => {
    mockStatus([statusEntry('login.bru', ' ', 'D')]);

    const changes = await getChangedFilesInCollectionGit(GIT_ROOT, GIT_ROOT);

    expect(changes.unstaged).toEqual([
      { path: 'login.bru', type: 'unstaged', fileIndex: ' ', working_dir: 'D' }
    ]);
  });

  it('lists a file deleted after its modification was staged in both groups', async () => {
    mockStatus([statusEntry('other.bru', 'M', 'D')]);

    const changes = await getChangedFilesInCollectionGit(GIT_ROOT, GIT_ROOT);

    expect(changes.unstaged.map((file) => file.path)).toEqual(['other.bru']);
    expect(changes.staged.map((file) => file.path)).toEqual(['other.bru']);
  });

  it('groups conflicts as conflicted only', async () => {
    mockStatus([statusEntry('both.bru', 'U', 'U'), statusEntry('added.bru', 'A', 'A')]);

    const changes = await getChangedFilesInCollectionGit(GIT_ROOT, GIT_ROOT);

    expect(changes.conflicted.map((file) => file.path)).toEqual(['both.bru', 'added.bru']);
    expect(changes.unstaged).toEqual([]);
    expect(changes.staged).toEqual([]);
  });

  it('keeps a staged-only change out of the unstaged group', async () => {
    mockStatus([statusEntry('a.bru', 'M', ' '), statusEntry('new.bru', 'R', ' ', { from: 'old.bru' })], [
      { from: 'old.bru', to: 'new.bru' }
    ]);

    const changes = await getChangedFilesInCollectionGit(GIT_ROOT, GIT_ROOT);

    expect(changes.unstaged).toEqual([]);
    expect(changes.staged.map((file) => file.path)).toEqual(['a.bru', 'new.bru']);
  });

  it('lists an untracked file as unstaged', async () => {
    mockStatus([statusEntry('untracked.bru', '?', '?')]);

    const changes = await getChangedFilesInCollectionGit(GIT_ROOT, GIT_ROOT);

    expect(changes.unstaged.map((file) => file.path)).toEqual(['untracked.bru']);
  });
});

describe('unstageChanges', () => {
  it('resets both pathspecs of a staged rename', async () => {
    mockStatus([statusEntry('new.bru', 'R', ' ', { from: 'old.bru' })], [{ from: 'old.bru', to: 'new.bru' }]);

    await unstageChanges(GIT_ROOT, [path.join(GIT_ROOT, 'new.bru')]);

    expect(mockGit.reset).toHaveBeenCalledWith([
      'HEAD',
      '--',
      path.join(GIT_ROOT, 'new.bru'),
      path.join(GIT_ROOT, 'old.bru')
    ]);
  });

  it('removes from the index when the repository has no commits', async () => {
    mockStatus([statusEntry('bruno.json', 'A', ' ')]);
    mockGit.raw.mockRejectedValueOnce(new Error('fatal: Needed a single revision'));

    await unstageChanges(GIT_ROOT, [path.join(GIT_ROOT, 'bruno.json')]);

    expect(mockGit.reset).not.toHaveBeenCalled();
    expect(mockGit.raw).toHaveBeenLastCalledWith([
      'rm',
      '--cached',
      '-r',
      '--',
      path.join(GIT_ROOT, 'bruno.json')
    ]);
  });

  it('resets against HEAD once the repository has a commit', async () => {
    mockStatus([statusEntry('a.bru', 'M', ' ')]);
    mockGit.raw.mockResolvedValueOnce('abc1234');

    await unstageChanges(GIT_ROOT, [path.join(GIT_ROOT, 'a.bru')]);

    expect(mockGit.reset).toHaveBeenCalledWith(['HEAD', '--', path.join(GIT_ROOT, 'a.bru')]);
  });

  it('does not touch the index when nothing requested is staged', async () => {
    mockStatus([statusEntry('a.bru', ' ', 'M')]);

    await unstageChanges(GIT_ROOT, [path.join(GIT_ROOT, 'a.bru')]);

    expect(mockGit.reset).not.toHaveBeenCalled();
    expect(mockGit.raw).not.toHaveBeenCalled();
  });
});

describe('getCommitFiles', () => {
  it('parses scored rename records', async () => {
    mockGit.raw.mockImplementation((args, callback) => {
      callback(null, 'R100\told.bru\tnew.bru\nM\ta.bru\nA\tb.bru\nD\tc.bru\n');
    });

    const files = await getCommitFiles(GIT_ROOT, 'abc1234');

    expect(files).toEqual([
      { path: 'new.bru', from: 'old.bru', to: 'new.bru', status: 'renamed' },
      { path: 'a.bru', status: 'modified' },
      { path: 'b.bru', status: 'added' },
      { path: 'c.bru', status: 'deleted' }
    ]);
  });
});
