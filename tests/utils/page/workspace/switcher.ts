import { test, Page } from '../../../../playwright';
import { buildToastLocators } from '../toast';

/**
 * Workspace switcher (title bar dropdown) locators.
 *
 * The `MenuDropdown` in `AppTitleBar` is mounted with `data-testid="workspace-menu"`, which lands
 * on the trigger element (`.workspace-name-container`); the popup itself is `workspace-menu-dropdown`
 * and each menu row is `workspace-menu-<item id>`. Workspace rows carry uid-based ids, so they are
 * addressed through their `.workspace-item` class scoped to the popup.
 */
export const buildWorkspaceSwitcherLocators = (page: Page) => {
  const menu = () => page.getByTestId('workspace-menu-dropdown');
  const items = () => menu().locator('.workspace-item');

  return {
    /** Title bar trigger that opens the workspace dropdown */
    trigger: () => page.getByTestId('workspace-menu'),
    /** The opened dropdown popup */
    menu,
    /** Every workspace row in the dropdown (includes the default workspace) */
    items,
    /** A single workspace row, matched on its exact label */
    item: (workspaceName: string) => items().filter({ has: page.getByText(workspaceName, { exact: true }) }),
    /** "Create workspace" action row in the dropdown */
    createWorkspaceItem: () => menu().getByTestId('workspace-menu-create-workspace'),
    /** Inline rename/create input rendered in the collection header */
    nameInput: () => page.locator('.workspace-name-input'),
    /** Active workspace name in the title bar, matched only when it equals `workspaceName` */
    activeWorkspaceNamed: (workspaceName: string) =>
      page.getByTestId('workspace-name').and(page.getByText(workspaceName, { exact: true }))
  };
};

/**
 * Open the workspace switcher and create a workspace through the inline rename flow:
 * dropdown -> "Create workspace" -> type name -> Enter.
 *
 * Returns once the creation has been committed — the "Workspace created!" toast has shown and the
 * title bar displays the new workspace as active.
 *
 * @param page - The page object
 * @param workspaceName - The name to give the new workspace
 */
export const createWorkspaceInline = async (page: Page, workspaceName: string) => {
  await test.step(`Create workspace "${workspaceName}" inline from the title bar`, async () => {
    const switcher = buildWorkspaceSwitcherLocators(page);
    const toast = buildToastLocators(page);

    await switcher.trigger().click();
    await switcher.createWorkspaceItem().click();

    const nameInput = switcher.nameInput();
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(workspaceName);
    await nameInput.press('Enter');

    // Synchronization, not assertion: the workspace is written to disk asynchronously, so wait for
    // the success toast and for the title bar to switch to the new workspace before returning.
    // `.first()` because toasts from earlier creations can still be on screen.
    await toast.byMessage('Workspace created!').first().waitFor({ state: 'visible' });
    await switcher.activeWorkspaceNamed(workspaceName).waitFor({ state: 'visible' });
  });
};

/**
 * Open the workspace switcher dropdown and wait until it is interactive.
 *
 * @param page - The page object
 */
export const openWorkspaceSwitcher = async (page: Page) => {
  await test.step('Open the workspace switcher dropdown', async () => {
    const switcher = buildWorkspaceSwitcherLocators(page);
    await switcher.trigger().click();
    await switcher.menu().waitFor({ state: 'visible' });
  });
};
