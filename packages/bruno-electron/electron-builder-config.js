require('dotenv').config({ path: process.env.DOTENV_PATH });

const config = {
  // Fork identity. Deliberately NOT com.usebruno.app / "Bruno": the upstream maintainer holds
  // the Bruno trademark (see publishing.md), and a distinct appId keeps this install's userData
  // separate so it can sit side by side with an official Bruno install.
  appId: 'com.brunounlimited.app',
  productName: 'Bruno Unlimited',
  electronVersion: '37.6.1',
  // Never let electron-builder publish. With a tag present it otherwise defaults to the GitHub
  // provider and aborts with "GitHub Personal Access Token is not set". Uploading is the
  // release workflow's job. This lives in config, not as a `--publish=never` CLI flag, because
  // npm on Windows drops forwarded args to workspace scripts.
  publish: null,
  directories: {
    buildResources: 'resources',
    output: 'out'
  },
  extraResources: [
    {
      from: 'resources/data/sample-collection.json',
      to: 'data/sample-collection.json'
    }
  ],
  files: ['**/*'],
  afterSign: 'notarize.js',
  mac: {
    artifactName: 'bruno-unlimited_${version}_${arch}_${os}.${ext}',
    category: 'public.app-category.developer-tools',
    // `pkg` is intentionally absent: it cannot be produced unsigned (electron-builder fails
    // renaming <appId>.pkg), and it is only needed for installer/App Store distribution.
    // Add it back alongside MAC_SIGN_IDENTITY if a signed .pkg is ever required.
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'resources/icons/mac/icon.icns',
    hardenedRuntime: true,
    // Upstream hardcoded its own Developer ID here, which makes any fork build fail. Opt in by
    // setting MAC_SIGN_IDENTITY to your own identity; null means an unsigned local build.
    identity: process.env.MAC_SIGN_IDENTITY || null,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: false,
    requirements: 'resources/app-requirements.txt',
    // NOTE: the `bruno://` scheme below is intentionally unchanged — it carries the OAuth2
    // callback (`bruno://app/oauth2/callback`) that oauth.usebruno.com redirects to, so
    // renaming it would break OAuth2. Consequence: whichever install registered last owns
    // `bruno://` deep links when an official Bruno is also installed.
    protocols: [
      {
        name: 'Bruno',
        schemes: [
          'bruno'
        ]
      }
    ]
  },
  linux: {
    artifactName: 'bruno-unlimited_${version}_${arch}_${os}.${ext}',
    icon: 'resources/icons/png',
    target: [
      {
        target: 'AppImage',
        arch: ['x64', 'arm64']
      },
      {
        target: 'deb',
        arch: ['x64', 'arm64']
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64']
      }
    ],
    protocols: [
      {
        name: 'Bruno',
        schemes: ['bruno']
      }
    ],
    category: 'Development',
    desktop: {
      MimeType: 'x-scheme-handler/bruno;'
    }
  },
  deb: {
    // Docs: https://www.electron.build/configuration/linux#debian-package-options
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
      'libatspi2.0-0',
      'libuuid1',
      'libsecret-1-0',
      'libasound2' // #1036
    ]
  },
  win: {
    artifactName: 'bruno-unlimited_${version}_${arch}_win.${ext}',
    icon: 'resources/icons/win/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'arm64']
      }
    ],
    sign: null,
    // Unsigned: installs will show a SmartScreen warning until a code-signing cert is wired in.
    publisherName: 'Bruno Unlimited'
  },
  nsis: {
    include: 'resources/installer.nsh',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  pkg: {
    installLocation: '/Applications',
    isRelocatable: false
  }
};

module.exports = config;
