import { createSlice } from '@reduxjs/toolkit';

// Per-collection git state for the Git panel. Keyed by collectionUid so several collections
// can hold independent status/log/diff state at once. Nothing here is persisted in the
// snapshot — it is rebuilt from `renderer:git:*` on demand.
const initialState = {
  byCollection: {}
};

const initialCollectionState = () => ({
  status: null,
  log: [],
  commitFiles: {},
  selectedDiff: null,
  loading: false,
  error: null,
  processUid: null
});

// Every reducer must be safe on a collection the panel has never touched before.
const collectionGit = (state, collectionUid) => {
  if (!state.byCollection[collectionUid]) {
    state.byCollection[collectionUid] = initialCollectionState();
  }
  return state.byCollection[collectionUid];
};

export const gitSlice = createSlice({
  name: 'git',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      const { collectionUid, loading } = action.payload;
      collectionGit(state, collectionUid).loading = Boolean(loading);
    },
    setStatus: (state, action) => {
      const { collectionUid, status } = action.payload;
      collectionGit(state, collectionUid).status = status ?? null;
    },
    setLog: (state, action) => {
      const { collectionUid, log } = action.payload;
      collectionGit(state, collectionUid).log = log || [];
    },
    setCommitFiles: (state, action) => {
      const { collectionUid, commitHash, files } = action.payload;
      collectionGit(state, collectionUid).commitFiles[commitHash] = files || [];
    },
    setSelectedDiff: (state, action) => {
      const { collectionUid, diff } = action.payload;
      collectionGit(state, collectionUid).selectedDiff = diff ?? null;
    },
    clearDiff: (state, action) => {
      const { collectionUid } = action.payload;
      collectionGit(state, collectionUid).selectedDiff = null;
    },
    setError: (state, action) => {
      const { collectionUid, error } = action.payload;
      collectionGit(state, collectionUid).error = error ?? null;
    },
    setProcessUid: (state, action) => {
      const { collectionUid, processUid } = action.payload;
      collectionGit(state, collectionUid).processUid = processUid ?? null;
    },
    // Dispatched when a collection is closed. Accepts the uid directly — `resetCollectionGit(uid)` —
    // or the `{ collectionUid }` payload shape the other reducers use.
    resetCollectionGit: (state, action) => {
      const collectionUid = typeof action.payload === 'string' ? action.payload : action.payload?.collectionUid;
      delete state.byCollection[collectionUid];
    }
  }
});

export const {
  setLoading,
  setStatus,
  setLog,
  setCommitFiles,
  setSelectedDiff,
  clearDiff,
  setError,
  setProcessUid,
  resetCollectionGit
} = gitSlice.actions;

export default gitSlice.reducer;
