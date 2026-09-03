import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconAlertCircle, IconGitBranch, IconRefresh } from '@tabler/icons';
import Button from 'ui/Button';
import GitNotFoundModal from 'components/Git/GitNotFoundModal';
import { initGitRepo } from 'providers/ReduxStore/slices/git/actions';
import useGitPanel from './useGitPanel';
import BranchBar from './BranchBar';
import ChangesList from './ChangesList';
import CommitForm from './CommitForm';
import HistoryList from './HistoryList';
import DiffPane from './DiffPane';
import StyledWrapper from './StyledWrapper';

const PanelShell = ({ children }) => (
  <StyledWrapper className="flex flex-col h-full px-4 py-4 overflow-hidden" data-testid="git-panel">
    {children}
  </StyledWrapper>
);

/**
 * Git tab for a collection: branch/remote controls, working-tree changes, commit box, history and
 * the diff of whichever file is selected. All data comes from the `git` slice — see `useGitPanel`
 * for the one mount fetch.
 */
const GitPanel = ({ collection }) => {
  const dispatch = useDispatch();
  const collectionUid = collection.uid;
  const [showGitNotFoundModal, setShowGitNotFoundModal] = useState(false);
  const { status, log, commitFiles, selectedDiff, loading, error, processUid, gitVersion } = useGitPanel(collectionUid);

  if (!gitVersion) {
    return (
      <PanelShell>
        <div className="empty-state" data-testid="git-not-found">
          <IconAlertCircle size={24} strokeWidth={1.5} aria-hidden="true" />
          <div className="empty-state-title">Git not found</div>
          <div className="empty-state-text">
            Git was not detected on your system. Install Git to use version control for this collection.
          </div>
          <Button size="sm" onClick={() => setShowGitNotFoundModal(true)} data-testid="git-not-found-help-btn">
            How to install Git
          </Button>
        </div>
        {showGitNotFoundModal && <GitNotFoundModal onClose={() => setShowGitNotFoundModal(false)} />}
      </PanelShell>
    );
  }

  if (!status) {
    return (
      <PanelShell>
        <div className="empty-state" data-testid="git-loading">
          <IconRefresh className="animate-spin" size={20} strokeWidth={1.5} aria-hidden="true" />
          <div className="empty-state-text">Reading repository…</div>
        </div>
      </PanelShell>
    );
  }

  if (!status.isRepo) {
    return (
      <PanelShell>
        <div className="empty-state" data-testid="git-not-a-repo">
          <IconGitBranch size={24} strokeWidth={1.5} aria-hidden="true" />
          <div className="empty-state-title">Not a git repository</div>
          <div className="empty-state-text">
            {collection.name} is not inside a git repository. Initialize one to track changes, commit and push from
            Bruno.
          </div>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => dispatch(initGitRepo(collectionUid)).catch(() => {})}
            data-testid="git-init-btn"
          >
            Initialize repository
          </Button>
          {error && <div className="panel-error" data-testid="git-error">{error}</div>}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="mb-3">
        <div className="panel-title">Git</div>
        <div className="panel-subtitle" data-testid="git-root-path">{status.gitRootPath}</div>
      </div>

      <BranchBar collectionUid={collectionUid} status={status} loading={loading} processUid={processUid} />

      {error && <div className="panel-error mt-3" data-testid="git-error">{error}</div>}

      <div className="flex flex-1 min-h-0 gap-4 mt-3 overflow-hidden">
        <div className={`flex flex-col gap-4 min-w-0 overflow-auto ${selectedDiff ? 'w-1/2' : 'w-full'}`}>
          <section className="flex flex-col gap-2">
            <div className="section-title">Changes</div>
            <ChangesList
              collectionUid={collectionUid}
              changes={status.changes}
              selectedDiff={selectedDiff}
              loading={loading}
            />
            <CommitForm
              collectionUid={collectionUid}
              stagedCount={status.changes.staged.length}
              loading={loading}
            />
          </section>

          <section className="flex flex-col gap-2">
            <div className="section-title">History</div>
            <HistoryList
              collectionUid={collectionUid}
              log={log}
              commitFiles={commitFiles}
              selectedDiff={selectedDiff}
            />
          </section>
        </div>

        {selectedDiff && (
          <div className="w-1/2 min-w-0">
            <DiffPane collectionUid={collectionUid} selectedDiff={selectedDiff} />
          </div>
        )}
      </div>
    </PanelShell>
  );
};

export default GitPanel;
