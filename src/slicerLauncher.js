const { shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');

/**
 * Opens a .3mf file, either with a specific slicer app the user picked
 * (during onboarding or in Settings) or with the OS's default handler for
 * .3mf files. There's no shared slicer CLI/API to depend on across Bambu
 * Studio, OrcaSlicer, PrusaSlicer, Cura, etc., so this is the same as
 * double-clicking the file in Finder/Explorer, optionally aimed at a
 * specific app.
 */
function open(fileURL, customAppPath) {
  if (!fs.existsSync(fileURL)) {
    return Promise.resolve({ ok: false, error: "That plate's file is missing from the library." });
  }

  if (customAppPath) {
    return new Promise((resolve) => {
      const isMac = process.platform === 'darwin';
      const command = isMac ? 'open' : customAppPath;
      const args = isMac ? ['-a', customAppPath, fileURL] : [fileURL];
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.once('error', (err) => resolve({ ok: false, error: err.message }));
      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true });
      });
    });
  }

  return shell.openPath(fileURL).then((errorMessage) => {
    if (errorMessage) return { ok: false, error: errorMessage };
    return { ok: true };
  });
}

module.exports = { open };
