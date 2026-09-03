import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { test, expect, closeElectronApp, ElectronApplication, Page } from '../../playwright';
import {
  buildCommonLocators,
  fillRequestUrl,
  openRequest,
  saveRequest,
  switchWorkspace,
  waitForReadyPage
} from '../utils/page';
import { commit, createBranch, openDiffFor, openGitTab, push, stageAll } from '../utils/page/git-panel';

const WORKSPACE_NAME = 'Fixture WS';
const COLLECTION_NAME = 'SampleColl';
const REQUEST_NAME = 'sample-request';
const REQUEST_FILE = 'sample-request.bru';

const INITIAL_URL = 'https://example.com/original';
const EDITED_URL = 'https://example.com/staged-and-committed';
const DIFF_URL = 'https://example.com/diffmarker-xyz';

const INITIAL_COMMIT_MESSAGE = 'Initial commit';
const UI_COMMIT_MESSAGE = 'Update sample request url from Bruno';

const initUserDataPath = path.join(__dirname, 'init-user-data');
const workspaceFixturePath = path.join(
  __dirname,
  '..',
  'workspace',
  'git-backed-collections',
  'fixtures',
  'workspace-with-collection'
);

const REQUEST_BRU = `meta {
  name: ${REQUEST_NAME}
  type: http
  seq: 1
}

get {
  url: ${INITIAL_URL}
  body: none
  auth: none
}
`;

/** Run a git command in `cwd` and return its stdout. Throws with git's stderr when it fails. */
const git = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).toString();

let hasGit = true;
try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  hasGit = false;
}

/**
 * The Git tab is stateful: every test builds on the repository the previous one left behind
 * (edit -> stage -> commit -> push -> branch -> diff), so the suite runs serially against one
 * app instance and one temp repository.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Git panel', () => {
  test.skip(!hasGit, 'git is not installed on this host, so the Git panel cannot be exercised');

  let rootDir = '';
  let workspacePath = '';
  let collectionPath = '';
  let originPath = '';
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async ({ launchElectronApp, createTmpDir }) => {
    rootDir = await createTmpDir('git-panel');
    workspacePath = path.join(rootDir, 'workspace');
    collectionPath = path.join(workspacePath, 'collections', 'sample-coll');
    originPath = path.join(rootDir, 'origin.git');

    await fs.promises.cp(workspaceFixturePath, workspacePath, { recursive: true });
    await fs.promises.writeFile(path.join(collectionPath, REQUEST_FILE), REQUEST_BRU, 'utf8');

    // A real repository for the collection, with a local bare repo as its only remote — the panel
    // must never reach the network.
    git(collectionPath, ['init']);
    git(collectionPath, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    git(collectionPath, ['config', 'user.name', 'Bruno E2E']);
    git(collectionPath, ['config', 'user.email', 'e2e@bruno.test']);
    git(collectionPath, ['config', 'commit.gpgsign', 'false']);
    // Keep the working tree byte-identical to the index on Windows hosts with autocrlf enabled.
    git(collectionPath, ['config', 'core.autocrlf', 'false']);
    git(collectionPath, ['add', '-A']);
    git(collectionPath, ['commit', '-m', INITIAL_COMMIT_MESSAGE]);

    git(rootDir, ['init', '--bare', originPath]);
    // Without this the bare repo's HEAD stays on the install default (`master`), and a plain
    // `git log` there reports "does not have any commits yet" even after `main` is pushed.
    git(originPath, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    git(collectionPath, ['remote', 'add', 'origin', originPath]);
    git(collectionPath, ['push', '-u', 'origin', 'main']);

    app = await launchElectronApp({
      initUserDataPath,
      // Forward slashes so the path stays valid JSON when templated into preferences.json.
      templateVars: { workspacePath: workspacePath.replace(/\\/g, '/') }
    });
    page = await waitForReadyPage(app);

    await switchWorkspace(page, WORKSPACE_NAME);
  });

  test.afterAll(async () => {
    if (app) {
      await closeElectronApp(app);
    }
    if (rootDir) {
      // Windows keeps handles on the repo files for a moment after the app exits.
      fs.rmSync(rootDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });

  test('opens the Git tab on a clean repository, showing the current branch and remote', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await openGitTab(page, COLLECTION_NAME);

    await test.step('Branch bar reports the checked-out branch and the bare remote', async () => {
      await expect(gitPanel.branchBar()).toBeVisible();
      await expect(gitPanel.branchTrigger()).toHaveText('main');
      await expect(gitPanel.remoteUrl()).toContainText('origin.git');
    });

    await test.step('Working tree is clean and the seeded commit is in history', async () => {
      await expect(gitPanel.stagedRows()).toHaveCount(0);
      await expect(gitPanel.unstagedRows()).toHaveCount(0);
      await expect(gitPanel.aheadBadge()).toHaveCount(0);
      await expect(gitPanel.historyRow(INITIAL_COMMIT_MESSAGE)).toBeVisible();
    });
  });

  test('a request edited and saved in the UI shows up as an unstaged change', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await openRequest(page, COLLECTION_NAME, REQUEST_NAME);
    await fillRequestUrl(page, EDITED_URL);
    await saveRequest(page);

    await openGitTab(page, COLLECTION_NAME);

    await expect(gitPanel.unstagedRow(REQUEST_FILE)).toBeVisible();
    await expect(gitPanel.stagedRows()).toHaveCount(0);
  });

  test('stage all + commit empties the staged list and adds the commit to history', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await stageAll(page);

    await test.step('The edited request moves from Unstaged to Staged', async () => {
      await expect(gitPanel.stagedRow(REQUEST_FILE)).toBeVisible();
      await expect(gitPanel.unstagedRows()).toHaveCount(0);
    });

    await commit(page, UI_COMMIT_MESSAGE);

    await test.step('Nothing is left staged and the commit is listed in history', async () => {
      await expect(gitPanel.stagedRows()).toHaveCount(0);
      await expect(gitPanel.historyRow(UI_COMMIT_MESSAGE)).toBeVisible();
    });

    await test.step('git records the commit on the branch tip', async () => {
      expect(git(collectionPath, ['log', '-1', '--pretty=%s']).trim()).toBe(UI_COMMIT_MESSAGE);
    });
  });

  test('push sends the commit to the bare remote and clears the ahead badge', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await test.step('The panel reports one commit ahead of the remote', async () => {
      await expect(gitPanel.aheadBadge()).toHaveText('1');
    });

    await push(page);

    await test.step('Ahead badge disappears once the branch is in sync', async () => {
      await expect(gitPanel.aheadBadge()).toHaveCount(0);
    });

    await test.step('The bare repository has received the commit', async () => {
      expect(git(originPath, ['log', '--oneline'])).toContain(UI_COMMIT_MESSAGE);
    });
  });

  test('creating a branch checks it out in the repository and in the branch bar', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await createBranch(page, 'feature-x');

    await expect(gitPanel.branchTrigger()).toHaveText('feature-x');
    expect(git(collectionPath, ['branch', '--show-current']).trim()).toBe('feature-x');
  });

  test('selecting a changed file opens its diff with the changed text', async () => {
    const { gitPanel } = buildCommonLocators(page);

    await openRequest(page, COLLECTION_NAME, REQUEST_NAME);
    await fillRequestUrl(page, DIFF_URL);
    await saveRequest(page);

    await openGitTab(page, COLLECTION_NAME);
    await expect(gitPanel.unstagedRow(REQUEST_FILE)).toBeVisible();

    await openDiffFor(page, REQUEST_FILE);

    await expect(gitPanel.diffPane()).toBeVisible();
    await expect(gitPanel.diffPane()).toContainText(DIFF_URL);
  });
});
