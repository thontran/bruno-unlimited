import { configureStore } from '@reduxjs/toolkit';
import gitReducer, {
  setLoading,
  setStatus,
  setLog,
  setCommitFiles,
  setSelectedDiff,
  clearDiff,
  setError,
  setProcessUid,
  resetCollectionGit
} from 'providers/ReduxStore/slices/git';

const COLLECTION_UID = 'col-1';

const createStore = () => configureStore({ reducer: { git: gitReducer } });

const getGit = (store, collectionUid = COLLECTION_UID) => store.getState().git.byCollection[collectionUid];

const makeStatus = (currentBranch) => ({
  isRepo: true,
  gitRootPath: '/repo',
  currentBranch,
  defaultBranch: 'main',
  branches: ['main', currentBranch],
  remoteUrl: 'git@example.com:acme/repo.git',
  ahead: 0,
  behind: 0,
  changes: { staged: [], unstaged: [], conflicted: [], totalFiles: 0, tooManyFiles: false }
});

describe('git slice — lazy per-collection initialisation', () => {
  it('starts with an empty byCollection map', () => {
    const store = createStore();
    expect(store.getState().git).toEqual({ byCollection: {} });
  });

  it('initialises a cold collectionUid with the full default shape', () => {
    const store = createStore();

    store.dispatch(setLoading({ collectionUid: COLLECTION_UID, loading: true }));

    expect(getGit(store)).toEqual({
      status: null,
      log: [],
      commitFiles: {},
      selectedDiff: null,
      loading: true,
      error: null,
      processUid: null
    });
  });

  it.each([
    ['setStatus', setStatus({ collectionUid: COLLECTION_UID, status: makeStatus('main') })],
    ['setLog', setLog({ collectionUid: COLLECTION_UID, log: [{ hash: 'abc' }] })],
    ['setCommitFiles', setCommitFiles({ collectionUid: COLLECTION_UID, commitHash: 'abc', files: [] })],
    ['setSelectedDiff', setSelectedDiff({ collectionUid: COLLECTION_UID, diff: { kind: 'staged' } })],
    ['clearDiff', clearDiff({ collectionUid: COLLECTION_UID })],
    ['setError', setError({ collectionUid: COLLECTION_UID, error: 'boom' })],
    ['setProcessUid', setProcessUid({ collectionUid: COLLECTION_UID, processUid: 'p-1' })]
  ])('%s is safe on a collection that has no entry yet', (_name, action) => {
    const store = createStore();

    store.dispatch(action);

    expect(getGit(store)).toBeDefined();
    expect(getGit(store).loading).toBe(false);
  });

  it('keeps collections independent', () => {
    const store = createStore();

    store.dispatch(setStatus({ collectionUid: COLLECTION_UID, status: makeStatus('main') }));
    store.dispatch(setStatus({ collectionUid: 'col-2', status: makeStatus('feature') }));

    expect(getGit(store).status.currentBranch).toBe('main');
    expect(getGit(store, 'col-2').status.currentBranch).toBe('feature');
  });
});

describe('git slice — reducers', () => {
  it('setStatus replaces the previous status instead of merging it', () => {
    const store = createStore();

    store.dispatch(setStatus({ collectionUid: COLLECTION_UID, status: makeStatus('main') }));
    store.dispatch(setStatus({ collectionUid: COLLECTION_UID, status: { isRepo: false } }));

    expect(getGit(store).status).toEqual({ isRepo: false });
  });

  it('setCommitFiles stores files per commit hash', () => {
    const store = createStore();

    store.dispatch(setCommitFiles({ collectionUid: COLLECTION_UID, commitHash: 'abc', files: [{ path: 'a.bru' }] }));
    store.dispatch(setCommitFiles({ collectionUid: COLLECTION_UID, commitHash: 'def', files: [{ path: 'b.bru' }] }));

    expect(getGit(store).commitFiles).toEqual({
      abc: [{ path: 'a.bru' }],
      def: [{ path: 'b.bru' }]
    });
  });

  it('clearDiff nulls the selected diff and leaves the rest of the collection state intact', () => {
    const store = createStore();

    store.dispatch(setLog({ collectionUid: COLLECTION_UID, log: [{ hash: 'abc' }] }));
    store.dispatch(
      setSelectedDiff({
        collectionUid: COLLECTION_UID,
        diff: { kind: 'unstaged', filePath: 'a.bru', commitHash: null, raw: '@@ diff', visual: null }
      })
    );

    store.dispatch(clearDiff({ collectionUid: COLLECTION_UID }));

    expect(getGit(store).selectedDiff).toBeNull();
    expect(getGit(store).log).toEqual([{ hash: 'abc' }]);
  });

  it('setError clears the error when passed null', () => {
    const store = createStore();

    store.dispatch(setError({ collectionUid: COLLECTION_UID, error: 'boom' }));
    expect(getGit(store).error).toBe('boom');

    store.dispatch(setError({ collectionUid: COLLECTION_UID, error: null }));
    expect(getGit(store).error).toBeNull();
  });

  it('resetCollectionGit deletes only that collection key', () => {
    const store = createStore();

    store.dispatch(setStatus({ collectionUid: COLLECTION_UID, status: makeStatus('main') }));
    store.dispatch(setStatus({ collectionUid: 'col-2', status: makeStatus('feature') }));

    store.dispatch(resetCollectionGit(COLLECTION_UID));

    expect(store.getState().git.byCollection).not.toHaveProperty(COLLECTION_UID);
    expect(getGit(store, 'col-2')).toBeDefined();
  });

  it('resetCollectionGit also accepts the { collectionUid } payload shape', () => {
    const store = createStore();

    store.dispatch(setProcessUid({ collectionUid: COLLECTION_UID, processUid: 'p-1' }));
    store.dispatch(resetCollectionGit({ collectionUid: COLLECTION_UID }));

    expect(store.getState().git.byCollection).toEqual({});
  });

  it('resetCollectionGit on an unknown collection is a no-op', () => {
    const store = createStore();

    store.dispatch(setStatus({ collectionUid: COLLECTION_UID, status: makeStatus('main') }));
    store.dispatch(resetCollectionGit('col-unknown'));

    expect(getGit(store)).toBeDefined();
  });
});
