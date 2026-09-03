jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'process-uid-1'
}));

const mockToastError = jest.fn();
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: (...args) => mockToastError(...args) }
}));

import { configureStore } from '@reduxjs/toolkit';
import gitReducer from 'providers/ReduxStore/slices/git';
import appReducer from 'providers/ReduxStore/slices/app';

const COLLECTION_UID = 'col-1';
const COLLECTION_PATH = '/collections/acme';

const STATUS = {
  isRepo: true,
  gitRootPath: '/collections',
  currentBranch: 'main',
  defaultBranch: 'main',
  branches: ['main'],
  remoteUrl: null,
  ahead: 0,
  behind: 0,
  changes: { staged: [], unstaged: [], conflicted: [], totalFiles: 0, tooManyFiles: false }
};

const invoke = jest.fn();
let actions;

// actions.js destructures `window.ipcRenderer` at module scope, so it has to exist before require.
beforeAll(() => {
  window.ipcRenderer = { invoke };
  actions = require('providers/ReduxStore/slices/git/actions');
});

beforeEach(() => {
  invoke.mockReset();
  mockToastError.mockReset();
});

const collectionsReducer = (state = { collections: [{ uid: COLLECTION_UID, pathname: COLLECTION_PATH }] }) => state;

const createStore = () =>
  configureStore({
    reducer: { git: gitReducer, app: appReducer, collections: collectionsReducer }
  });

const getGit = (store) => store.getState().git.byCollection[COLLECTION_UID];
const channelsCalled = () => invoke.mock.calls.map((call) => call[0]);

describe('git thunks — reads', () => {
  it('fetchGitStatus resolves the collection pathname and stores the status', async () => {
    invoke.mockResolvedValue(STATUS);
    const store = createStore();

    await store.dispatch(actions.fetchGitStatus(COLLECTION_UID));

    expect(invoke).toHaveBeenCalledWith('renderer:git:status', COLLECTION_PATH);
    expect(getGit(store).status).toEqual(STATUS);
    expect(getGit(store).loading).toBe(false);
    expect(getGit(store).error).toBeNull();
  });

  it('fetchGitLog stores the commit list', async () => {
    invoke.mockResolvedValue([{ hash: 'abc' }]);
    const store = createStore();

    await store.dispatch(actions.fetchGitLog(COLLECTION_UID));

    expect(invoke).toHaveBeenCalledWith('renderer:git:log', COLLECTION_PATH);
    expect(getGit(store).log).toEqual([{ hash: 'abc' }]);
  });

  it('fetchCommitFiles keys the file list by commit hash', async () => {
    invoke.mockResolvedValue([{ path: 'a.bru' }]);
    const store = createStore();

    await store.dispatch(actions.fetchCommitFiles(COLLECTION_UID, 'abc'));

    expect(invoke).toHaveBeenCalledWith('renderer:git:commit-files', COLLECTION_PATH, { commitHash: 'abc' });
    expect(getGit(store).commitFiles).toEqual({ abc: [{ path: 'a.bru' }] });
  });

  it('loadDiff stores the diff along with what it was requested for, and clearDiff drops it', async () => {
    invoke.mockResolvedValue({ raw: '@@ -1 +1 @@', visual: null });
    const store = createStore();

    await store.dispatch(actions.loadDiff(COLLECTION_UID, { kind: 'unstaged', filePath: 'a.bru' }));

    expect(invoke).toHaveBeenCalledWith('renderer:git:diff', COLLECTION_PATH, {
      kind: 'unstaged',
      filePath: 'a.bru',
      commitHash: null
    });
    expect(getGit(store).selectedDiff).toEqual({
      kind: 'unstaged',
      filePath: 'a.bru',
      commitHash: null,
      raw: '@@ -1 +1 @@',
      visual: null
    });

    store.dispatch(actions.clearDiff(COLLECTION_UID));
    expect(getGit(store).selectedDiff).toBeNull();
  });

  it('initGitRepo stores the status the init handler returns without a second round-trip', async () => {
    invoke.mockResolvedValue(STATUS);
    const store = createStore();

    await store.dispatch(actions.initGitRepo(COLLECTION_UID));

    expect(channelsCalled()).toEqual(['renderer:git:init']);
    expect(getGit(store).status).toEqual(STATUS);
  });
});

describe('git thunks — mutations refresh state', () => {
  it('stageFiles sends repo-relative paths and refreshes status', async () => {
    invoke.mockImplementation((channel) => Promise.resolve(channel === 'renderer:git:status' ? STATUS : undefined));
    const store = createStore();

    await store.dispatch(actions.stageFiles(COLLECTION_UID, ['a.bru']));

    expect(invoke).toHaveBeenCalledWith('renderer:git:stage', COLLECTION_PATH, { files: ['a.bru'] });
    expect(channelsCalled()).toEqual(['renderer:git:stage', 'renderer:git:status']);
    expect(getGit(store).status).toEqual(STATUS);
  });

  it('commitChanges refreshes both status and log', async () => {
    invoke.mockImplementation((channel) =>
      Promise.resolve(channel === 'renderer:git:status' ? STATUS : channel === 'renderer:git:log' ? [] : undefined)
    );
    const store = createStore();

    await store.dispatch(actions.commitChanges(COLLECTION_UID, 'feat: add'));

    expect(invoke).toHaveBeenCalledWith('renderer:git:commit', COLLECTION_PATH, { message: 'feat: add' });
    expect(channelsCalled()).toEqual(['renderer:git:commit', 'renderer:git:status', 'renderer:git:log']);
  });

  it('pullChanges defaults to the fast-forward strategy and carries a processUid', async () => {
    invoke.mockImplementation((channel) =>
      Promise.resolve(channel === 'renderer:git:status' ? STATUS : channel === 'renderer:git:log' ? [] : undefined)
    );
    const store = createStore();

    await store.dispatch(actions.pullChanges(COLLECTION_UID));

    expect(invoke).toHaveBeenCalledWith('renderer:git:pull', COLLECTION_PATH, {
      strategy: '--ff-only',
      processUid: 'process-uid-1'
    });
    // processUid is released once the operation settles so progress entries don't leak
    expect(getGit(store).processUid).toBeNull();
    expect(store.getState().app.gitOperationProgress).toEqual({});
  });

  it('checkoutBranch forwards branchName and shouldCreate', async () => {
    invoke.mockImplementation((channel) =>
      Promise.resolve(channel === 'renderer:git:status' ? STATUS : channel === 'renderer:git:log' ? [] : undefined)
    );
    const store = createStore();

    await store.dispatch(actions.checkoutBranch(COLLECTION_UID, 'feature/x', true));

    expect(invoke).toHaveBeenCalledWith('renderer:git:checkout-branch', COLLECTION_PATH, {
      branchName: 'feature/x',
      shouldCreate: true,
      processUid: 'process-uid-1'
    });
  });

  it('pushChanges lets the main process pick the remote', async () => {
    invoke.mockImplementation((channel) => Promise.resolve(channel === 'renderer:git:status' ? STATUS : undefined));
    const store = createStore();

    await store.dispatch(actions.pushChanges(COLLECTION_UID));

    expect(invoke).toHaveBeenCalledWith('renderer:git:push', COLLECTION_PATH, { processUid: 'process-uid-1' });
    expect(channelsCalled()).toEqual(['renderer:git:push', 'renderer:git:status']);
  });
});

describe('git thunks — failures', () => {
  it('reports the IPC error once, stores it and stops before the refresh', async () => {
    invoke.mockRejectedValue(new Error('Path is outside the repository'));
    const store = createStore();

    await expect(store.dispatch(actions.discardFiles(COLLECTION_UID, ['../etc/passwd']))).rejects.toThrow(
      'Path is outside the repository'
    );

    expect(channelsCalled()).toEqual(['renderer:git:discard']);
    expect(getGit(store).error).toBe('Path is outside the repository');
    expect(getGit(store).loading).toBe(false);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith('Path is outside the repository');
  });

  it('fails without touching IPC when the collection is unknown', async () => {
    const store = createStore();

    await expect(store.dispatch(actions.fetchGitStatus('missing-uid'))).rejects.toThrow('Collection not found');

    expect(invoke).not.toHaveBeenCalled();
    expect(store.getState().git.byCollection['missing-uid'].error).toBe('Collection not found');
  });
});
