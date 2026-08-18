import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const publicDir = path.join(projectRoot, 'public');
const musicDir = path.join(publicDir, 'music');
const coversDir = path.join(publicDir, 'covers');
const playlistCoversDir = path.join(publicDir, 'playlist-covers');
const dataDir = path.join(publicDir, 'data');

// Ensure required output directories exist
[coversDir, playlistCoversDir, dataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Playlist definitions
const PLAYLISTS_CONFIG = [
  {
    id: "lofi",
    title: "Lo-Fi",
    cover: "/playlist-covers/lofi.jpg",
    description: "Relaxing beats for studying, coding and everyday focus."
  },
  {
    id: "jazz",
    title: "Jazz",
    cover: "/playlist-covers/jazz.jpg",
    description: "Warm café vibes and smooth evening sessions."
  },
  {
    id: "sleep",
    title: "Sleep",
    cover: "/playlist-covers/sleep.jpg",
    description: "Gentle sounds for restful nights."
  },
  {
    "id": "focus",
    "title": "Focus",
    "cover": "/playlist-covers/focus.jpg",
    "description": "Deep concentration and productivity."
  },
  {
    id: "relax",
    title: "Relax",
    cover: "/playlist-covers/relax.jpg",
    description: "Calm instrumental music to unwind."
  },
  {
    id: "ambience",
    title: "Ambience",
    cover: "/playlist-covers/ambience.jpg",
    description: "Environmental and atmospheric soundscapes."
  },
  {
    id: "rain",
    title: "Rain",
    cover: "/playlist-covers/rain.jpg",
    description: "Rainfall and storms for calm concentration."
  }
];

/**
 * Clean file name string according to Task 2 requirements
 */
function cleanFilenameString(originalName) {
  const ext = path.extname(originalName);
  let name = path.basename(originalName, ext);

  // 1. Remove watermark suffixes & download site tags
  name = name.replace(/[_.\-\s]*spotdown\.org/gi, '');
  name = name.replace(/[_.\-\s]*spotifydown\.com/gi, '');
  name = name.replace(/\[?\(?\s*spotdown\.org\s*\)?\]?/gi, '');

  // 2. Remove audio/video download quality artifacts
  name = name.replace(/\[?\(?\s*official\s+(audio|video|music\s+video)\s*\)?\]?/gi, '');
  name = name.replace(/\[?\(?\s*320\s*kbps\s*\)?\]?/gi, '');
  name = name.replace(/\[?\(?\s*audio\s*\)?\]?/gi, '');
  name = name.replace(/\[?\(?\s*lyric\s+video\s*\)?\]?/gi, '');
  name = name.replace(/\[?\(?\s*hd\s*\)?\]?/gi, '');

  // 3. Remove leading track numbering prefixes (e.g. "82. ", "01 - ", "1. ", "01_")
  name = name.replace(/^\d{1,3}[\s._-]+\s*/, '');

  // 4. Clean up underscores and duplicate whitespace
  name = name.replace(/_/g, ' ');
  name = name.replace(/\s+/g, ' ');
  name = name.trim();
  name = name.replace(/^[-._\s]+|[-._\s]+$/g, '');

  if (!name) {
    name = path.basename(originalName, ext);
  }

  return name + ext;
}

/**
 * Format song ID (Task 5: e.g. lofi_001, focus_001)
 */
function formatSongId(playlistId, index) {
  const paddedIndex = String(index).padStart(3, '0');
  return `${playlistId}_${paddedIndex}`;
}

async function processMusicLibrary() {
  console.log("=========================================");
  console.log("Zix'Ovibes — Music Library Processing");
  console.log("=========================================\n");

  const songsList = [];
  let totalProcessed = 0;
  let totalExtractedCovers = 0;
  let totalFallbackCovers = 0;
  const warnings = [];

  // Write playlists.json (Task 7)
  const playlistsJsonPath = path.join(dataDir, 'playlists.json');
  fs.writeFileSync(playlistsJsonPath, JSON.stringify(PLAYLISTS_CONFIG, null, 2), 'utf-8');
  console.log(`[Task 7] Generated playlists.json (${PLAYLISTS_CONFIG.length} playlists)\n`);

  for (const playlistConfig of PLAYLISTS_CONFIG) {
    const playlistId = playlistConfig.id;
    const playlistFolderPath = path.join(musicDir, playlistId);

    if (!fs.existsSync(playlistFolderPath)) {
      console.warn(`[Warning] Folder for playlist '${playlistId}' not found at: ${playlistFolderPath}`);
      warnings.push(`Folder missing for playlist: ${playlistId}`);
      continue;
    }

    // Task 1: Scan MP3 files in playlist folder
    const files = fs.readdirSync(playlistFolderPath).filter(f => f.toLowerCase().endsWith('.mp3'));
    console.log(`Processing playlist '${playlistId}' (${files.length} MP3 files)...`);

    // Task 2: Clean physical filenames on disk if needed
    const cleanedFilesMap = [];

    for (const file of files) {
      const currentFilePath = path.join(playlistFolderPath, file);
      let cleanedName = cleanFilenameString(file);

      let finalFilePath = currentFilePath;
      let finalFileName = file;

      if (cleanedName !== file) {
        let targetPath = path.join(playlistFolderPath, cleanedName);

        // Avoid accidental overwrites if collision occurs
        if (fs.existsSync(targetPath) && targetPath !== currentFilePath) {
          const ext = path.extname(cleanedName);
          const base = path.basename(cleanedName, ext);
          cleanedName = `${base}_${Date.now()}${ext}`;
          targetPath = path.join(playlistFolderPath, cleanedName);
        }

        try {
          fs.renameSync(currentFilePath, targetPath);
          finalFilePath = targetPath;
          finalFileName = cleanedName;
        } catch (err) {
          console.warn(`Could not rename '${file}' to '${cleanedName}': ${err.message}`);
          warnings.push(`File rename failed: ${file}`);
        }
      }

      cleanedFilesMap.push({
        fileName: finalFileName,
        filePath: finalFilePath
      });
    }

    // Sort files deterministically for stable IDs (Task 5)
    cleanedFilesMap.sort((a, b) => a.fileName.localeCompare(b.fileName));

    let songIndex = 1;

    for (const item of cleanedFilesMap) {
      const songId = formatSongId(playlistId, songIndex++);
      const songFilePath = item.filePath;
      const cleanBaseName = path.basename(item.fileName, '.mp3');

      let title = cleanBaseName;
      let artist = "Zix'O Library";
      let album = "Unknown";
      let duration = 180;
      let hasEmbeddedCover = false;
      let coverPath = `/playlist-covers/${playlistId}.jpg`;

      // Fallback artist heuristics if title has " - "
      if (cleanBaseName.includes(' - ')) {
        const parts = cleanBaseName.split(' - ');
        title = parts[0].trim();
        artist = parts.slice(1).join(' - ').trim();
      }

      // Task 3: Read MP3 Metadata (ID3 tags)
      try {
        const metadata = await parseFile(songFilePath);
        
        if (metadata.common) {
          if (metadata.common.title && metadata.common.title.trim().length > 0) {
            title = metadata.common.title.trim();
          }
          if (metadata.common.artist && metadata.common.artist.trim().length > 0) {
            artist = metadata.common.artist.trim();
          }
          if (metadata.common.album && metadata.common.album.trim().length > 0) {
            album = metadata.common.album.trim();
          }
        }

        if (metadata.format && typeof metadata.format.duration === 'number' && !isNaN(metadata.format.duration)) {
          duration = Math.max(1, Math.round(metadata.format.duration));
        }

        // Task 4: Extract Album Artwork if available
        if (metadata.common && metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const imgExt = picture.format === 'image/png' ? '.png' : '.jpg';
          const coverFileName = `${songId}${imgExt}`;
          const coverDiskPath = path.join(coversDir, coverFileName);

          fs.writeFileSync(coverDiskPath, picture.data);
          coverPath = `/covers/${coverFileName}`;
          hasEmbeddedCover = true;
          totalExtractedCovers++;
        } else {
          totalFallbackCovers++;
        }
      } catch (err) {
        console.warn(`[Metadata Warning] Failed to parse ID3 for '${item.fileName}': ${err.message}`);
        warnings.push(`ID3 read error: ${item.fileName}`);
        totalFallbackCovers++;
      }

      // Relative web path for public folder
      const relMusicPath = `/music/${playlistId}/${item.fileName}`;

      const songObj = {
        id: songId,
        title: title,
        artist: artist,
        album: album,
        playlist: playlistId,
        duration: duration,
        filename: relMusicPath,
        cover: coverPath
      };

      songsList.push(songObj);
      totalProcessed++;
    }

    console.log(`✓ '${playlistId}': ${cleanedFilesMap.length} songs processed.`);
  }

  // Task 6: Write songs.json
  const songsJsonPath = path.join(dataDir, 'songs.json');
  fs.writeFileSync(songsJsonPath, JSON.stringify(songsList, null, 2), 'utf-8');
  console.log(`\n[Task 6] Saved ${songsList.length} songs to public/data/songs.json`);

  // Task 8: Validation
  console.log("\n=========================================");
  console.log("Task 8 — Validation & Integrity Check");
  console.log("=========================================");

  let validationPassed = true;
  const idSet = new Set();

  for (const song of songsList) {
    // 1. Check Unique ID
    if (idSet.has(song.id)) {
      console.error(`[Validation Error] Duplicate Song ID detected: ${song.id}`);
      validationPassed = false;
    }
    idSet.add(song.id);

    // 2. Verify MP3 file exists on disk
    const mp3DiskPath = path.join(publicDir, song.filename.substring(1));
    if (!fs.existsSync(mp3DiskPath)) {
      console.error(`[Validation Error] MP3 file missing on disk: ${mp3DiskPath}`);
      validationPassed = false;
    }

    // 3. Verify cover image exists on disk
    const coverDiskPath = path.join(publicDir, song.cover.substring(1));
    if (!fs.existsSync(coverDiskPath)) {
      console.error(`[Validation Error] Cover image missing on disk: ${coverDiskPath}`);
      validationPassed = false;
    }

    // 4. Verify duration is valid
    if (typeof song.duration !== 'number' || song.duration <= 0) {
      console.error(`[Validation Error] Invalid duration for ${song.id}: ${song.duration}`);
      validationPassed = false;
    }
  }

  console.log(`Total songs processed: ${totalProcessed}`);
  console.log(`Embedded covers extracted: ${totalExtractedCovers}`);
  console.log(`Playlist fallback covers used: ${totalFallbackCovers}`);
  console.log(`Warnings count: ${warnings.length}`);

  if (validationPassed) {
    console.log("\n✅ ALL VALIDATION CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.error("\n❌ Validation completed with errors. Please check the log above.");
  }
}

processMusicLibrary().catch(err => {
  console.error("Unhandled error during music library processing:", err);
  process.exit(1);
});
