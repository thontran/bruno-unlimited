import React from 'react';
import { useDispatch } from 'react-redux';
import { IconX } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import VisualDiffContent from 'components/Git/VisualDiffViewer/VisualDiffContent';
import { clearDiff } from 'providers/ReduxStore/slices/git/actions';
import { gitDiffSections, gitSectionHasChanges } from './diffSections';
import RawDiffView from './RawDiffView';
import StyledWrapper from './StyledWrapper';

// What the two sides of the diff actually are, per diff kind.
const SIDE_LABELS = {
  staged: { old: 'HEAD', new: 'Staged' },
  unstaged: { old: 'Staged', new: 'Working tree' },
  commit: { old: 'Parent commit', new: 'This commit' }
};

/**
 * Diff for the file selected in the changes list or in a commit. `.bru`/`.yml` requests come back
 * with a parsed pair and render as a visual request diff; everything else falls back to the raw
 * unified patch.
 */
const DiffPane = ({ collectionUid, selectedDiff }) => {
  const dispatch = useDispatch();
  const { kind, filePath, commitHash, raw, visual } = selectedDiff;

  const labels = SIDE_LABELS[kind] || SIDE_LABELS.unstaged;
  const hasVisualDiff = Boolean(visual && (visual.before.parsed || visual.after.parsed));

  return (
    <StyledWrapper className="flex flex-col h-full overflow-hidden" data-testid="git-diff-pane">
      <div className="diff-header">
        <span className="diff-file-path" title={filePath}>{filePath}</span>
        <span className="diff-kind" data-testid="git-diff-kind">
          {kind === 'commit' && commitHash ? `commit ${commitHash.slice(0, 7)}` : kind}
        </span>
        <ActionIcon
          size="sm"
          label="Close diff"
          onClick={() => dispatch(clearDiff(collectionUid))}
          data-testid="git-diff-close"
        >
          <IconX size={14} strokeWidth={1.5} aria-hidden="true" />
        </ActionIcon>
      </div>

      <div className="diff-body">
        {hasVisualDiff ? (
          <VisualDiffContent
            oldData={visual.before.parsed}
            newData={visual.after.parsed}
            sections={gitDiffSections}
            sectionHasChanges={gitSectionHasChanges}
            oldLabel={labels.old}
            newLabel={labels.new}
          />
        ) : (
          <RawDiffView raw={raw} />
        )}
      </div>
    </StyledWrapper>
  );
};

export default DiffPane;
