import React, { forwardRef, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  IconArrowDown,
  IconArrowUp,
  IconCaretDown,
  IconCheck,
  IconGitBranch,
  IconPlus,
  IconRefresh,
  IconX
} from '@tabler/icons';
import Dropdown from 'components/Dropdown';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import { checkoutBranch, fetchRemote, pullChanges, pushChanges } from 'providers/ReduxStore/slices/git/actions';
import StyledWrapper from './StyledWrapper';

// Tippy sets its reference ref on the trigger, so the trigger has to forward it to the DOM node.
const BranchTrigger = forwardRef(({ branch }, ref) => (
  <button ref={ref} type="button" className="branch-trigger" data-testid="git-branch-trigger">
    <IconGitBranch size={14} strokeWidth={1.5} aria-hidden="true" />
    <span>{branch || 'no branch'}</span>
    <IconCaretDown size={14} strokeWidth={1.5} aria-hidden="true" />
  </button>
));

/**
 * Branch switcher + remote sync controls. push/pull/checkout stream their output through
 * `state.app.gitOperationProgress[processUid]`, which is rendered below the bar while the
 * operation runs — the same progress payload `Sidebar/CloneGitRespository` consumes.
 */
const BranchBar = ({ collectionUid, status, loading, processUid }) => {
  const dispatch = useDispatch();
  const dropdownTippyRef = useRef();
  const [newBranchName, setNewBranchName] = useState(null);
  const progress = useSelector((state) => (processUid ? state.app.gitOperationProgress[processUid] : null));

  const { currentBranch, branches, remoteUrl, ahead, behind } = status;
  const isCreatingBranch = newBranchName !== null;
  const progressLines = progress ? progress.progressData : [];

  const hideDropdown = () => dropdownTippyRef.current?.hide();

  const runGitAction = (action) => {
    dispatch(action).catch(() => {});
  };

  const handleSwitchBranch = (branchName) => {
    hideDropdown();
    if (branchName === currentBranch) {
      return;
    }
    runGitAction(checkoutBranch(collectionUid, branchName));
  };

  const handleCreateBranch = () => {
    const branchName = newBranchName.trim();
    if (!branchName) {
      return;
    }
    setNewBranchName(null);
    runGitAction(checkoutBranch(collectionUid, branchName, true));
  };

  const handleNewBranchKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleCreateBranch();
    } else if (event.key === 'Escape') {
      setNewBranchName(null);
    }
  };

  return (
    <StyledWrapper className="flex flex-col gap-2 pb-3" data-testid="git-branch-bar">
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          onCreate={(ref) => (dropdownTippyRef.current = ref)}
          icon={<BranchTrigger branch={currentBranch} />}
          placement="bottom-start"
          noPadding
        >
          {branches.length ? (
            branches.map((branchName) => (
              <button
                key={branchName}
                type="button"
                className={`branch-option ${branchName === currentBranch ? 'current' : ''}`}
                onClick={() => handleSwitchBranch(branchName)}
                data-testid="git-branch-option"
                data-branch={branchName}
              >
                <span>{branchName}</span>
                {branchName === currentBranch && <IconCheck size={13} strokeWidth={1.5} aria-hidden="true" />}
              </button>
            ))
          ) : (
            <div className="branch-empty">No branches yet</div>
          )}
        </Dropdown>

        {isCreatingBranch ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              autoFocus
              className="new-branch-input"
              placeholder="new-branch-name"
              aria-label="New branch name"
              value={newBranchName}
              onChange={(event) => setNewBranchName(event.target.value)}
              onKeyDown={handleNewBranchKeyDown}
              data-testid="git-new-branch-input"
            />
            <ActionIcon
              label="Create branch"
              disabled={!newBranchName.trim() || loading}
              onClick={handleCreateBranch}
              data-testid="git-new-branch-create"
            >
              <IconCheck size={15} strokeWidth={1.5} aria-hidden="true" />
            </ActionIcon>
            <ActionIcon
              label="Cancel new branch"
              onClick={() => setNewBranchName(null)}
              data-testid="git-new-branch-cancel"
            >
              <IconX size={15} strokeWidth={1.5} aria-hidden="true" />
            </ActionIcon>
          </div>
        ) : (
          <ActionIcon label="New branch" onClick={() => setNewBranchName('')} data-testid="git-new-branch-btn">
            <IconPlus size={15} strokeWidth={1.5} aria-hidden="true" />
          </ActionIcon>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {ahead > 0 && (
            <span className="sync-badge ahead" data-testid="git-ahead-badge">
              <IconArrowUp size={12} strokeWidth={2} aria-hidden="true" />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="sync-badge behind" data-testid="git-behind-badge">
              <IconArrowDown size={12} strokeWidth={2} aria-hidden="true" />
              {behind}
            </span>
          )}
          {loading && (
            <IconRefresh
              className="animate-spin"
              size={15}
              strokeWidth={1.5}
              aria-hidden="true"
              data-testid="git-busy"
            />
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runGitAction(fetchRemote(collectionUid))}
            data-testid="git-fetch-btn"
          >
            Fetch
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runGitAction(pullChanges(collectionUid))}
            data-testid="git-pull-btn"
          >
            Pull
          </Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => runGitAction(pushChanges(collectionUid))}
            data-testid="git-push-btn"
          >
            Push
          </Button>
        </div>
      </div>

      <div className="remote-url" data-testid="git-remote-url">
        {remoteUrl || 'No remote configured'}
      </div>

      {progressLines.length > 0 && (
        <div className="progress-log" data-testid="git-progress-log">
          {progressLines.join('')}
        </div>
      )}
    </StyledWrapper>
  );
};

export default BranchBar;
