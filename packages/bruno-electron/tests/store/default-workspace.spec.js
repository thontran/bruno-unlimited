const path = require('path');
const fs = require('fs');
const os = require('os');

let mockUserDataDir = null;
let mockStoreData = {};

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => mockUserDataDir)
  },
  dialog: {},
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => false)
  }
}));

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: (key, fallback) => (key in mockStoreData ? mockStoreData[key] : fallback),
    set: (key, value) => {
      mockStoreData[key] = value;
    },
    delete: (key) => {
      delete mockStoreData[key];
    }
  }));
});

const { defaultWorkspaceManager } = require('../../src/store/default-workspace');

const EXISTING_WORKSPACE_COUNT = 26; // default-workspace + default-workspace-1..25

const createDir = (...segments) => {
  const dirPath = path.join(...segments);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

describe('DefaultWorkspaceManager unbounded default workspace naming', () => {
  beforeEach(() => {
    mockUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-default-ws-'));
    mockStoreData = {};

    createDir(mockUserDataDir, 'default-workspace');
    for (let i = 1; i <= EXISTING_WORKSPACE_COUNT - 1; i++) {
      createDir(mockUserDataDir, `default-workspace-${i}`);
    }

    defaultWorkspaceManager.defaultWorkspacePath = null;
    defaultWorkspaceManager.initializationPromise = null;
  });

  afterEach(() => {
    fs.rmSync(mockUserDataDir, { recursive: true, force: true, maxRetries: 5 });
    mockUserDataDir = null;
    jest.clearAllMocks();
  });

  test('findExistingDefaultWorkspaces discovers every existing directory, latest first', () => {
    const workspaces = defaultWorkspaceManager.findExistingDefaultWorkspaces();

    expect(workspaces).toHaveLength(EXISTING_WORKSPACE_COUNT);
    expect(workspaces[0]).toBe(path.join(mockUserDataDir, 'default-workspace-25'));
    expect(workspaces[1]).toBe(path.join(mockUserDataDir, 'default-workspace-24'));
    expect(workspaces[workspaces.length - 1]).toBe(path.join(mockUserDataDir, 'default-workspace'));

    // No numeric-string sorting: -20 must never outrank -25
    const indices = workspaces.map((workspacePath) => {
      const name = path.basename(workspacePath);
      const suffix = name.slice('default-workspace'.length);
      return suffix ? Number(suffix.slice(1)) : 0;
    });
    expect(indices).toEqual([...indices].sort((a, b) => b - a));
  });

  test('findExistingDefaultWorkspaces ignores unrelated entries', () => {
    createDir(mockUserDataDir, 'default-workspace-backup');
    createDir(mockUserDataDir, 'my-default-workspace');
    createDir(mockUserDataDir, 'default-workspace-1a');
    fs.writeFileSync(path.join(mockUserDataDir, 'default-workspace-99'), 'not a directory');

    const workspaces = defaultWorkspaceManager.findExistingDefaultWorkspaces();

    expect(workspaces).toHaveLength(EXISTING_WORKSPACE_COUNT);
    expect(workspaces).not.toContain(path.join(mockUserDataDir, 'default-workspace-99'));
    expect(workspaces).not.toContain(path.join(mockUserDataDir, 'default-workspace-backup'));
  });

  test('initializeDefaultWorkspace resolves default-workspace-26 past the old 20 ceiling', async () => {
    const workspacePath = await defaultWorkspaceManager.initializeDefaultWorkspace({
      migrateFromPreferences: false
    });

    expect(workspacePath).toBe(path.join(mockUserDataDir, 'default-workspace-26'));
    expect(fs.existsSync(path.join(workspacePath, 'workspace.yml'))).toBe(true);
    expect(fs.existsSync(path.join(workspacePath, 'collections'))).toBe(true);
    expect(fs.existsSync(path.join(workspacePath, 'environments'))).toBe(true);
    expect(defaultWorkspaceManager.getDefaultWorkspacePath()).toBe(workspacePath);
  });

  test('ensureDefaultWorkspaceExists creates a new workspace when all 26 are invalid', async () => {
    // Recovery from the latest (yml-less) directory logs an expected failure
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await defaultWorkspaceManager.ensureDefaultWorkspaceExists();

    expect(result).not.toBeNull();
    expect(result.workspacePath).toBe(path.join(mockUserDataDir, 'default-workspace-26'));
    expect(fs.existsSync(path.join(result.workspacePath, 'workspace.yml'))).toBe(true);

    consoleError.mockRestore();
  });
});
