import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconAlertTriangle, IconMinus, IconPlus, IconTrash } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import Modal from 'components/Modal';
import { discardFiles, loadDiff, stageFiles, unstageFiles } from 'providers/ReduxStore/slices/git/actions';
import StyledWrapper from './StyledWrapper';

// git porcelain codes, mapped to the class that colours the letter.
const STATUS_CLASS = {
  'A': 'added',
  '?': 'added',
  'D': 'deleted',
  'M': 'modified',
  'R': 'modified',
  'U': 'conflicted'
};

const statusLetter = (file) => {
  if (file.type === 'renamed') {
    return 'R';
  }
  const code = file.type === 'staged' ? file.fileIndex : file.working_dir || file.fileIndex;
  return code === '?' ? 'U' : (code || '').trim() || 'M';
};

const changeLabel = (file) => (file.type === 'renamed' ? `${file.from} → ${file.to}` : file.path);

const ChangeRow = ({ file, kind, testId, isSelected, onSelect, actions }) => {
  const letter = statusLetter(file);

  return (
    <div
      className={`change-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(file, kind)}
      data-testid={testId}
      data-path={file.path}
      title={changeLabel(file)}
    >
      <span className={`change-status ${STATUS_CLASS[letter] || ''}`}>{letter}</span>
      <span className="change-path">{changeLabel(file)}</span>
      {actions ? <span className="change-actions">{actions}</span> : null}
    </div>
  );
};

/**
 * Staged / unstaged / conflicted working-tree changes. Every mutation goes through the git slice
 * thunks, which refresh `status` themselves, so this component keeps no copy of the file lists.
 */
const ChangesList = ({ collectionUid, changes, selectedDiff, loading }) => {
  const dispatch = useDispatch();
  const [discardTarget, setDiscardTarget] = useState(null);

  const { staged, unstaged, conflicted, totalFiles, tooManyFiles } = changes;

  const runGitAction = (action) => {
    dispatch(action).catch(() => {});
  };

  const handleSelect = (file, kind) => {
    runGitAction(loadDiff(collectionUid, { kind, filePath: file.path }));
  };

  const isSelected = (file, kind) => Boolean(
    selectedDiff && selectedDiff.kind === kind && selectedDiff.filePath === file.path
  );

  const stopAndRun = (event, action) => {
    event.stopPropagation();
    runGitAction(action);
  };

  if (tooManyFiles) {
    return (
      <StyledWrapper data-testid="git-changes-list">
        <div className="too-many-files" data-testid="git-too-many-files">
          <IconAlertTriangle size={15} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {totalFiles} changed files detected. The list is not rendered for repositories this large — commit or
            discard from the command line, then refresh.
          </span>
        </div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper data-testid="git-changes-list">
      <div className="group-header">
        <span>Staged</span>
        <span className="group-count">{staged.length}</span>
        <span className="ml-auto">
          <Button
            size="xs"
            variant="outline"
            disabled={loading || !staged.length}
            onClick={() => runGitAction(unstageFiles(collectionUid, staged.map((file) => file.path)))}
            data-testid="git-unstage-all"
          >
            Unstage all
          </Button>
        </span>
      </div>
      {staged.length ? (
        staged.map((file) => (
          <ChangeRow
            key={`staged-${file.path}`}
            file={file}
            kind="staged"
            testId="git-changes-staged-row"
            isSelected={isSelected(file, 'staged')}
            onSelect={handleSelect}
            actions={(
              <ActionIcon
                size="sm"
                label="Unstage file"
                disabled={loading}
                onClick={(event) => stopAndRun(event, unstageFiles(collectionUid, [file.path]))}
                data-testid="git-unstage-file"
              >
                <IconMinus size={14} strokeWidth={1.5} aria-hidden="true" />
              </ActionIcon>
            )}
          />
        ))
      ) : (
        <div className="empty-group">Nothing staged</div>
      )}

      <div className="group-header mt-3">
        <span>Unstaged</span>
        <span className="group-count">{unstaged.length}</span>
        <span className="ml-auto">
          <Button
            size="xs"
            variant="outline"
            disabled={loading || !unstaged.length}
            onClick={() => runGitAction(stageFiles(collectionUid, unstaged.map((file) => file.path)))}
            data-testid="git-stage-all"
          >
            Stage all
          </Button>
        </span>
      </div>
      {unstaged.length ? (
        unstaged.map((file) => (
          <ChangeRow
            key={`unstaged-${file.path}`}
            file={file}
            kind="unstaged"
            testId="git-changes-unstaged-row"
            isSelected={isSelected(file, 'unstaged')}
            onSelect={handleSelect}
            actions={(
              <>
                <ActionIcon
                  size="sm"
                  label="Stage file"
                  disabled={loading}
                  onClick={(event) => stopAndRun(event, stageFiles(collectionUid, [file.path]))}
                  data-testid="git-stage-file"
                >
                  <IconPlus size={14} strokeWidth={1.5} aria-hidden="true" />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  label="Discard changes"
                  colorOnHover="red"
                  disabled={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDiscardTarget(file.path);
                  }}
                  data-testid="git-discard-file"
                >
                  <IconTrash size={14} strokeWidth={1.5} aria-hidden="true" />
                </ActionIcon>
              </>
            )}
          />
        ))
      ) : (
        <div className="empty-group">No local changes</div>
      )}

      {conflicted.length > 0 && (
        <>
          <div className="group-header mt-3">
            <span>Conflicted</span>
            <span className="group-count">{conflicted.length}</span>
          </div>
          {conflicted.map((file) => (
            <ChangeRow
              key={`conflicted-${file.path}`}
              file={file}
              kind="unstaged"
              testId="git-changes-conflicted-row"
              isSelected={isSelected(file, 'unstaged')}
              onSelect={handleSelect}
            />
          ))}
        </>
      )}

      {discardTarget && (
        <Modal
          size="sm"
          title="Discard changes"
          confirmText="Discard"
          confirmButtonColor="danger"
          handleConfirm={() => {
            runGitAction(discardFiles(collectionUid, [discardTarget]));
            setDiscardTarget(null);
          }}
          handleCancel={() => setDiscardTarget(null)}
          dataTestId="git-discard-modal"
        >
          Discard all local changes in <strong>{discardTarget}</strong>? This cannot be undone.
        </Modal>
      )}
    </StyledWrapper>
  );
};

export default ChangesList;
