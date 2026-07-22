import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const key = (lessonId: string) => `download:${lessonId}`;

export async function getDownloadedPath(lessonId: string): Promise<string | null> {
  try {
    const path = await AsyncStorage.getItem(key(lessonId));
    if (path) {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && !info.isDirectory && (info.size ?? 0) > 0) {
        return path;
      } else {
        // File no longer exists or is 0 bytes — clean up stale reference
        await AsyncStorage.removeItem(key(lessonId));
        return null;
      }
    }
  } catch (e) {
    console.warn('[DownloadStorage] Error checking local path:', e);
  }
  return null;
}

export async function setDownloadedPath(lessonId: string, path: string): Promise<void> {
  await AsyncStorage.setItem(key(lessonId), path);
}

export async function removeDownloadedPath(lessonId: string): Promise<void> {
  try {
    const path = await AsyncStorage.getItem(key(lessonId));
    if (path) {
      await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    }
    await AsyncStorage.removeItem(key(lessonId));
  } catch (e) {
    console.warn('[DownloadStorage] Delete error:', e);
  }
}

export async function downloadLessonVideo(
  lessonId: string,
  videoUrl: string,
  onProgress?: (progressPct: number) => void
): Promise<string> {
  if (!videoUrl || !videoUrl.startsWith('http')) {
    throw new Error('Invalid or non-HTTP video URL');
  }

  // 1. Storage Full Protection: Check available disk space (require min 100MB free buffer)
  try {
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const MIN_REQUIRED_BYTES = 100 * 1024 * 1024; // 100 MB
    if (freeBytes < MIN_REQUIRED_BYTES) {
      throw new Error("Not enough storage to download this video. Free up space and try again.");
    }
  } catch (storageErr: any) {
    if (storageErr.message?.includes("Not enough storage")) {
      throw storageErr;
    }
    // Fall back gracefully if OS disk space query fails
    console.warn('[DownloadStorage] Could not query free disk space:', storageErr);
  }

  const dir = `${FileSystem.documentDirectory}videos/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const ext = videoUrl.split('?')[0].split('.').pop()?.toLowerCase() || 'mp4';
  const targetPath = `${dir}lesson_${lessonId}.${ext}`;
  const tempPath = `${dir}lesson_${lessonId}_tmp.${ext}`;

  const downloadResumable = FileSystem.createDownloadResumable(
    videoUrl,
    tempPath,
    {},
    (downloadProgress) => {
      if (downloadProgress.totalBytesExpectedToWrite > 0) {
        const pct = Math.round(
          (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
        );
        if (onProgress) onProgress(pct);
      }
    }
  );

  try {
    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Download completed without valid URI');
    }

    // Replace existing target if present
    const existing = await FileSystem.getInfoAsync(targetPath);
    if (existing.exists) {
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
    }

    await FileSystem.moveAsync({ from: tempPath, to: targetPath });
    await setDownloadedPath(lessonId, targetPath);
    return targetPath;
  } catch (err) {
    // 2. Partial File Cleanup: Delete .tmp file on error/interruption & confirm cleanup
    await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    console.log('[DownloadStorage] Cleaned up partial download temp file:', tempPath);
    throw err;
  }
}
