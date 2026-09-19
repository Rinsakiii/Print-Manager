const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const AdmZip = require('adm-zip');

/**
 * Manages the app's private copy of imported .3mf files, kept in
 * ~/Documents/PrintManager/files so Bambu Studio (an unrelated app) can
 * always read them straight off disk.
 */
function libraryDir() {
  const dir = path.join(app.getPath('documents'), 'PrintManager', 'files');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function importFile(sourcePath) {
  const dir = libraryDir();
  const ext = path.extname(sourcePath);
  const base = path.basename(sourcePath, ext);

  let candidate = path.basename(sourcePath);
  let dest = path.join(dir, candidate);
  let counter = 1;
  while (fs.existsSync(dest)) {
    candidate = `${base} ${counter}${ext}`;
    dest = path.join(dir, candidate);
    counter += 1;
  }

  fs.copyFileSync(sourcePath, dest);

  const inspection = inspectThreeMf(dest);
  if (inspection.thumbnail) {
    fs.writeFileSync(thumbPathFor(dest), inspection.thumbnail);
  }

  return candidate;
}

function urlFor(storedFileName) {
  return path.join(libraryDir(), storedFileName);
}

function thumbPathFor(threeMfPath) {
  return `${threeMfPath}.thumb.png`;
}

// Bambu Studio (and most 3MF-producing slicers) embed a plate preview PNG
// inside the .3mf zip under Metadata/. There's no public spec guaranteeing
// the exact filename, so we check known conventions in priority order —
// plate_N is the full colored isometric render; top_N/pick_N are thinner
// orthographic previews that are often near-blank for flat parts — and
// fall back to any image sitting in Metadata/. Entries must be checked
// pattern-by-pattern (not entry-by-entry) since zip entry order has no
// relationship to which preview looks best.
const THUMBNAIL_NAME_PATTERNS = [/^Metadata\/plate_\d+\.png$/i, /^Metadata\/top_\d+\.png$/i, /^Metadata\/pick_\d+\.png$/i];

function extractThumbnail(entries) {
  for (const pattern of THUMBNAIL_NAME_PATTERNS) {
    const match = entries.find((e) => pattern.test(e.entryName));
    if (match) return match.getData();
  }
  const fallback = entries.find((e) => /^Metadata\/.*\.(png|jpg|jpeg)$/i.test(e.entryName));
  return fallback ? fallback.getData() : null;
}

// After a plate has actually been sliced, Bambu Studio writes per-plate
// stats into Metadata/slice_info.config as flat <metadata key="..." value="..."/>
// tags inside a <plate> block — "prediction" is total print time in seconds,
// "weight" is total filament used in grams. A .3mf that's never been sliced
// (e.g. a raw downloaded model) won't have these, so this returns nulls and
// the Add Plate form just falls back to manual entry, same as with no thumbnail.
function extractSliceInfo(entries) {
  const entry = entries.find((e) => e.entryName === 'Metadata/slice_info.config');
  if (!entry) return { printTimeMinutes: null, filamentGrams: null };

  const xml = entry.getData().toString('utf-8');
  const plateMatch = xml.match(/<plate>([\s\S]*?)<\/plate>/i);
  const scope = plateMatch ? plateMatch[1] : xml;

  const predictionMatch = scope.match(/<metadata\s+key="prediction"\s+value="([^"]*)"/i);
  const weightMatch = scope.match(/<metadata\s+key="weight"\s+value="([^"]*)"/i);

  const seconds = predictionMatch ? parseFloat(predictionMatch[1]) : NaN;
  const grams = weightMatch ? parseFloat(weightMatch[1]) : NaN;

  return {
    printTimeMinutes: Number.isFinite(seconds) ? Math.round(seconds / 60) : null,
    filamentGrams: Number.isFinite(grams) ? Math.round(grams * 10) / 10 : null,
  };
}

function inspectThreeMf(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    return {
      thumbnail: extractThumbnail(entries),
      ...extractSliceInfo(entries),
    };
  } catch (err) {
    console.error('Failed to inspect .3mf:', err.message);
    return { thumbnail: null, printTimeMinutes: null, filamentGrams: null };
  }
}

/** Live preview for a file that hasn't been imported yet (e.g. in the Add Plate dialog). */
function previewThreeMf(sourcePath) {
  const inspection = inspectThreeMf(sourcePath);
  return {
    thumbnailDataUrl: inspection.thumbnail ? `data:image/png;base64,${inspection.thumbnail.toString('base64')}` : null,
    printTimeMinutes: inspection.printTimeMinutes,
    filamentGrams: inspection.filamentGrams,
  };
}

function getThumbnailDataUrl(storedFileName) {
  const thumbPath = thumbPathFor(urlFor(storedFileName));
  if (!fs.existsSync(thumbPath)) return null;
  const buf = fs.readFileSync(thumbPath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function deleteFile(storedFileName) {
  const filePath = urlFor(storedFileName);
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to delete file:', err);
  }
  try {
    fs.unlinkSync(thumbPathFor(filePath));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to delete thumbnail:', err);
  }
}

module.exports = { libraryDir, importFile, urlFor, deleteFile, getThumbnailDataUrl, previewThreeMf };
