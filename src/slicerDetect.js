const fs = require('fs');
const path = require('path');

/**
 * Known slicer apps and their typical install locations. There's no OS-level
 * registry of "installed slicers" to query, so this checks well-known paths
 * per platform. Anything not found here is still reachable via "Browse for
 * another app..." (a manual path the user points us at) or "System Default"
 * (whatever the OS already associates with .3mf files).
 */
const KNOWN_SLICERS = [
  {
    id: 'bambu-studio',
    name: 'Bambu Studio',
    mac: ['/Applications/Bambu Studio.app', '/Applications/BambuStudio.app'],
    win: ['C:\\Program Files\\Bambu Studio\\bambu-studio.exe'],
  },
  {
    id: 'orca-slicer',
    name: 'OrcaSlicer',
    mac: ['/Applications/OrcaSlicer.app'],
    win: ['C:\\Program Files\\OrcaSlicer\\orca-slicer.exe', 'C:\\Program Files\\OrcaSlicer\\OrcaSlicer.exe'],
  },
  {
    id: 'prusa-slicer',
    name: 'PrusaSlicer',
    mac: ['/Applications/PrusaSlicer.app', '/Applications/Original Prusa Drivers/PrusaSlicer.app'],
    win: ['C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer.exe'],
  },
  {
    id: 'super-slicer',
    name: 'SuperSlicer',
    mac: ['/Applications/SuperSlicer.app'],
    win: ['C:\\Program Files\\SuperSlicer\\superslicer.exe'],
  },
  {
    id: 'cura',
    name: 'Ultimaker Cura',
    mac: ['/Applications/Ultimaker Cura.app'],
    // Cura's Windows install folder is version-suffixed (e.g. "Ultimaker Cura 5.7.1"),
    // so it needs a directory scan rather than a fixed path.
    winGlob: { dir: 'C:\\Program Files', namePattern: /^Ultimaker Cura/i, exeInside: 'UltiMaker-Cura.exe' },
  },
];

function detectInstalled() {
  const isMac = process.platform === 'darwin';
  const results = [];

  for (const slicer of KNOWN_SLICERS) {
    const candidates = isMac ? slicer.mac || [] : slicer.win || [];
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) {
      results.push({ id: slicer.id, name: slicer.name, path: found });
      continue;
    }
    if (!isMac && slicer.winGlob) {
      const glob = findWinGlobMatch(slicer.winGlob);
      if (glob) results.push({ id: slicer.id, name: slicer.name, path: glob });
    }
  }

  return results;
}

function findWinGlobMatch({ dir, namePattern, exeInside }) {
  try {
    const entries = fs.readdirSync(dir);
    const match = entries.find((entry) => namePattern.test(entry));
    if (!match) return null;
    const exePath = path.join(dir, match, exeInside);
    return fs.existsSync(exePath) ? exePath : null;
  } catch {
    return null;
  }
}

module.exports = { detectInstalled, KNOWN_SLICERS };
