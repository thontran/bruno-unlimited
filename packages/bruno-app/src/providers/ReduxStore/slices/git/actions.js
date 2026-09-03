import toast from 'react-hot-toast';
import { uuid } from 'utils/common/index';
import { removeGitOperationProgress } from '../app';
import {
  setLoading,
  setStatus,
  setLog,
  setCommitFiles,
  setSelectedDiff,
  clearDiff as clearSelectedDiff,
  setError,
  setProcessUid
} from './index';

const { ipcRenderer } = window;

const resolveCollectionPath = (getState, collectionUid) => {
  const collection = getState().collections.collections.find((c) => c.uid === collectionUid);
  if (!collection) {
    throw new Error('Collection not found');
  }
  return collection.pathname;
};

/**
 * Shared envelope for every git IPC call: flips the per-collection loading flag, resolves the
 * collection path (the main process derives the git root itself) and funnels failures into
 * `setError` + a toast. Rethrows so callers can react; the error is only reported once because
 * follow-up refreshes are dispatched outside the wrapper.
 */
const runGitOperation = (collectionUid, fallbackMessage, operation) => async (dispatch, getState) => {
  dispatch(setLoading({ collectionUid, loading: true }));
  try {
    const collectionPath = resolveCollectionPath(getState, collectionUid);
    const result = await operation(collectionPath, dispatch, getState);
    dispatch(setError({ collectionUid, error: null }));
    return result;
  } catch (error) {
    const message = error?.message || fallbackMessage;
    dispatch(setError({ collectionUid, error: message }));
    toast.error(message);
    throw error;
  } finally {
    dispatch(setLoading({ collectionUid, loading: false }));
  }
};

export const fetchGitStatus = (collectionUid) =>
  runGitOperation(collectionUid, 'Failed to read git status', async (collectionPath, dispatch) => {
    const status = await ipcRenderer.invoke('renderer:git:status', collectionPath);
    dispatch(setStatus({ collectionUid, status }));
    return status;
  });

export const fetchGitLog = (collectionUid) =>
  runGitOperation(collectionUid, 'Failed to read git log', async (collectionPath, dispatch) => {
    const log = await ipcRenderer.invoke('renderer:git:log', collectionPath);
    dispatch(setLog({ collectionUid, log }));
    return log;
  });

export const fetchCommitFiles = (collectionUid, commitHash) =>
  runGitOperation(collectionUid, 'Failed to read commit files', async (collectionPath, dispatch) => {
    const files = await ipcRenderer.invoke('renderer:git:commit-files', collectionPath, { commitHash });
    dispatch(setCommitFiles({ collectionUid, commitHash, files }));
    return files;
  });

export const loadDiff = (collectionUid, { kind, filePath, commitHash = null }) =>
  runGitOperation(collectionUid, 'Failed to load diff', async (collectionPath, dispatch) => {
    const diff = await ipcRenderer.invoke('renderer:git:diff', collectionPath, { kind, filePath, commitHash });
    dispatch(
      setSelectedDiff({
        collectionUid,
        diff: { kind, filePath, commitHash, raw: diff?.raw ?? '', visual: diff?.visual ?? null }
      })
    );
    return diff;
  });

export const clearDiff = (collectionUid) => (dispatch) => {
  dispatch(clearSelectedDiff({ collectionUid }));
};

// `renderer:git:init` already returns the fresh status, so no extra status round-trip is needed.
export const initGitRepo = (collectionUid) =>
  runGitOperation(collectionUid, 'Failed to initialize git repository', async (collectionPath, dispatch) => {
    const status = await ipcRenderer.invoke('renderer:git:init', collectionPath);
    dispatch(setStatus({ collectionUid, status }));
    return status;
  });

/**
 * Mutations resolve `undefined` in the main process — the renderer re-reads status (and the log
 * where history changed) afterwards. Refreshes run outside `runGitOperation` so a failing refresh
 * reports itself instead of being re-reported by the mutation.
 */
const gitMutation
  = (collectionUid, { channel, payload = {}, fallbackMessage, refreshLog = false }) =>
    async (dispatch) => {
      await dispatch(
        runGitOperation(collectionUid, fallbackMessage, (collectionPath) =>
          ipcRenderer.invoke(channel, collectionPath, payload)
        )
      );
      await dispatch(fetchGitStatus(collectionUid));
      if (refreshLog) {
        await dispatch(fetchGitLog(collectionUid));
      }
    };

/**
 * push/pull/checkout stream progress through `main:update-git-operation-progress`, keyed by a
 * renderer-generated processUid the panel reads from `state.app.gitOperationProgress[processUid]`.
 */
const gitProgressMutation
  = (collectionUid, { channel, payload = {}, fallbackMessage, refreshLog = false }) =>
    async (dispatch) => {
      const processUid = uuid();
      dispatch(setProcessUid({ collectionUid, processUid }));
      try {
        await dispatch(
          gitMutation(collectionUid, { channel, payload: { ...payload, processUid }, fallbackMessage, refreshLog })
        );
      } finally {
        dispatch(setProcessUid({ collectionUid, processUid: null }));
        dispatch(removeGitOperationProgress(processUid));
      }
    };

export const stageFiles = (collectionUid, files) =>
  gitMutation(collectionUid, {
    channel: 'renderer:git:stage',
    payload: { files },
    fallbackMessage: 'Failed to stage files'
  });

export const unstageFiles = (collectionUid, files) =>
  gitMutation(collectionUid, {
    channel: 'renderer:git:unstage',
    payload: { files },
    fallbackMessage: 'Failed to unstage files'
  });

export const discardFiles = (collectionUid, files) =>
  gitMutation(collectionUid, {
    channel: 'renderer:git:discard',
    payload: { files },
    fallbackMessage: 'Failed to discard changes'
  });

export const commitChanges = (collectionUid, message) =>
  gitMutation(collectionUid, {
    channel: 'renderer:git:commit',
    payload: { message },
    fallbackMessage: 'Failed to commit changes',
    refreshLog: true
  });

export const fetchRemote = (collectionUid) =>
  gitMutation(collectionUid, {
    channel: 'renderer:git:fetch',
    fallbackMessage: 'Failed to fetch from remote'
  });

export const pushChanges = (collectionUid) =>
  gitProgressMutation(collectionUid, {
    channel: 'renderer:git:push',
    fallbackMessage: 'Failed to push changes'
  });

export const pullChanges = (collectionUid, strategy = '--ff-only') =>
  gitProgressMutation(collectionUid, {
    channel: 'renderer:git:pull',
    payload: { strategy },
    fallbackMessage: 'Failed to pull changes',
    refreshLog: true
  });

export const checkoutBranch = (collectionUid, branchName, shouldCreate = false) =>
  gitProgressMutation(collectionUid, {
    channel: 'renderer:git:checkout-branch',
    payload: { branchName, shouldCreate },
    fallbackMessage: 'Failed to checkout branch',
    refreshLog: true
  });
