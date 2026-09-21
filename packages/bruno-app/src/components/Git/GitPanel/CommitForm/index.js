import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconGitCommit } from '@tabler/icons';
import Button from 'ui/Button';
import { commitChanges } from 'providers/ReduxStore/slices/git/actions';
import StyledWrapper from './StyledWrapper';

/**
 * Commit box for whatever is currently staged. The message is cleared only after the commit
 * resolves so a failed commit (hook rejection, missing identity) keeps the user's text.
 */
const CommitForm = ({ collectionUid, stagedCount, loading }) => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState('');

  const trimmedMessage = message.trim();
  const canCommit = stagedCount > 0 && trimmedMessage.length > 0 && !loading;

  const handleCommit = () => {
    if (!canCommit) {
      return;
    }

    dispatch(commitChanges(collectionUid, trimmedMessage))
      .then(() => setMessage(''))
      .catch(() => {});
  };

  return (
    <StyledWrapper className="flex flex-col gap-2" data-testid="git-commit-form">
      <textarea
        className="commit-message"
        placeholder="Commit message"
        aria-label="Commit message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        data-testid="git-commit-message"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          icon={<IconGitCommit size={14} strokeWidth={1.5} />}
          disabled={!canCommit}
          onClick={handleCommit}
          data-testid="git-commit-btn"
        >
          Commit
        </Button>
        <span className="commit-hint" data-testid="git-commit-hint">
          {stagedCount > 0 ? `${stagedCount} file${stagedCount > 1 ? 's' : ''} staged` : 'Stage files to commit'}
        </span>
      </div>
    </StyledWrapper>
  );
};

export default CommitForm;
