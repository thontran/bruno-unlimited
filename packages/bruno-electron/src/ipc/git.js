const path = require('path');
const { ipcMain } = require('electron');
const {
  cloneGitRepository,
  getCollectionGitRepoUrl,
  getCollectionGitRootPath,
  getCollectionGitData,
  getChangedFilesInCollectionGit,
  getAheadBehindCount,
  getCurrentGitBranch,
  initGit,
  stageChanges,
  unstageChanges,
  discardChanges,
  commitChanges,
  pushGitChanges,
  pullGitChanges,
  fetchChanges,
  fetchRemotes,
  checkoutGitBranch,
  getCollectionGitLogs,
  getCommitFiles,
  getCommitFileDiff,
  getStagedFileDiff,
  getUnstagedFileDiff,
  supportsVisualDiff,
  getFileContentForVisualDiff,
  getWorkingFileContentForVisualDiff
} = require('../utils/git');
const { createDirectory, removeDirectory } = require('../utils/filesystem');
const collectionWatcher = require('../app/collection-watcher');

const PULL_STRATEGIES = ['--ff-only', '--no-rebase'];
const DIFF_KINDS = ['staged', 'unstaged', 'commit'];
const COMMIT_HASH_REGEX = /^[0-9a-f]{7,40}$/i;
// Remote names are additionally checked against `fetchRemotes`; the regex only limits the
// characters we are willing to hand to the git CLI and blocks a leading `-` (a flag).
const REMOTE_NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// `git check-ref-format` rejects control characters, space, `~^:?*[` and `\`.
const INVALID_REF_CHARS_REGEX = /[\u0000-\u0020~^:?*[\\\u007f]/;
const MAX_REF_NAME_LENGTH = 255;
const MAX_COMMIT_MESSAGE_LENGTH = 10000;
// win32 UNC (`\\server\share`) and its posix-looking twin (`//server/share`): both reach a
// network location without a `..` segment, so they never resolve to repo-relative content.
const UNC_PATH_REGEX = /^(\\\\|\/\/)/;

const getCollectionGitRemoteUrl = async (collectionPath) => {
  try {
    const url = await getCollectionGitRepoUrl(collectionPath);
    return url || null;
  } catch (error) {
    return null;
  }
};

/**
 * win32 paths are case-insensitive, so `C:\Repo` and `c:\repo` are the same directory.
 * Compare case-folded there; on posix keep the comparison exact.
 */
const toComparablePath = (value) => {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

/** True when `child` is `parent` itself or lives under it — never for a prefix sibling. */
const isInsideDirectory = (parent, child) => {
  const parentPath = toComparablePath(parent);
  const childPath = toComparablePath(child);
  const parentWithSep = parentPath.endsWith(path.sep) ? parentPath : `${parentPath}${path.sep}`;
  return childPath === parentPath || childPath.startsWith(parentWithSep);
};

const assertCollectionPath = (collectionPath) => {
  if (typeof collectionPath !== 'string' || !collectionPath.trim() || !path.isAbsolute(collectionPath)) {
    throw new Error('A valid absolute collection path is required');
  }

  // The preload forwards any channel, so an absolute path is not enough: the git operation must
  // target a collection the user actually has open. Same trust source as
  // `validatePathIsInsideCollection` in ipc/collection.js — the watcher registry.
  const watchedPaths = collectionWatcher.getAllWatcherPaths() || [];
  if (!watchedPaths.some((watchedPath) => isInsideDirectory(watchedPath, collectionPath))) {
    throw new Error(`Collection: ${collectionPath} is not open`);
  }

  return collectionPath;
};

/**
 * Resolve a renderer supplied file path against the repository root.
 * Rejects traversal (`..`), absolute paths outside the repo and sibling
 * directories that merely share the root's prefix.
 * Returns the absolute path (for git pathspecs / fs reads) and the
 * posix-separated repo-relative path (for `git show <rev>:<path>`).
 */
const resolveInsideRepo = (gitRootPath, filePath) => {
  if (typeof gitRootPath !== 'string' || !gitRootPath.trim()) {
    throw new Error('Git root path is required');
  }
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('A file path is required');
  }
  if (UNC_PATH_REGEX.test(filePath.trim())) {
    throw new Error('Path is outside the repository');
  }

  const root = path.resolve(gitRootPath);
  const absolutePath = path.resolve(root, filePath);

  if (!isInsideDirectory(root, absolutePath)) {
    throw new Error('Path is outside the repository');
  }

  const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
  return { absolutePath, relativePath };
};

const resolveFilePathsInsideRepo = (gitRootPath, files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('files must be a non-empty array of file paths');
  }
  return files.map((filePath) => resolveInsideRepo(gitRootPath, filePath).absolutePath);
};

/**
 * Resolve the remote to operate on. Defaults to `origin`; any other name must be configured on
 * the repository, so a renderer cannot smuggle a flag or an arbitrary URL in as a "remote".
 */
const resolveRemoteName = async (gitRootPath, remote) => {
  if (remote === undefined || remote === null) {
    return 'origin';
  }

  const name = typeof remote === 'string' ? remote.trim() : '';
  if (!name || !REMOTE_NAME_REGEX.test(name)) {
    throw new Error('Invalid git remote');
  }
  if (name === 'origin') {
    return name;
  }

  const remotes = await fetchRemotes(gitRootPath);
  const isKnown = (Array.isArray(remotes) ? remotes : []).some(
    (entry) => (typeof entry === 'string' ? entry : entry?.name) === name
  );
  if (!isKnown) {
    throw new Error(`Unknown git remote: ${name}`);
  }

  return name;
};

/**
 * Validate a renderer supplied branch name against the `git check-ref-format --branch` rules
 * plus the CLI rule that a leading `-` is parsed as a flag (e.g. `--upload-pack=<cmd>`) instead
 * of a ref. simple-git passes these through as argv entries, so this is the only gate.
 */
const assertRefName = (value, label) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) {
    throw new Error(`${label} is required`);
  }

  const isInvalid
    = name.length > MAX_REF_NAME_LENGTH
      || name.startsWith('-')
      || INVALID_REF_CHARS_REGEX.test(name)
      || name.includes('..')
      || name.includes('@{')
      || name === '@'
      || name.startsWith('/')
      || name.endsWith('/')
      || name.includes('//')
      || name.endsWith('.')
      || name.split('/').some((segment) => segment.startsWith('.') || segment.endsWith('.lock'));

  if (isInvalid) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }

  return name;
};

const assertCommitHash = (commitHash) => {
  if (typeof commitHash !== 'string' || !COMMIT_HASH_REGEX.test(commitHash.trim())) {
    throw new Error('Invalid commit hash');
  }
  return commitHash.trim();
};

const requireGitRootPath = (collectionPath) => {
  assertCollectionPath(collectionPath);
  const gitRootPath = getCollectionGitRootPath(collectionPath);
  if (!gitRootPath) {
    throw new Error('Collection is not inside a git repository');
  }
  return gitRootPath;
};

/**
 * `renderer:git:status`
 * @returns {{ isRepo: false } | { isRepo: true, gitRootPath: string, currentBranch: string|null,
 *   defaultBranch: string|null, branches: string[], remoteUrl: string|null, ahead: number,
 *   behind: number, changes: { staged: object[], unstaged: object[], conflicted: object[],
 *   totalFiles: number, tooManyFiles: boolean } }}
 */
const getGitStatus = async (mainWindow, collectionPath) => {
  assertCollectionPath(collectionPath);
  const gitRootPath = getCollectionGitRootPath(collectionPath);
  if (!gitRootPath) {
    return { isRepo: false };
  }

  const [gitData, changes, aheadBehind] = await Promise.all([
    getCollectionGitData(gitRootPath, collectionPath),
    getChangedFilesInCollectionGit(gitRootPath, collectionPath),
    getAheadBehindCount(gitRootPath)
  ]);

  return {
    isRepo: true,
    gitRootPath,
    currentBranch: gitData?.currentGitBranch || null,
    defaultBranch: gitData?.defaultGitBranch || null,
    branches: gitData?.branches || [],
    remoteUrl: gitData?.gitRepoUrl || null,
    ahead: aheadBehind?.ahead || 0,
    behind: aheadBehind?.behind || 0,
    changes: {
      staged: changes?.staged || [],
      unstaged: changes?.unstaged || [],
      conflicted: changes?.conflicted || [],
      totalFiles: changes?.totalFiles || 0,
      tooManyFiles: Boolean(changes?.tooManyFiles)
    }
  };
};

/** `renderer:git:init` — initializes a repo at the collection root, then returns the fresh status */
const initGitRepository = async (mainWindow, collectionPath) => {
  assertCollectionPath(collectionPath);
  if (getCollectionGitRootPath(collectionPath)) {
    throw new Error('Collection is already inside a git repository');
  }
  await initGit(collectionPath);
  return getGitStatus(mainWindow, collectionPath);
};

/** `renderer:git:stage` — payload `{ files: string[] }` relative to the repo root */
const stageGitFiles = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  await stageChanges(gitRootPath, resolveFilePathsInsideRepo(gitRootPath, payload.files));
};

/** `renderer:git:unstage` — payload `{ files: string[] }` relative to the repo root */
const unstageGitFiles = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  await unstageChanges(gitRootPath, resolveFilePathsInsideRepo(gitRootPath, payload.files));
};

/** `renderer:git:discard` — payload `{ files: string[] }` relative to the repo root */
const discardGitFiles = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  await discardChanges(gitRootPath, resolveFilePathsInsideRepo(gitRootPath, payload.files));
};

/** `renderer:git:commit` — payload `{ message }` */
const commitGitChanges = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) {
    throw new Error('Commit message is required');
  }
  if (message.length > MAX_COMMIT_MESSAGE_LENGTH) {
    throw new Error('Commit message is too long');
  }
  await commitChanges(gitRootPath, message);
};

/** `renderer:git:push` — payload `{ processUid, remote = 'origin', remoteBranch }` */
const pushGitCommits = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  const remote = await resolveRemoteName(gitRootPath, payload.remote);
  const remoteBranch = typeof payload.remoteBranch === 'string' && payload.remoteBranch.trim()
    ? assertRefName(payload.remoteBranch, 'Remote branch name')
    : await getCurrentGitBranch(gitRootPath);

  if (!remoteBranch) {
    throw new Error('Unable to resolve the branch to push');
  }

  await pushGitChanges(mainWindow, {
    gitRootPath,
    processUid: payload.processUid,
    remote,
    remoteBranch
  });
};

/** `renderer:git:pull` — payload `{ processUid, remote = 'origin', remoteBranch, strategy }` */
const pullGitCommits = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  const strategy = payload.strategy === undefined ? '--ff-only' : payload.strategy;

  if (!PULL_STRATEGIES.includes(strategy)) {
    throw new Error('Invalid pull strategy');
  }

  const remote = await resolveRemoteName(gitRootPath, payload.remote);
  const remoteBranch = typeof payload.remoteBranch === 'string' && payload.remoteBranch.trim()
    ? assertRefName(payload.remoteBranch, 'Remote branch name')
    : await getCurrentGitBranch(gitRootPath);

  if (!remoteBranch) {
    throw new Error('Unable to resolve the branch to pull');
  }

  await pullGitChanges(mainWindow, {
    gitRootPath,
    processUid: payload.processUid,
    remote,
    remoteBranch,
    strategy
  });
};

/** `renderer:git:fetch` — payload `{ remote = 'origin' }` */
const fetchGitChanges = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  await fetchChanges(gitRootPath, await resolveRemoteName(gitRootPath, payload.remote));
};

/** `renderer:git:checkout-branch` — payload `{ branchName, shouldCreate, processUid }` */
const checkoutBranch = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  const branchName = assertRefName(payload.branchName, 'Branch name');

  await checkoutGitBranch(mainWindow, {
    gitRootPath,
    branchName,
    processUid: payload.processUid,
    shouldCreate: Boolean(payload.shouldCreate)
  });
};

/** `renderer:git:log` */
const getGitLog = async (mainWindow, collectionPath) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  return getCollectionGitLogs(gitRootPath);
};

/** `renderer:git:commit-files` — payload `{ commitHash }` */
const getGitCommitFiles = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  return getCommitFiles(gitRootPath, assertCommitHash(payload.commitHash));
};

/**
 * `renderer:git:diff` — payload `{ kind: 'staged'|'unstaged'|'commit', filePath, commitHash? }`
 * @returns {{ raw: string, visual: { before: { content, parsed }, after: { content, parsed } } | null }}
 */
const getGitDiff = async (mainWindow, collectionPath, payload = {}) => {
  const gitRootPath = requireGitRootPath(collectionPath);
  const { kind } = payload;

  if (!DIFF_KINDS.includes(kind)) {
    throw new Error('Invalid diff kind');
  }

  const { absolutePath, relativePath } = resolveInsideRepo(gitRootPath, payload.filePath);
  const commitHash = kind === 'commit' ? assertCommitHash(payload.commitHash) : null;

  let raw;
  if (kind === 'commit') {
    raw = await getCommitFileDiff(gitRootPath, commitHash, absolutePath);
  } else if (kind === 'staged') {
    raw = await getStagedFileDiff(gitRootPath, absolutePath);
  } else {
    raw = await getUnstagedFileDiff(gitRootPath, absolutePath);
  }

  let visual = null;
  if (supportsVisualDiff(relativePath)) {
    const content = kind === 'commit'
      ? await getFileContentForVisualDiff(gitRootPath, commitHash, relativePath)
      : await getWorkingFileContentForVisualDiff(gitRootPath, relativePath, kind);

    if (content) {
      visual = {
        before: { content: content.oldContent ?? null, parsed: content.oldParsed ?? null },
        after: { content: content.newContent ?? null, parsed: content.newParsed ?? null }
      };
    }
  }

  return { raw: raw || '', visual };
};

const registerGitIpc = (mainWindow) => {
  ipcMain.handle('renderer:clone-git-repository', async (event, { url, path, processUid }) => {
    let directoryCreated = false;
    try {
      await createDirectory(path);
      directoryCreated = true;
      await cloneGitRepository(mainWindow, { url, path, processUid });
      return 'Repository cloned successfully';
    } catch (error) {
      if (directoryCreated) {
        await removeDirectory(path);
      }
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:get-collection-git-remote-url', (event, collectionPath) =>
    getCollectionGitRemoteUrl(collectionPath)
  );

  ipcMain.handle('renderer:git:status', (event, collectionPath, payload) =>
    getGitStatus(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:init', (event, collectionPath, payload) =>
    initGitRepository(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:stage', (event, collectionPath, payload) =>
    stageGitFiles(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:unstage', (event, collectionPath, payload) =>
    unstageGitFiles(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:discard', (event, collectionPath, payload) =>
    discardGitFiles(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:commit', (event, collectionPath, payload) =>
    commitGitChanges(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:push', (event, collectionPath, payload) =>
    pushGitCommits(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:pull', (event, collectionPath, payload) =>
    pullGitCommits(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:fetch', (event, collectionPath, payload) =>
    fetchGitChanges(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:checkout-branch', (event, collectionPath, payload) =>
    checkoutBranch(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:log', (event, collectionPath, payload) =>
    getGitLog(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:commit-files', (event, collectionPath, payload) =>
    getGitCommitFiles(mainWindow, collectionPath, payload)
  );
  ipcMain.handle('renderer:git:diff', (event, collectionPath, payload) =>
    getGitDiff(mainWindow, collectionPath, payload)
  );
};

module.exports = registerGitIpc;
module.exports.getCollectionGitRemoteUrl = getCollectionGitRemoteUrl;
module.exports.resolveInsideRepo = resolveInsideRepo;
module.exports.getGitStatus = getGitStatus;
module.exports.initGitRepository = initGitRepository;
module.exports.stageGitFiles = stageGitFiles;
module.exports.unstageGitFiles = unstageGitFiles;
module.exports.discardGitFiles = discardGitFiles;
module.exports.commitGitChanges = commitGitChanges;
module.exports.pushGitCommits = pushGitCommits;
module.exports.pullGitCommits = pullGitCommits;
module.exports.fetchGitChanges = fetchGitChanges;
module.exports.checkoutBranch = checkoutBranch;
module.exports.getGitLog = getGitLog;
module.exports.getGitCommitFiles = getGitCommitFiles;
module.exports.getGitDiff = getGitDiff;
