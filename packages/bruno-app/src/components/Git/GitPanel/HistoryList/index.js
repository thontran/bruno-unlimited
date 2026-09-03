import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconChevronDown, IconChevronRight } from '@tabler/icons';
import { relativeDate } from 'utils/common';
import { fetchCommitFiles, loadDiff } from 'providers/ReduxStore/slices/git/actions';
import StyledWrapper from './StyledWrapper';

const FILE_STATUS_CLASS = {
  added: 'added',
  deleted: 'deleted',
  modified: 'modified'
};

const FILE_STATUS_LETTER = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
  changed: 'C'
};

/**
 * Commit history for the collection's repository. Expanding a row pulls its file list once
 * (`fetchCommitFiles` caches per hash in the slice); clicking a file loads that commit's diff.
 */
const HistoryList = ({ collectionUid, log, commitFiles, selectedDiff }) => {
  const dispatch = useDispatch();
  const [expandedHash, setExpandedHash] = useState(null);

  const runGitAction = (action) => {
    dispatch(action).catch(() => {});
  };

  const handleToggleCommit = (commitHash) => {
    if (expandedHash === commitHash) {
      setExpandedHash(null);
      return;
    }

    setExpandedHash(commitHash);
    if (!commitFiles[commitHash]) {
      runGitAction(fetchCommitFiles(collectionUid, commitHash));
    }
  };

  const isSelectedFile = (commitHash, filePath) => Boolean(
    selectedDiff
    && selectedDiff.kind === 'commit'
    && selectedDiff.commitHash === commitHash
    && selectedDiff.filePath === filePath
  );

  if (!log.length) {
    return (
      <StyledWrapper data-testid="git-history-list">
        <div className="history-empty">No commits yet</div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper data-testid="git-history-list">
      {log.map((commit) => {
        const isExpanded = expandedHash === commit.hash;
        const files = commitFiles[commit.hash] || [];

        return (
          <div key={commit.hash}>
            <div
              className="history-row"
              onClick={() => handleToggleCommit(commit.hash)}
              data-testid="git-history-row"
              data-hash={commit.hash}
              title={commit.message}
            >
              {isExpanded ? (
                <IconChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <IconChevronRight size={13} strokeWidth={1.5} aria-hidden="true" />
              )}
              <span className="commit-hash">{commit.hash.slice(0, 7)}</span>
              <span className="commit-message">{commit.message}</span>
              <span className="commit-meta">{commit.author_name}</span>
              <span className="commit-meta">{relativeDate(commit.date)}</span>
            </div>

            {isExpanded && (
              files.length ? (
                files.map((file) => (
                  <div
                    key={`${commit.hash}-${file.path}`}
                    className={`commit-file-row ${isSelectedFile(commit.hash, file.path) ? 'selected' : ''}`}
                    onClick={() => runGitAction(
                      loadDiff(collectionUid, { kind: 'commit', filePath: file.path, commitHash: commit.hash })
                    )}
                    data-testid="git-history-file-row"
                    data-path={file.path}
                    title={file.path}
                  >
                    <span className={`file-status ${FILE_STATUS_CLASS[file.status] || ''}`}>
                      {FILE_STATUS_LETTER[file.status] || '?'}
                    </span>
                    <span className="file-path">{file.path}</span>
                  </div>
                ))
              ) : (
                <div className="history-empty" data-testid="git-history-files-empty">
                  No files in this commit
                </div>
              )
            )}
          </div>
        );
      })}
    </StyledWrapper>
  );
};

export default HistoryList;
