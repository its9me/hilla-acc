import { LOCAL_LECTURE_FILES } from '../data/localLectures';
import type { DriveEntry } from '../types/drive';

export function getLocalLectureUrl(entryId: string): string | null {
  const relPath = LOCAL_LECTURE_FILES[entryId];
  if (!relPath) return null;
  return `${import.meta.env.BASE_URL}${relPath}`;
}

export function getLectureDownloadProps(entry: DriveEntry): {
  href: string;
  downloadName?: string;
  isLocal: boolean;
} {
  const relPath = LOCAL_LECTURE_FILES[entry.id];
  if (!relPath) {
    return {
      href: entry.downloadUrl,
      isLocal: false,
    };
  }
  const extMatch = relPath.match(/\.(pdf|jpg|jpeg|png|webp)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
  const cleanBase = entry.title.replace(/[\\/:*?"<>|]/g, '-').trim();
  const hasExt = new RegExp(`\\.${ext}$`, 'i').test(cleanBase);
  return {
    href: `${import.meta.env.BASE_URL}${relPath}`,
    downloadName: hasExt ? cleanBase : `${cleanBase}.${ext}`,
    isLocal: true,
  };
}
