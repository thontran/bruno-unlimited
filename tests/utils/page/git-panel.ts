import { test, Page } from '../../../playwright';
import { buildSidebarLocators } from './sidebar';

export type GitDiffKind = 'staged' | 'unstaged';

/**
 * Git tab (`components/Git/GitPanel`) locators.
 *
 * The panel is a collection-scoped special tab opened from the sidebar collection "..." menu
 * (`collection-actions-git`) or the collection header overflow menu (`more-actions-git`). Every
 * row that represents a file carries its repo-relative path on `data-path`, which is how a single
 * change/history row is addressed here.
 */
export const buildGitPanelLocators = (page: Page) => {
  const changeRow = (kind: GitDiffKind, filePath: string) =>
    page.locator(`[data-testid="git-changes-${kind}-row"][data-path="${filePath}"]`);

  return {
    /** The whole panel shell — present in every state (loading, not-a-repo, ready) */
    panel: () => page.getByTestId('git-panel'),
    /** Spinner state while the first `renderer:git:status` is in flight */
    loading: () => page.getByTestId('git-loading'),
    /** Empty state shown when the collection is not inside a repository */
    notARepo: () => page.getByTestId('git-not-a-repo'),
    /** "Initialize repository" button of the not-a-repo empty state */
    initButton: () => page.getByTestId('git-init-btn'),
    /** Inline error banner rendered by the panel */
    error: () => page.getByTestId('git-error'),
    /** Absolute path of the repository root, rendered under the panel title */
    rootPath: () => page.getByTestId('git-root-path'),

    /** Branch + remote controls row */
    branchBar: () => page.getByTestId('git-branch-bar'),
    /** Branch dropdown trigger; its text is the current branch */
    branchTrigger: () => page.getByTestId('git-branch-trigger'),
    /** Every branch row in the opened branch dropdown */
    branchOptions: () => page.getByTestId('git-branch-option'),
    /** A single branch row in the opened branch dropdown */
    branchOption: (branchName: string) =>
      page.locator(`[data-testid="git-branch-option"][data-branch="${branchName}"]`),
    /** "+" button that reveals the new-branch input */
    newBranchButton: () => page.getByTestId('git-new-branch-btn'),
    newBranchInput: () => page.getByTestId('git-new-branch-input'),
    newBranchCreate: () => page.getByTestId('git-new-branch-create'),
    newBranchCancel: () => page.getByTestId('git-new-branch-cancel'),
    /** Commits-ahead-of-upstream badge; rendered only while ahead > 0 */
    aheadBadge: () => page.getByTestId('git-ahead-badge'),
    /** Commits-behind-upstream badge; rendered only while behind > 0 */
    behindBadge: () => page.getByTestId('git-behind-badge'),
    /** Spinner shown while a git operation is running */
    busy: () => page.getByTestId('git-busy'),
    fetchButton: () => page.getByTestId('git-fetch-btn'),
    pullButton: () => page.getByTestId('git-pull-btn'),
    pushButton: () => page.getByTestId('git-push-btn'),
    /** Remote URL line, or "No remote configured" */
    remoteUrl: () => page.getByTestId('git-remote-url'),
    /** Streamed push/pull/checkout progress output */
    progressLog: () => page.getByTestId('git-progress-log'),

    /** Working-tree changes list */
    changesList: () => page.getByTestId('git-changes-list'),
    /** Guard rendered instead of the list for very large working trees */
    tooManyFiles: () => page.getByTestId('git-too-many-files'),
    stageAllButton: () => page.getByTestId('git-stage-all'),
    unstageAllButton: () => page.getByTestId('git-unstage-all'),
    stagedRows: () => page.getByTestId('git-changes-staged-row'),
    unstagedRows: () => page.getByTestId('git-changes-unstaged-row'),
    conflictedRows: () => page.getByTestId('git-changes-conflicted-row'),
    /** A staged/unstaged row addressed by its repo-relative path */
    changeRow,
    stagedRow: (filePath: string) => changeRow('staged', filePath),
    unstagedRow: (filePath: string) => changeRow('unstaged', filePath),
    stageFileButton: (filePath: string) => changeRow('unstaged', filePath).getByTestId('git-stage-file'),
    unstageFileButton: (filePath: string) => changeRow('staged', filePath).getByTestId('git-unstage-file'),
    discardFileButton: (filePath: string) => changeRow('unstaged', filePath).getByTestId('git-discard-file'),
    discardModal: () => page.getByTestId('git-discard-modal'),

    /** Commit box for whatever is staged */
    commitForm: () => page.getByTestId('git-commit-form'),
    commitMessage: () => page.getByTestId('git-commit-message'),
    commitButton: () => page.getByTestId('git-commit-btn'),
    commitHint: () => page.getByTestId('git-commit-hint'),

    /** Commit history for the repository */
    historyList: () => page.getByTestId('git-history-list'),
    historyRows: () => page.getByTestId('git-history-row'),
    /** A history row matched on its commit subject */
    historyRow: (message: string) => page.getByTestId('git-history-row').filter({ hasText: message }),
    /** File rows of an expanded commit */
    historyFileRows: () => page.getByTestId('git-history-file-row'),
    historyFileRow: (filePath: string) =>
      page.locator(`[data-testid="git-history-file-row"][data-path="${filePath}"]`),

    /** Diff of the selected file */
    diffPane: () => page.getByTestId('git-diff-pane'),
    diffKind: () => page.getByTestId('git-diff-kind'),
    diffClose: () => page.getByTestId('git-diff-close'),
    /** Fallback renderer used when the unified patch cannot be parsed into rows */
    diffRawText: () => page.getByTestId('git-diff-raw-text'),
    /** Virtualized side-by-side rows of a parsed unified patch */
    diffRows: () => page.getByTestId('git-diff-rows')
  };
};

/**
 * Open the collection's Git tab from the sidebar collection "..." menu.
 *
 * The tab is a singleton per collection, so calling this while the tab already exists just focuses
 * it — which remounts the panel and re-reads `renderer:git:status`.
 *
 * @param page - The page object
 * @param collectionName - Sidebar name of the collection
 */
export const openGitTab = async (page: Page, collectionName: string) => {
  await test.step(`Open the Git tab of "${collectionName}"`, async () => {
    const sidebar = buildSidebarLocators(page);
    const gitPanel = buildGitPanelLocators(page);
    const rowMenu = sidebar.rowMenu(collectionName, 'collection');

    // The "..." trigger is `visibility: hidden` until the row is hovered.
    await sidebar.collectionRow(collectionName).hover();
    await rowMenu.trigger().click();
    await rowMenu.item('git').click();

    await gitPanel.panel().waitFor({ state: 'visible' });
  });
};

/**
 * Stage every unstaged change through the "Stage all" button.
 *
 * Returns once staging has been applied — "Stage all" disables itself when nothing is left
 * unstaged, which is the post-condition of the refreshed status.
 *
 * @param page - The page object
 */
export const stageAll = async (page: Page) => {
  await test.step('Stage all changes', async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.stageAllButton().click();
    await page.locator('[data-testid="git-stage-all"][disabled]').waitFor({ state: 'visible' });
  });
};

/**
 * Commit the staged changes with `message`.
 *
 * Returns once the commit has been applied: the commit button disables itself again because the
 * refreshed status has nothing staged and the form cleared the message.
 *
 * @param page - The page object
 * @param message - Commit message
 */
export const commit = async (page: Page, message: string) => {
  await test.step(`Commit staged changes with message "${message}"`, async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.commitMessage().fill(message);
    await gitPanel.commitButton().click();
    await page.locator('[data-testid="git-commit-btn"][disabled]').waitFor({ state: 'visible' });
  });
};

/**
 * Push the current branch to its remote.
 *
 * The click waits for the button to be enabled again (Playwright actionability), so a push started
 * by an earlier action has already settled.
 *
 * @param page - The page object
 */
export const push = async (page: Page) => {
  await test.step('Push the current branch', async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.pushButton().click();
    await gitPanel.busy().waitFor({ state: 'hidden' });
  });
};

/**
 * Create and check out a branch through the branch bar's inline new-branch input.
 *
 * Returns once the input is gone, i.e. the checkout thunk has been dispatched and the bar
 * re-rendered from the refreshed status.
 *
 * @param page - The page object
 * @param branchName - Name of the branch to create
 */
export const createBranch = async (page: Page, branchName: string) => {
  await test.step(`Create branch "${branchName}"`, async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.newBranchButton().click();
    await gitPanel.newBranchInput().fill(branchName);
    await gitPanel.newBranchCreate().click();
    await gitPanel.newBranchInput().waitFor({ state: 'detached' });
    await gitPanel.busy().waitFor({ state: 'hidden' });
  });
};

/**
 * Select a changed file in the changes list so its diff loads into the diff pane.
 *
 * @param page - The page object
 * @param filePath - Repo-relative path of the file, as rendered on the row's `data-path`
 * @param kind - Which list the row lives in; defaults to the unstaged list
 */
export const openDiffFor = async (page: Page, filePath: string, kind: GitDiffKind = 'unstaged') => {
  await test.step(`Open the ${kind} diff of "${filePath}"`, async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.changeRow(kind, filePath).click();
    await gitPanel.diffPane().waitFor({ state: 'visible' });
  });
};

/**
 * Open the branch dropdown and wait until its options are interactive.
 *
 * @param page - The page object
 */
export const openBranchDropdown = async (page: Page) => {
  await test.step('Open the branch dropdown', async () => {
    const gitPanel = buildGitPanelLocators(page);

    await gitPanel.branchTrigger().click();
    await gitPanel.branchOptions().first().waitFor({ state: 'visible' });
  });
};
