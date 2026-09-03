require('dotenv').config({ path: process.env.DOTENV_PATH });
const fs = require('fs');
const path = require('path');
const electron_notarize = require('electron-notarize');

const notarize = async function (params) {
  if (process.platform !== 'darwin') {
    return;
  }

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;

  // Upstream hardcoded its own appId and teamId here, so a fork build would attempt to notarize
  // under someone else's identity. Notarization is now opt-in: without all three credentials
  // there is nothing to notarize against, so skip instead of failing a local/unsigned build.
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.log('Skipping notarization: APPLE_ID, APPLE_ID_PASSWORD and APPLE_TEAM_ID are not all set.');
    return;
  }

  const appId = params.packager.appInfo.macBundleIdentifier;
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    console.error(`Cannot find application at: ${appPath}`);
    return;
  }

  console.log(`Notarizing ${appId} found at ${appPath} using Apple ID ${APPLE_ID}`);
  try {
    await electron_notarize.notarize({
      tool: 'notarytool',
      appBundleId: appId,
      appPath: appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      ascProvider: APPLE_TEAM_ID,
      teamId: APPLE_TEAM_ID
    });
  } catch (error) {
    console.error(error);
    throw error;
  }

  console.log(`Done notarizing ${appPath}`);
};

module.exports = notarize;
