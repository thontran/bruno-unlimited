import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';
import GitPanel from './index';

// Every thunk is replaced with a thunk that resolves, so the panel can be driven without IPC.
// What the panel renders comes from the preloaded slice state instead of from these results.
const gitActionCalls = [];
const statusResult = { current: null };

const recordThunk = (name, args) => {
  gitActionCalls.push({ name, args });
  return () => Promise.resolve(name === 'fetchGitStatus' ? statusResult.current : undefined);
};

jest.mock('providers/ReduxStore/slices/git/actions', () => {
  const thunkNames = [
    'fetchGitStatus', 'fetchGitLog', 'fetchCommitFiles', 'loadDiff', 'clearDiff', 'initGitRepo', 'stageFiles',
    'unstageFiles', 'discardFiles', 'commitChanges', 'fetchRemote', 'pushChanges', 'pullChanges', 'checkoutBranch'
  ];

  return thunkNames.reduce((mocked, name) => {
    mocked[name] = (...args) => recordThunk(name, args);
    return mocked;
  }, {});
});

const callsFor = (name) => gitActionCalls.filter((call) => call.name === name);

const COLLECTION = { uid: 'collection-1', name: 'My Collection', pathname: '/tmp/my-collection' };

const REPO_STATUS = {
  isRepo: true,
  gitRootPath: '/tmp/my-collection',
  currentBranch: 'main',
  defaultBranch: 'main',
  branches: ['main', 'feature/login'],
  remoteUrl: 'git@github.com:acme/collection.git',
  ahead: 2,
  behind: 1,
  changes: {
    staged: [{ path: 'echo.bru', type: 'staged', fileIndex: 'M', working_dir: ' ' }],
    unstaged: [
      { path: 'login.bru', type: 'unstaged', fileIndex: ' ', working_dir: 'M' },
      { path: 'new.bru', type: 'unstaged', fileIndex: '?', working_dir: '?' }
    ],
    conflicted: [{ path: 'conflict.bru', type: 'conflicted', fileIndex: 'U', working_dir: 'U' }],
    totalFiles: 4,
    tooManyFiles: false
  }
};

const LOG = [
  {
    hash: 'a1b2c3d4e5f6a7b8c9d0',
    message: 'Add login request',
    author_name: 'Ada',
    date: new Date().toISOString(),
    filesChanged: 1,
    insertions: 5,
    deletions: 0
  }
];

const gitState = (overrides = {}) => ({
  status: null,
  log: [],
  commitFiles: {},
  selectedDiff: null,
  loading: false,
  error: null,
  processUid: null,
  ...overrides
});

const renderPanel = ({ gitVersion = '2.43.0', collectionGit = {}, gitOperationProgress = {} } = {}) => {
  const store = configureStore({
    reducer: {
      app: (state = { gitVersion, gitOperationProgress }) => state,
      collections: (state = { collections: [COLLECTION] }) => state,
      git: (state = { byCollection: { [COLLECTION.uid]: gitState(collectionGit) } }) => state
    }
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={themes.dark}>
        <GitPanel collection={COLLECTION} />
      </ThemeProvider>
    </Provider>
  );
};

describe('GitPanel', () => {
  beforeEach(() => {
    gitActionCalls.length = 0;
    statusResult.current = REPO_STATUS;
  });

  it('renders the git-not-found state and never touches git when git is missing', () => {
    renderPanel({ gitVersion: null });

    expect(screen.getByTestId('git-not-found')).toBeInTheDocument();
    expect(callsFor('fetchGitStatus')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('git-not-found-help-btn'));
    expect(screen.getByText('Git Not Found')).toBeInTheDocument();
  });

  it('offers repository initialization when the collection is not a repo', () => {
    statusResult.current = { isRepo: false };
    renderPanel({ collectionGit: { status: { isRepo: false } } });

    expect(screen.getByTestId('git-not-a-repo')).toBeInTheDocument();
    expect(callsFor('fetchGitLog')).toHaveLength(0);

    fireEvent.click(screen.getByTestId('git-init-btn'));
    expect(callsFor('initGitRepo')[0].args).toEqual([COLLECTION.uid]);
  });

  it('renders the full repository state and loads status plus log on mount', async () => {
    renderPanel({ collectionGit: { status: REPO_STATUS, log: LOG } });

    await waitFor(() => expect(callsFor('fetchGitLog')).toHaveLength(1));
    expect(callsFor('fetchGitStatus')[0].args).toEqual([COLLECTION.uid]);

    expect(screen.getByTestId('git-branch-trigger')).toHaveTextContent('main');
    expect(screen.getByTestId('git-remote-url')).toHaveTextContent('git@github.com:acme/collection.git');
    expect(screen.getByTestId('git-ahead-badge')).toHaveTextContent('2');
    expect(screen.getByTestId('git-behind-badge')).toHaveTextContent('1');
    ['git-fetch-btn', 'git-pull-btn', 'git-push-btn', 'git-stage-all', 'git-unstage-all', 'git-commit-message',
      'git-commit-btn', 'git-history-row'].forEach((testId) => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('git-changes-unstaged-row')).toHaveLength(2);
    expect(screen.getAllByTestId('git-changes-staged-row')).toHaveLength(1);
    expect(screen.getAllByTestId('git-changes-conflicted-row')).toHaveLength(1);
    expect(screen.queryByTestId('git-diff-pane')).not.toBeInTheDocument();
  });

  it('keeps commit disabled until a message and staged files both exist', () => {
    const { unmount } = renderPanel({
      collectionGit: {
        status: { ...REPO_STATUS, changes: { ...REPO_STATUS.changes, staged: [] } }
      }
    });

    fireEvent.change(screen.getByTestId('git-commit-message'), { target: { value: 'no staged files' } });
    expect(screen.getByTestId('git-commit-btn')).toBeDisabled();
    unmount();

    renderPanel({ collectionGit: { status: REPO_STATUS } });
    const commitButton = screen.getByTestId('git-commit-btn');
    expect(commitButton).toBeDisabled();

    fireEvent.change(screen.getByTestId('git-commit-message'), { target: { value: '   ' } });
    expect(commitButton).toBeDisabled();

    fireEvent.change(screen.getByTestId('git-commit-message'), { target: { value: 'Add login request' } });
    expect(commitButton).toBeEnabled();
  });

  it('commits the trimmed message and clears the box', async () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.change(screen.getByTestId('git-commit-message'), { target: { value: '  Add login request  ' } });
    fireEvent.click(screen.getByTestId('git-commit-btn'));

    expect(callsFor('commitChanges')[0].args).toEqual([COLLECTION.uid, 'Add login request']);
    await waitFor(() => expect(screen.getByTestId('git-commit-message')).toHaveValue(''));
  });

  it('stages, unstages and confirms discard from the changes list', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.click(screen.getAllByTestId('git-stage-file')[0]);
    expect(callsFor('stageFiles')[0].args).toEqual([COLLECTION.uid, ['login.bru']]);

    fireEvent.click(screen.getByTestId('git-unstage-file'));
    expect(callsFor('unstageFiles')[0].args).toEqual([COLLECTION.uid, ['echo.bru']]);

    fireEvent.click(screen.getByTestId('git-stage-all'));
    expect(callsFor('stageFiles')[1].args).toEqual([COLLECTION.uid, ['login.bru', 'new.bru']]);

    fireEvent.click(screen.getAllByTestId('git-discard-file')[0]);
    expect(callsFor('discardFiles')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('git-discard-modal-submit-btn'));
    expect(callsFor('discardFiles')[0].args).toEqual([COLLECTION.uid, ['login.bru']]);
  });

  it('loads the diff for a clicked change row', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.click(screen.getAllByTestId('git-changes-unstaged-row')[0]);
    expect(callsFor('loadDiff')[0].args).toEqual([COLLECTION.uid, { kind: 'unstaged', filePath: 'login.bru' }]);
  });

  it('replaces the file list with a notice when the repository has too many changes', () => {
    renderPanel({
      collectionGit: {
        status: {
          ...REPO_STATUS,
          changes: { staged: [], unstaged: [], conflicted: [], totalFiles: 7000, tooManyFiles: true }
        }
      }
    });

    expect(screen.getByTestId('git-too-many-files')).toHaveTextContent('7000 changed files detected');
    expect(screen.queryByTestId('git-changes-unstaged-row')).not.toBeInTheDocument();
  });

  it('creates a branch from the inline input', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.click(screen.getByTestId('git-new-branch-btn'));
    const input = screen.getByTestId('git-new-branch-input');
    fireEvent.change(input, { target: { value: 'feature/git-panel' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(callsFor('checkoutBranch')[0].args).toEqual([COLLECTION.uid, 'feature/git-panel', true]);
    expect(screen.queryByTestId('git-new-branch-input')).not.toBeInTheDocument();
  });

  it('wires the fetch, pull and push buttons to their thunks', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.click(screen.getByTestId('git-fetch-btn'));
    fireEvent.click(screen.getByTestId('git-pull-btn'));
    fireEvent.click(screen.getByTestId('git-push-btn'));

    expect(callsFor('fetchRemote')[0].args).toEqual([COLLECTION.uid]);
    expect(callsFor('pullChanges')[0].args).toEqual([COLLECTION.uid]);
    expect(callsFor('pushChanges')[0].args).toEqual([COLLECTION.uid]);
  });

  it('fetches the file list of a commit that is not cached yet', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS, log: LOG } });

    fireEvent.click(screen.getByTestId('git-history-row'));

    expect(callsFor('fetchCommitFiles')[0].args).toEqual([COLLECTION.uid, LOG[0].hash]);
    expect(screen.getByTestId('git-history-files-empty')).toBeInTheDocument();
  });

  it('switches branches from the dropdown', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS } });

    fireEvent.click(screen.getByTestId('git-branch-trigger'));
    const options = screen.getAllByTestId('git-branch-option');
    expect(options.map((option) => option.dataset.branch)).toEqual(['main', 'feature/login']);

    fireEvent.click(options[1]);
    expect(callsFor('checkoutBranch')[0].args).toEqual([COLLECTION.uid, 'feature/login']);
  });

  it('expands a commit and loads a commit file diff', () => {
    renderPanel({
      collectionGit: {
        status: REPO_STATUS,
        log: LOG,
        commitFiles: { [LOG[0].hash]: [{ path: 'login.bru', status: 'modified' }] }
      }
    });

    fireEvent.click(screen.getByTestId('git-history-row'));
    expect(callsFor('fetchCommitFiles')).toHaveLength(0); // already cached in the slice

    fireEvent.click(screen.getByTestId('git-history-file-row'));
    expect(callsFor('loadDiff')[0].args).toEqual([
      COLLECTION.uid,
      { kind: 'commit', filePath: 'login.bru', commitHash: LOG[0].hash }
    ]);
  });

  it('shows the raw patch and closes the diff pane', () => {
    renderPanel({
      collectionGit: {
        status: REPO_STATUS,
        selectedDiff: {
          kind: 'unstaged',
          filePath: 'notes.txt',
          commitHash: null,
          raw: '@@ -1 +1 @@\n-old\n+new\n',
          visual: null
        }
      }
    });

    const pane = screen.getByTestId('git-diff-pane');
    expect(pane).toHaveTextContent('notes.txt');
    expect(screen.getByTestId('git-diff-raw-text')).toHaveTextContent('-old');

    fireEvent.click(screen.getByTestId('git-diff-close'));
    expect(callsFor('clearDiff')[0].args).toEqual([COLLECTION.uid]);
  });

  it('renders the visual request diff for a parsed .bru file', () => {
    const parsed = (url) => ({
      request: {
        method: 'POST',
        url,
        headers: [],
        params: [],
        auth: { mode: 'none' },
        body: { mode: 'none' }
      }
    });

    renderPanel({
      collectionGit: {
        status: REPO_STATUS,
        selectedDiff: {
          kind: 'staged',
          filePath: 'login.bru',
          commitHash: null,
          raw: '@@ -1 +1 @@\n-old\n+new\n',
          visual: {
            before: { content: 'before', parsed: parsed('https://api.old/login') },
            after: { content: 'after', parsed: parsed('https://api.new/login') }
          }
        }
      }
    });

    expect(screen.getByTestId('git-diff-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('git-diff-raw-text')).not.toBeInTheDocument();
    expect(screen.getByText('HEAD')).toBeInTheDocument();
    // The URL section renders as word-diff segments, so assert against the pane's text as a whole.
    expect(screen.getByTestId('git-diff-pane')).toHaveTextContent('https://api.new/login');
  });

  it('renders streamed progress output for the running operation', () => {
    renderPanel({
      collectionGit: { status: REPO_STATUS, processUid: 'process-1', loading: true },
      gitOperationProgress: { 'process-1': { progressData: ['Enumerating objects: 12', ', done.'] } }
    });

    expect(screen.getByTestId('git-progress-log')).toHaveTextContent('Enumerating objects: 12, done.');
    expect(screen.getByTestId('git-push-btn')).toBeDisabled();
    expect(screen.getByTestId('git-busy')).toBeInTheDocument();
  });

  it('surfaces slice errors', () => {
    renderPanel({ collectionGit: { status: REPO_STATUS, error: 'fatal: not a valid ref' } });

    expect(screen.getByTestId('git-error')).toHaveTextContent('fatal: not a valid ref');
  });
});
