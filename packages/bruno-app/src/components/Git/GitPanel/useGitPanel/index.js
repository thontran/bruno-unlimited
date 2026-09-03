import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGitStatus, fetchGitLog } from 'providers/ReduxStore/slices/git/actions';

// The git slice only holds state for collections the panel has already visited, so every
// consumer needs the same "nothing loaded yet" shape to read from.
const EMPTY_COLLECTION_GIT = {
  status: null,
  log: [],
  commitFiles: {},
  selectedDiff: null,
  loading: false,
  error: null,
  processUid: null
};

/**
 * Owns the single mount effect of the git tab: read status, then the log when the collection
 * really is a repository (`renderer:git:log` throws outside a repo). Thunk rejections are
 * swallowed here because `runGitOperation` already stored the message on the slice and toasted
 * it — rethrowing would only produce an unhandled rejection.
 *
 * @param {string} collectionUid
 * @returns {{ status, log, commitFiles, selectedDiff, loading, error, processUid, gitVersion }}
 */
const useGitPanel = (collectionUid) => {
  const dispatch = useDispatch();
  const collectionGit = useSelector((state) => state.git.byCollection[collectionUid]) || EMPTY_COLLECTION_GIT;
  const gitVersion = useSelector((state) => state.app.gitVersion);

  useEffect(() => {
    if (!gitVersion) {
      return;
    }

    let active = true;
    dispatch(fetchGitStatus(collectionUid))
      .then((status) => {
        if (active && status && status.isRepo) {
          return dispatch(fetchGitLog(collectionUid));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [dispatch, collectionUid, gitVersion]);

  return { ...collectionGit, gitVersion };
};

export default useGitPanel;
