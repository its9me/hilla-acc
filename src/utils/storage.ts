import type { StudyProgressMap } from '../types/drive';

const STORAGE_KEY = 'accounting_lectures_progress_v1';
const CUSTOM_FOLDER_KEY = 'accounting_lectures_folder_id_v1';
const THEME_KEY = 'accounting_lectures_theme_v1';

export type ThemeMode = 'light' | 'dark';

const DEFAULT_PROGRESS: StudyProgressMap = {
  completedIds: [],
  bookmarkedIds: [],
  notesById: {},
  lastOpenedId: null,
};

export function loadStudyProgress(): StudyProgressMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<StudyProgressMap>;
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      bookmarkedIds: Array.isArray(parsed.bookmarkedIds) ? parsed.bookmarkedIds : [],
      notesById:
        parsed.notesById && typeof parsed.notesById === 'object' ? parsed.notesById : {},
      lastOpenedId: typeof parsed.lastOpenedId === 'string' ? parsed.lastOpenedId : null,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveStudyProgress(progress: StudyProgressMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedFolderId(): string | null {
  try {
    return window.localStorage.getItem(CUSTOM_FOLDER_KEY);
  } catch {
    return null;
  }
}

export function saveCustomFolderId(folderId: string | null): void {
  try {
    if (folderId) {
      window.localStorage.setItem(CUSTOM_FOLDER_KEY, folderId);
    } else {
      window.localStorage.removeItem(CUSTOM_FOLDER_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}
