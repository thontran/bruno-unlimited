import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { test, expect, closeElectronApp } from '../../playwright';
import { waitForReadyPage, buildCommonLocators } from '../utils/page';
import { createWorkspaceInline, openWorkspaceSwitcher } from '../utils/page/workspace/switcher';

type WorkspaceConfig = {
  opencollection?: string;
  info?: { name: string; type: string };
  collections?: { name?: string; path?: string }[];
};

// Reuses the create-workspace fixture: preferences with `general.defaultLocation` = {{wsLocation}},
// which is what makes the inline (no-modal) creation flow take over.
const initUserDataPath = path.join(__dirname, 'create-workspace', 'init-user-data');

const WORKSPACE_COUNT = 25;
const workspaceNames = Array.from({ length: WORKSPACE_COUNT }, (_, index) => `ws-${index + 1}`);

function findCreatedWorkspaceDirs(location: string): string[] {
  return fs.readdirSync(location).filter((e) => {
    const fullPath = path.join(location, e);
    return (
      fs.statSync(fullPath).isDirectory()
      && e !== 'default-workspace'
      && fs.existsSync(path.join(fullPath, 'workspace.yml'))
    );
  });
}

test.describe('Unlimited workspaces', () => {
  test(`should create ${WORKSPACE_COUNT} workspaces and list them all in the switcher`, async ({
    launchElectronApp,
    createTmpDir
  }) => {
    // 25 sequential create-workspace round trips (IPC + disk write + workspace switch) each.
    test.setTimeout(240_000);

    const wsLocation = await createTmpDir('ws-unlimited');

    const app = await launchElectronApp({ initUserDataPath, templateVars: { wsLocation } });
    const page = await waitForReadyPage(app);
    const { workspaceSwitcher } = buildCommonLocators(page);

    for (const workspaceName of workspaceNames) {
      await createWorkspaceInline(page, workspaceName);
    }

    await test.step('Verify every created workspace is listed in the switcher', async () => {
      await openWorkspaceSwitcher(page);

      // +1 for the default workspace, which is always listed alongside the created ones.
      await expect(workspaceSwitcher.items()).toHaveCount(WORKSPACE_COUNT + 1);

      const listedNames = (await workspaceSwitcher.items().allTextContents()).map((text) => text.trim());
      expect(listedNames).toEqual(expect.arrayContaining(workspaceNames));

      for (const workspaceName of workspaceNames) {
        await expect(workspaceSwitcher.item(workspaceName)).toHaveCount(1);
      }
    });

    await test.step('Verify every workspace exists on disk', async () => {
      const wsDirs = findCreatedWorkspaceDirs(wsLocation);
      expect(wsDirs).toHaveLength(WORKSPACE_COUNT);

      const namesOnDisk = wsDirs.map((dir) => {
        const config = yaml.load(
          fs.readFileSync(path.join(wsLocation, dir, 'workspace.yml'), 'utf8')
        ) as WorkspaceConfig;
        expect(config?.info?.type).toBe('workspace');
        return config?.info?.name;
      });

      expect(namesOnDisk.sort()).toEqual([...workspaceNames].sort());
    });

    await closeElectronApp(app);
  });
});
