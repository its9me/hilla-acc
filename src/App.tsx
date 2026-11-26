import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ExternalLink,
  FolderOpen,
  FolderSync,
  LayoutGrid,
  Link2,
  List,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { DepartmentAIModal } from './components/DepartmentAIModal';
import { FolderPickerModal } from './components/FolderPickerModal';
import { LectureCard } from './components/LectureCard';
import { LectureReaderModal, type ViewerContextItem } from './components/LectureReaderModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  CollegeOfAdminEconLogo,
  UniversityOfHillaCrest,
} from './components/UniversityLogo';
import type {
  DriveCatalog,
  DriveEntry,
  DriveFileCategory,
  FolderListing,
  LectureIndexItem,
  StudyProgressMap,
  SubjectNode,
} from './types/drive';
import { formatSyncTime, normalizeArabic } from './utils/arabic';
import {
  loadSavedFolderId,
  loadStudyProgress,
  loadTheme,
  saveCustomFolderId,
  saveStudyProgress,
  saveTheme,
  type ThemeMode,
} from './utils/storage';

const DEFAULT_ROOT_FOLDER_ID = '1XRkN1f8lmr-rv3cqS0AZpswOCOibiQHP';
const HERO_IMAGE_SRC = `${import.meta.env.BASE_URL}src/assets/images/hero_accounting_library_1795715263542.jpg`;

type ActiveTab = 'all' | 'schedule' | 'saved' | string;
type FileFilterCategory = 'all' | DriveFileCategory;

interface FolderCrumb {
  id: string;
  title: string;
  stageTitle?: string;
}

const CATEGORY_FILTER_LABELS: Record<FileFilterCategory, string> = {
  all: 'الكل',
  pdf: 'PDF',
  image: 'صور',
  video: 'فيديو',
  audio: 'صوتيات',
  presentation: 'عروض تقديمية',
  spreadsheet: 'جداول بيانات',
  document: 'مستندات',
  archive: 'مضغوطة',
  folder: 'مجلدات',
  other: 'أخرى',
};

export default function App() {
  const [rootFolderId, setRootFolderId] = useState<string>(
    () => loadSavedFolderId() || DEFAULT_ROOT_FOLDER_ID
  );
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [catalog, setCatalog] = useState<DriveCatalog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [fileFilter, setFileFilter] = useState<FileFilterCategory>('all');
  const [heroImageError, setHeroImageError] = useState<boolean>(false);

  // Drill-down navigation inside a subject or subfolder
  const [folderTrail, setFolderTrail] = useState<FolderCrumb[]>([]);
  const [activeFolderListing, setActiveFolderListing] = useState<FolderListing | null>(null);
  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Modals & Share feedback
  const [viewerItem, setViewerItem] = useState<ViewerContextItem | null>(null);
  const [viewerPlaylist, setViewerPlaylist] = useState<ViewerContextItem[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [subjectLinkCopied, setSubjectLinkCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  const deepLinkHandledRef = useRef<boolean>(false);
  const staticSubfoldersRef = useRef<Record<string, FolderListing>>({});

  // Study tracking
  const [progress, setProgress] = useState<StudyProgressMap>(() => loadStudyProgress());

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 360);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    saveStudyProgress(progress);
  }, [progress]);

  // Apply Dark Mode class on <html> and update browser theme-color
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    saveTheme(theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0f172a' : '#0f766e');
    }
  }, [theme]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const copyShareUrl = useCallback(
    async (params: Record<string, string>) => {
      try {
        const url = new URL(window.location.href);
        url.search = '';
        for (const [k, v] of Object.entries(params)) {
          if (v) url.searchParams.set(k, v);
        }
        await navigator.clipboard.writeText(url.toString());
        showToast('تم نسخ رابط المشاركة');
      } catch {
        showToast('تعذر نسخ الرابط تلقائياً');
      }
    },
    [showToast]
  );

  // Sync URL query params for Deep Links
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = '';

    if (folderTrail.length > 0) {
      url.searchParams.set('subject', folderTrail[folderTrail.length - 1].id);
    } else if (activeTab !== 'all') {
      url.searchParams.set('tab', activeTab);
    }

    if (viewerItem) {
      url.searchParams.set('lecture', viewerItem.entry.id);
    }

    window.history.replaceState(null, '', url.toString());
  }, [activeTab, folderTrail, viewerItem]);

  const fetchCatalog = useCallback(
    async (folderId: string, bypassCache = false) => {
      try {
        if (bypassCache) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams({ folderId });
        if (bypassCache) params.set('refresh', '1');

        let loadedFromApi = false;
        try {
          const res = await fetch(`/api/drive/catalog?${params.toString()}`);
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'تعذر الاتصال بمجلد Google Drive');
            }
            setCatalog(data as DriveCatalog);
            loadedFromApi = true;
          }
        } catch (apiErr) {
          if (folderId !== DEFAULT_ROOT_FOLDER_ID) {
            throw apiErr;
          }
        }

        if (!loadedFromApi) {
          if (folderId !== DEFAULT_ROOT_FOLDER_ID) {
            throw new Error('تغيير رابط Drive يتطلب تشغيل خادم التطبيق (Node.js).');
          }
          const fallbackRes = await fetch(`${import.meta.env.BASE_URL}catalog-fallback.json`);
          if (!fallbackRes.ok) {
            throw new Error('تعذر الاتصال بفهرس المحاضرات.');
          }
          const fallbackData = (await fallbackRes.json()) as DriveCatalog & {
            subfolderMap?: Record<string, FolderListing>;
          };
          if (fallbackData.subfolderMap) {
            staticSubfoldersRef.current = fallbackData.subfolderMap;
          }
          setCatalog(fallbackData);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء تحميل المحاضرات';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchCatalog(rootFolderId, false);
  }, [fetchCatalog, rootFolderId]);

  const resolveStaticFolder = useCallback(
    (folderId: string): FolderListing | null => {
      if (staticSubfoldersRef.current[folderId]) {
        return staticSubfoldersRef.current[folderId];
      }
      if (!catalog) return null;
      for (const stage of catalog.stages) {
        const matched = stage.subjects.find((s) => s.id === folderId);
        if (matched) {
          return {
            folderId: matched.id,
            folderTitle: matched.title,
            entries: matched.entries,
            fetchedAt: catalog.fetchedAt,
          };
        }
      }
      return null;
    },
    [catalog]
  );

  const openSubfolder = useCallback(
    async (crumb: FolderCrumb, resetTrail = false) => {
      setFolderLoading(true);
      setFolderError(null);
      setFileFilter('all');
      setFolderTrail((prev) => (resetTrail ? [crumb] : [...prev, crumb]));

      try {
        const res = await fetch(`/api/drive/folder/${encodeURIComponent(crumb.id)}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'تعذر فتح هذا المجلد');
          }
          setActiveFolderListing(data as FolderListing);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const fallback = resolveStaticFolder(crumb.id);
        if (fallback) {
          setActiveFolderListing(fallback);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        throw new Error('تعذر فتح هذا المجلد');
      } catch (err) {
        const fallback = resolveStaticFolder(crumb.id);
        if (fallback) {
          setActiveFolderListing(fallback);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setFolderError(err instanceof Error ? err.message : 'تعذر فتح المجلد');
        }
      } finally {
        setFolderLoading(false);
      }
    },
    [resolveStaticFolder]
  );

  // Hydrate initial URL deep-link (?tab=..., ?subject=..., ?lecture=...) once catalog loads
  useEffect(() => {
    if (!catalog || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const subjectParam = params.get('subject');
    const lectureParam = params.get('lecture');

    if (tabParam) {
      setActiveTab(tabParam);
    }

    if (subjectParam) {
      let matchedSubject: SubjectNode | null = null;
      for (const st of catalog.stages) {
        const found = st.subjects.find((s) => s.id === subjectParam);
        if (found) {
          matchedSubject = found;
          break;
        }
      }
      if (matchedSubject) {
        setFolderTrail([
          {
            id: matchedSubject.id,
            title: matchedSubject.title,
            stageTitle: matchedSubject.stageTitle,
          },
        ]);
        setActiveFolderListing({
          folderId: matchedSubject.id,
          folderTitle: matchedSubject.title,
          entries: matchedSubject.entries,
          fetchedAt: catalog.fetchedAt,
        });
      } else {
        openSubfolder({ id: subjectParam, title: 'مجلد مشارك' }, true);
      }
    }

    if (lectureParam) {
      const foundLecture = catalog.allLectures.find((l) => l.id === lectureParam);
      if (foundLecture) {
        const siblings = catalog.allLectures.filter(
          (l) => l.subjectId === foundLecture.subjectId
        );
        setViewerPlaylist(
          siblings.map((s) => ({
            entry: s,
            stageTitle: s.stageTitle,
            subjectTitle: s.subjectTitle,
          }))
        );
        setViewerItem({
          entry: foundLecture,
          stageTitle: foundLecture.stageTitle,
          subjectTitle: foundLecture.subjectTitle,
        });
      } else if (catalog.scheduleFolder) {
        const schedMatch = catalog.scheduleFolder.entries.find((e) => e.id === lectureParam);
        if (schedMatch) {
          setViewerPlaylist(
            catalog.scheduleFolder.entries.map((e) => ({
              entry: e,
              stageTitle: 'الجدول الدراسي',
              subjectTitle: catalog.scheduleFolder!.title,
            }))
          );
          setViewerItem({
            entry: schedMatch,
            stageTitle: 'الجدول الدراسي',
            subjectTitle: catalog.scheduleFolder.title,
          });
        }
      }
    }
  }, [catalog, openSubfolder]);

  const navigateTrailTo = useCallback(
    async (index: number) => {
      setFileFilter('all');
      if (index < 0) {
        setFolderTrail([]);
        setActiveFolderListing(null);
        setFolderError(null);
        return;
      }
      const target = folderTrail[index];
      if (!target) return;
      setFolderTrail(folderTrail.slice(0, index + 1));
      setFolderLoading(true);
      setFolderError(null);
      try {
        const res = await fetch(`/api/drive/folder/${encodeURIComponent(target.id)}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'تعذر فتح المجلد');
          }
          setActiveFolderListing(data as FolderListing);
          return;
        }
        const fallback = resolveStaticFolder(target.id);
        if (fallback) {
          setActiveFolderListing(fallback);
          return;
        }
        throw new Error('تعذر فتح المجلد');
      } catch (err) {
        const fallback = resolveStaticFolder(target.id);
        if (fallback) {
          setActiveFolderListing(fallback);
        } else {
          setFolderError(err instanceof Error ? err.message : 'تعذر فتح المجلد');
        }
      } finally {
        setFolderLoading(false);
      }
    },
    [folderTrail, resolveStaticFolder]
  );

  const handleOpenSubject = (subject: SubjectNode) => {
    setFileFilter('all');
    setFolderTrail([
      {
        id: subject.id,
        title: subject.title,
        stageTitle: subject.stageTitle,
      },
    ]);
    setFolderError(null);
    setActiveFolderListing({
      folderId: subject.id,
      folderTitle: subject.title,
      entries: subject.entries,
      fetchedAt: catalog?.fetchedAt || new Date().toISOString(),
    });
    const section = document.getElementById('lectures-workspace');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenEntry = (
    entry: DriveEntry,
    contextList: ViewerContextItem[],
    stageTitle?: string,
    subjectTitle?: string
  ) => {
    if (entry.isFolder) {
      openSubfolder({ id: entry.id, title: entry.title, stageTitle }, false);
      return;
    }

    setProgress((prev) => ({
      ...prev,
      lastOpenedId: entry.id,
    }));

    setViewerPlaylist(contextList.filter((item) => !item.entry.isFolder));
    setViewerItem({
      entry,
      stageTitle,
      subjectTitle,
    });
  };

  const toggleComplete = (id: string) => {
    setProgress((prev) => {
      const exists = prev.completedIds.includes(id);
      return {
        ...prev,
        completedIds: exists
          ? prev.completedIds.filter((item) => item !== id)
          : [...prev.completedIds, id],
      };
    });
  };

  const toggleBookmark = (id: string) => {
    setProgress((prev) => {
      const exists = prev.bookmarkedIds.includes(id);
      return {
        ...prev,
        bookmarkedIds: exists
          ? prev.bookmarkedIds.filter((item) => item !== id)
          : [...prev.bookmarkedIds, id],
      };
    });
  };

  const updateNote = (id: string, note: string) => {
    setProgress((prev) => {
      const nextNotes = { ...prev.notesById };
      if (note.trim() === '') {
        delete nextNotes[id];
      } else {
        nextNotes[id] = note;
      }
      return {
        ...prev,
        notesById: nextNotes,
      };
    });
  };

  const handleApplyFolder = (newFolderId: string) => {
    saveCustomFolderId(newFolderId === DEFAULT_ROOT_FOLDER_ID ? null : newFolderId);
    setRootFolderId(newFolderId);
    setFolderTrail([]);
    setActiveFolderListing(null);
    setActiveTab('all');
    setSearchQuery('');
    setFileFilter('all');
  };

  const normalizedQuery = useMemo(() => normalizeArabic(searchQuery), [searchQuery]);

  const searchResults = useMemo(() => {
    if (!catalog || !normalizedQuery) return { subjects: [], lectures: [] };

    const matchingSubjects: SubjectNode[] = [];
    for (const stage of catalog.stages) {
      for (const sub of stage.subjects) {
        if (
          normalizeArabic(sub.title).includes(normalizedQuery) ||
          normalizeArabic(stage.title).includes(normalizedQuery)
        ) {
          matchingSubjects.push(sub);
        }
      }
    }

    const matchingLectures: LectureIndexItem[] = catalog.allLectures.filter(
      (lec) =>
        normalizeArabic(lec.title).includes(normalizedQuery) ||
        normalizeArabic(lec.subjectTitle).includes(normalizedQuery) ||
        normalizeArabic(lec.stageTitle).includes(normalizedQuery)
    );

    return { subjects: matchingSubjects, lectures: matchingLectures };
  }, [catalog, normalizedQuery]);

  const savedLectures = useMemo(() => {
    if (!catalog) return [];
    const savedSet = new Set([
      ...progress.bookmarkedIds,
      ...progress.completedIds,
      ...Object.keys(progress.notesById),
    ]);
    return catalog.allLectures.filter((lec) => savedSet.has(lec.id));
  }, [catalog, progress]);

  const completionPercent = useMemo(() => {
    if (!catalog || catalog.allLectures.length === 0) return 0;
    const validIds = new Set(catalog.allLectures.map((l) => l.id));
    const completedCount = progress.completedIds.filter((id) => validIds.has(id)).length;
    return Math.round((completedCount / catalog.allLectures.length) * 100);
  }, [catalog, progress.completedIds]);

  const visibleStages = useMemo(() => {
    if (!catalog) return [];
    if (activeTab === 'all') return catalog.stages;
    return catalog.stages.filter((s) => s.id === activeTab);
  }, [catalog, activeTab]);

  // Available file categories inside active subject folder
  const availableFolderCategories = useMemo<FileFilterCategory[]>(() => {
    if (!activeFolderListing || activeFolderListing.entries.length === 0) return [];
    const set = new Set<DriveFileCategory>(activeFolderListing.entries.map((e) => e.category));
    return ['all', ...Array.from(set)];
  }, [activeFolderListing]);

  const filteredFolderEntries = useMemo(() => {
    if (!activeFolderListing) return [];
    if (fileFilter === 'all') return activeFolderListing.entries;
    return activeFolderListing.entries.filter((e) => e.category === fileFilter);
  }, [activeFolderListing, fileFilter]);

  const availableSearchCategories = useMemo<FileFilterCategory[]>(() => {
    if (searchResults.lectures.length === 0) return [];
    const set = new Set<DriveFileCategory>(searchResults.lectures.map((e) => e.category));
    return ['all', ...Array.from(set)];
  }, [searchResults.lectures]);

  const filteredSearchLectures = useMemo(() => {
    if (fileFilter === 'all') return searchResults.lectures;
    return searchResults.lectures.filter((l) => l.category === fileFilter);
  }, [searchResults.lectures, fileFilter]);

  const jumpToWorkspaceTab = (tab: ActiveTab) => {
    setFolderTrail([]);
    setActiveFolderListing(null);
    setSearchQuery('');
    setFileFilter('all');
    setActiveTab(tab);
    const el = document.getElementById('lectures-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors overflow-x-clip">
      {/* Top Bar Contract: 1 Row, 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              jumpToWorkspaceTab('all');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            محاضرات المحاسبة
          </a>

          {/* Zone 2: 4 Single-line Navigation Links */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => jumpToWorkspaceTab('all')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                activeTab === 'all' && folderTrail.length === 0
                  ? 'text-teal-800 dark:text-teal-400 font-semibold'
                  : ''
              }`}
            >
              المراحل الدراسية
            </button>
            <button
              type="button"
              onClick={() => {
                const firstActiveStage =
                  catalog?.stages.find((s) => s.subjects.length > 0)?.id || 'all';
                jumpToWorkspaceTab(firstActiveStage);
              }}
              className="py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white"
            >
              تصفح المواد
            </button>
            <button
              type="button"
              onClick={() => jumpToWorkspaceTab('schedule')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                activeTab === 'schedule' ? 'text-teal-800 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              جدول المحاضرات
            </button>
            <button
              type="button"
              onClick={() => jumpToWorkspaceTab('saved')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white ${
                activeTab === 'saved' ? 'text-teal-800 dark:text-teal-400 font-semibold' : ''
              }`}
            >
              محفوظاتي
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => fetchCatalog(rootFolderId, true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>تحديث المحتوى</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              {/* Text Column */}
              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                {/* Institutional Logos & Department Lockup */}
                <div className="flex flex-col gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="https://hilla-unc.edu.iq/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="الموقع الرسمي لجامعة الحلة"
                      className="hover:opacity-95 transition-opacity"
                    >
                      <UniversityOfHillaCrest className="h-16 sm:h-20 w-auto" />
                    </a>
                    <a
                      href="https://account.hilla-unc.edu.iq/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="موقع كلية الإدارة والاقتصاد - جامعة الحلة"
                      className="hover:opacity-95 transition-opacity"
                    >
                      <CollegeOfAdminEconLogo className="h-16 sm:h-20 w-auto" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a
                      href="https://hilla-unc.edu.iq/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-teal-800 dark:hover:text-teal-300 transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>جامعة الحلة</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    </a>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <a
                      href="https://account.hilla-unc.edu.iq/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm sm:text-base font-semibold text-teal-800 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 transition-colors"
                    >
                      كلية الإدارة والاقتصاد
                    </a>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      قسم المحاسبة
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 dark:text-slate-100 leading-tight [text-wrap:balance]">
                    كل محاضرات قسم المحاسبة في منصة دراسية واحدة
                  </h1>
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    تصفح محاضرات المراحل الدراسية الأربع وجداول الدوام الصباحي بسهولة، مع قراءة
                    ملفات المحاضرات مباشرة داخل المتصفح، ومشاركة الروابط، وحفظ تقدمك وملاحظاتك.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => jumpToWorkspaceTab('all')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    <span>تصفح المراحل والمواد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => jumpToWorkspaceTab('schedule')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <CalendarDays className="w-4 h-4" aria-hidden="true" />
                    <span>جدول المحاضرات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAIModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>اسأل المساعد الذكي</span>
                  </button>

                  <PWAInstallButton />

                  <button
                    type="button"
                    onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    aria-label={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                        <span>الوضع النهاري</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-slate-600" aria-hidden="true" />
                        <span>الوضع الليلي</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFolderPicker(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    <FolderSync className="w-4 h-4" aria-hidden="true" />
                    <span>تغيير رابط Drive</span>
                  </button>
                </div>
              </div>

              {/* Media Column */}
              <div className="lg:col-span-5">
                <div className="relative h-64 sm:h-80 lg:h-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  {!heroImageError ? (
                    <img
                      src={HERO_IMAGE_SRC}
                      alt="بيئة دراسة جامعية لمحاضرات قسم المحاسبة"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImageError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 to-teal-50 dark:from-slate-800 dark:to-slate-900 p-6 text-center">
                      <BookOpen className="w-10 h-10 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        أرشيف محاضرات قسم المحاسبة
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4-Column Summary Strip directly below hero */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">المراحل الدراسية</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {loading ? '—' : `${catalog?.stages.length ?? 0} مراحل`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">المواد المتوفرة</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {loading ? '—' : `${catalog?.totalSubjects ?? 0} مادة`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">المحاضرات والملفات</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                  {loading ? '—' : `${catalog?.totalFiles ?? 0} ملف`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">نسبة إنجازك</p>
                <p className="text-2xl font-bold text-teal-800 dark:text-teal-400 mt-1 tabular-nums">
                  {loading ? '—' : `${completionPercent}%`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Workspace Section */}
        <section
          id="lectures-workspace"
          className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8"
        >
          {/* Workspace Filter & Search Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Stage Segmented Filter Tabs */}
            <div
              role="tablist"
              aria-label="تصفية حسب المرحلة"
              className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl overflow-x-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all' && folderTrail.length === 0}
                onClick={() => {
                  setFolderTrail([]);
                  setActiveFolderListing(null);
                  setFileFilter('all');
                  setActiveTab('all');
                }}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'all' && folderTrail.length === 0
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                جميع المراحل
              </button>

              {catalog?.stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === stage.id && folderTrail.length === 0}
                  onClick={() => {
                    setFolderTrail([]);
                    setActiveFolderListing(null);
                    setFileFilter('all');
                    setActiveTab(stage.id);
                  }}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === stage.id && folderTrail.length === 0
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {stage.title}
                </button>
              ))}

              {catalog?.scheduleFolder && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'schedule' && folderTrail.length === 0}
                  onClick={() => {
                    setFolderTrail([]);
                    setActiveFolderListing(null);
                    setFileFilter('all');
                    setActiveTab('schedule');
                  }}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'schedule' && folderTrail.length === 0
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  جدول المحاضرات
                </button>
              )}

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'saved' && folderTrail.length === 0}
                onClick={() => {
                  setFolderTrail([]);
                  setActiveFolderListing(null);
                  setFileFilter('all');
                  setActiveTab('saved');
                }}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'saved' && folderTrail.length === 0
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                محفوظاتي ({savedLectures.length})
              </button>
            </div>

            {/* Search & View Mode Controls */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1 sm:w-72 lg:w-80">
                <Search
                  className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setFileFilter('all');
                  }}
                  placeholder="ابحث عن مادة أو محاضرة..."
                  aria-label="ابحث عن مادة أو محاضرة"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-10 pl-9 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFileFilter('all');
                    }}
                    aria-label="مسح البحث"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="عرض شبكي"
                  title="عرض شبكي"
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="عرض قائمة"
                  title="عرض قائمة"
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-36 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  <div className="h-8 w-1/3 bg-slate-100 dark:bg-slate-800/60 rounded mt-4" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  تعذر تحميل المحاضرات
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchCatalog(rootFolderId, true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  إعادة المحاولة
                </button>
                {rootFolderId !== DEFAULT_ROOT_FOLDER_ID && (
                  <button
                    type="button"
                    onClick={() => handleApplyFolder(DEFAULT_ROOT_FOLDER_ID)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    العودة للمجلد الافتراضي
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search Results Mode */}
          {!loading && !error && normalizedQuery && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  نتائج البحث عن «{searchQuery}»
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {searchResults.subjects.length} مادة · {searchResults.lectures.length} محاضرة
                </span>
              </div>

              {searchResults.subjects.length === 0 && searchResults.lectures.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    لم يتم العثور على نتائج مطابقة
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    جرب البحث باسم مادة أخرى مثل «محاسبة شركات» أو «تكاليف» أو «ضريبية».
                  </p>
                </div>
              ) : (
                <>
                  {searchResults.subjects.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        المواد الدراسية
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.subjects.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              handleOpenSubject(sub);
                            }}
                            className="group text-right flex items-start justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-600/50 dark:hover:border-teal-500/50 transition-colors"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 truncate">
                                {sub.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{sub.stageTitle}</span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {sub.fileCount + sub.subfolderCount} عنصر
                                </span>
                              </div>
                            </div>
                            <ChevronLeft className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-teal-700 dark:group-hover:text-teal-400 shrink-0 mt-0.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.lectures.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          المحاضرات والملفات
                        </h3>
                        {availableSearchCategories.length > 2 && (
                          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg overflow-x-auto">
                            {availableSearchCategories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setFileFilter(cat)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                  fileFilter === cat
                                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                                }`}
                              >
                                {CATEGORY_FILTER_LABELS[cat]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        className={
                          viewMode === 'grid'
                            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                            : 'space-y-3'
                        }
                      >
                        {filteredSearchLectures.map((lec) => (
                          <LectureCard
                            key={lec.id}
                            entry={lec}
                            contextLabel={`${lec.stageTitle} · ${lec.subjectTitle}`}
                            viewMode={viewMode}
                            isCompleted={progress.completedIds.includes(lec.id)}
                            isBookmarked={progress.bookmarkedIds.includes(lec.id)}
                            hasNote={Boolean(progress.notesById[lec.id])}
                            onOpen={(entry) =>
                              handleOpenEntry(
                                entry,
                                filteredSearchLectures.map((l) => ({
                                  entry: l,
                                  stageTitle: l.stageTitle,
                                  subjectTitle: l.subjectTitle,
                                })),
                                lec.stageTitle,
                                lec.subjectTitle
                              )
                            }
                            onToggleComplete={toggleComplete}
                            onToggleBookmark={toggleBookmark}
                            onCopyLink={(entry) =>
                              copyShareUrl({ subject: lec.subjectId, lecture: entry.id })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Subject / Subfolder Drill-Down Mode */}
          {!loading && !error && !normalizedQuery && folderTrail.length > 0 && (
            <div className="space-y-6">
              {/* Breadcrumb & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => navigateTrailTo(-1)}
                    className="inline-flex items-center gap-1.5 text-teal-800 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium"
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    <span>جميع المراحل</span>
                  </button>
                  {folderTrail[0]?.stageTitle && (
                    <>
                      <span className="text-slate-400 dark:text-slate-600">/</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {folderTrail[0].stageTitle}
                      </span>
                    </>
                  )}
                  {folderTrail.map((crumb, idx) => (
                    <span key={crumb.id} className="inline-flex items-center gap-2">
                      <span className="text-slate-400 dark:text-slate-600">/</span>
                      <button
                        type="button"
                        onClick={() => navigateTrailTo(idx)}
                        className={`transition-colors ${
                          idx === folderTrail.length - 1
                            ? 'font-bold text-slate-900 dark:text-slate-100'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {crumb.title}
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentId = folderTrail[folderTrail.length - 1].id;
                      copyShareUrl({ subject: currentId });
                      setSubjectLinkCopied(true);
                      window.setTimeout(() => setSubjectLinkCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {subjectLinkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>تم نسخ رابط المادة</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>نسخ رابط المادة</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://drive.google.com/drive/folders/${
                      folderTrail[folderTrail.length - 1].id
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>فتح المجلد في Drive</span>
                  </a>
                </div>
              </div>

              {/* File Type Filter Strip */}
              {availableFolderCategories.length > 2 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-400">نوع الملف:</span>
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg overflow-x-auto">
                    {availableFolderCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFileFilter(cat)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          fileFilter === cat
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {CATEGORY_FILTER_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {folderLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
                    />
                  ))}
                </div>
              ) : folderError ? (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                    {folderError}
                  </p>
                </div>
              ) : activeFolderListing && activeFolderListing.entries.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-2">
                  <FolderOpen
                    className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    لا توجد محاضرات مرفوعة في هذا المجلد حالياً
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ستظهر المحاضرات هنا فور رفعها إلى مجلد Google Drive.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                      : 'space-y-3'
                  }
                >
                  {filteredFolderEntries.map((entry) => {
                    const currentSubjectId = folderTrail[folderTrail.length - 1]?.id;
                    const contextList: ViewerContextItem[] = filteredFolderEntries
                      .filter((e) => !e.isFolder)
                      .map((e) => ({
                        entry: e,
                        stageTitle: folderTrail[0]?.stageTitle,
                        subjectTitle: folderTrail[folderTrail.length - 1]?.title,
                      }));
                    return (
                      <LectureCard
                        key={entry.id}
                        entry={entry}
                        contextLabel={folderTrail[folderTrail.length - 1]?.title}
                        viewMode={viewMode}
                        isCompleted={progress.completedIds.includes(entry.id)}
                        isBookmarked={progress.bookmarkedIds.includes(entry.id)}
                        hasNote={Boolean(progress.notesById[entry.id])}
                        onOpen={(clicked) =>
                          handleOpenEntry(
                            clicked,
                            contextList,
                            folderTrail[0]?.stageTitle,
                            folderTrail[folderTrail.length - 1]?.title
                          )
                        }
                        onToggleComplete={toggleComplete}
                        onToggleBookmark={toggleBookmark}
                        onCopyLink={
                          entry.isFolder
                            ? undefined
                            : (clicked) =>
                                copyShareUrl({
                                  subject: currentSubjectId,
                                  lecture: clicked.id,
                                })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Schedule View */}
          {!loading &&
            !error &&
            !normalizedQuery &&
            folderTrail.length === 0 &&
            activeTab === 'schedule' &&
            catalog?.scheduleFolder && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {catalog.scheduleFolder.title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      اضغط على الجدول للمعاينة بالحجم الكامل أو التحميل المباشر
                    </p>
                  </div>
                  <a
                    href={catalog.scheduleFolder.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>فتح في Google Drive</span>
                  </a>
                </div>

                {catalog.scheduleFolder.entries.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    لا توجد ملفات جدول مضافة حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {catalog.scheduleFolder.entries.map((entry) => (
                      <LectureCard
                        key={entry.id}
                        entry={entry}
                        contextLabel="الجدول الرسمي"
                        viewMode="grid"
                        isCompleted={progress.completedIds.includes(entry.id)}
                        isBookmarked={progress.bookmarkedIds.includes(entry.id)}
                        hasNote={Boolean(progress.notesById[entry.id])}
                        onOpen={(clicked) =>
                          handleOpenEntry(
                            clicked,
                            catalog.scheduleFolder!.entries.map((e) => ({
                              entry: e,
                              subjectTitle: catalog.scheduleFolder!.title,
                            })),
                            'الجدول الدراسي',
                            catalog.scheduleFolder!.title
                          )
                        }
                        onToggleComplete={toggleComplete}
                        onToggleBookmark={toggleBookmark}
                        onCopyLink={(clicked) =>
                          copyShareUrl({ tab: 'schedule', lecture: clicked.id })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Saved & Studied Progress View */}
          {!loading &&
            !error &&
            !normalizedQuery &&
            folderTrail.length === 0 &&
            activeTab === 'saved' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      محفوظاتي وتقدمي الدراسي
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      جميع المحاضرات التي قمت بحفظها أو إكمال دراستها أو تدوين ملاحظات عليها
                    </p>
                  </div>
                </div>

                {savedLectures.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-3">
                    <BookOpen
                      className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto"
                      aria-hidden="true"
                    />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      قائمة المحفوظات فارغة حالياً
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      عند تصفح أي محاضرة، يمكنك الضغط على أيقونة الحفظ أو تحديدها كمكتملة لتظهر
                      هنا للرجوع السريع.
                    </p>
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                        : 'space-y-3'
                    }
                  >
                    {savedLectures.map((lec) => (
                      <LectureCard
                        key={lec.id}
                        entry={lec}
                        contextLabel={`${lec.stageTitle} · ${lec.subjectTitle}`}
                        viewMode={viewMode}
                        isCompleted={progress.completedIds.includes(lec.id)}
                        isBookmarked={progress.bookmarkedIds.includes(lec.id)}
                        hasNote={Boolean(progress.notesById[lec.id])}
                        onOpen={(clicked) =>
                          handleOpenEntry(
                            clicked,
                            savedLectures.map((l) => ({
                              entry: l,
                              stageTitle: l.stageTitle,
                              subjectTitle: l.subjectTitle,
                            })),
                            lec.stageTitle,
                            lec.subjectTitle
                          )
                        }
                        onToggleComplete={toggleComplete}
                        onToggleBookmark={toggleBookmark}
                        onCopyLink={(clicked) =>
                          copyShareUrl({ subject: lec.subjectId, lecture: clicked.id })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          {/* Stages & Subjects Directory */}
          {!loading &&
            !error &&
            !normalizedQuery &&
            folderTrail.length === 0 &&
            activeTab !== 'schedule' &&
            activeTab !== 'saved' &&
            catalog && (
              <div className="space-y-10">
                {visibleStages.map((stage) => (
                  <section key={stage.id} className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {stage.title}
                        </h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {stage.subjects.length} مادة · {stage.totalFiles} ملف
                        </span>
                      </div>
                      <a
                        href={stage.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300"
                      >
                        <span>فتح مجلد المرحلة</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </div>

                    {stage.subjects.length === 0 && stage.directFiles.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-8 text-center space-y-1.5">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          لا توجد محاضرات مرفوعة في {stage.title} حتى الآن
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          بمجرد إضافة مواد أو محاضرات داخل مجلد {stage.title} على Google Drive،
                          ستظهر هنا تلقائياً عند التحديث.
                        </p>
                      </div>
                    ) : (
                      <>
                        {stage.subjects.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stage.subjects.map((subject) => {
                              const completedInSubject = subject.entries.filter(
                                (e) => !e.isFolder && progress.completedIds.includes(e.id)
                              ).length;
                              return (
                                <button
                                  key={subject.id}
                                  type="button"
                                  onClick={() => handleOpenSubject(subject)}
                                  className="group text-right flex flex-col justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-600/50 dark:hover:border-teal-500/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                                >
                                  <div className="flex items-start justify-between gap-3 w-full">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900/70 text-teal-700 dark:text-teal-400 shrink-0">
                                      <FolderOpen className="w-5 h-5" aria-hidden="true" />
                                    </div>
                                    <ChevronLeft
                                      className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors shrink-0"
                                      aria-hidden="true"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors leading-snug">
                                      {subject.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="tabular-nums">
                                        {subject.fileCount > 0
                                          ? `${subject.fileCount} محاضرة`
                                          : subject.subfolderCount > 0
                                          ? `${subject.subfolderCount} مجلد فرعي`
                                          : 'مجلد فارغ حالياً'}
                                      </span>
                                      {subject.modified && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono tabular-nums">
                                            {subject.modified}
                                          </span>
                                        </>
                                      )}
                                      {completedInSubject > 0 && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">
                                            أُنجز {completedInSubject}/{subject.fileCount}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {stage.directFiles.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
                            {stage.directFiles.map((file) => (
                              <LectureCard
                                key={file.id}
                                entry={file}
                                contextLabel={stage.title}
                                viewMode={viewMode}
                                isCompleted={progress.completedIds.includes(file.id)}
                                isBookmarked={progress.bookmarkedIds.includes(file.id)}
                                hasNote={Boolean(progress.notesById[file.id])}
                                onOpen={(clicked) =>
                                  handleOpenEntry(
                                    clicked,
                                    stage.directFiles.map((f) => ({
                                      entry: f,
                                      stageTitle: stage.title,
                                    })),
                                    stage.title
                                  )
                                }
                                onToggleComplete={toggleComplete}
                                onToggleBookmark={toggleBookmark}
                                onCopyLink={(clicked) =>
                                  copyShareUrl({ tab: stage.id, lecture: clicked.id })
                                }
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                ))}

                {/* Loose files in root if any */}
                {activeTab === 'all' && catalog.looseFiles.length > 0 && (
                  <section className="space-y-4">
                    <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        ملفات عامة
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {catalog.looseFiles.map((file) => (
                        <LectureCard
                          key={file.id}
                          entry={file}
                          viewMode={viewMode}
                          isCompleted={progress.completedIds.includes(file.id)}
                          isBookmarked={progress.bookmarkedIds.includes(file.id)}
                          hasNote={Boolean(progress.notesById[file.id])}
                          onOpen={(clicked) =>
                            handleOpenEntry(
                              clicked,
                              catalog.looseFiles.map((f) => ({ entry: f }))
                            )
                          }
                          onToggleComplete={toggleComplete}
                          onToggleBookmark={toggleBookmark}
                          onCopyLink={(clicked) => copyShareUrl({ lecture: clicked.id })}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Highlight Schedule Strip on 'all' view */}
                {activeTab === 'all' && catalog.scheduleFolder && (
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900/70 text-teal-700 dark:text-teal-400 shrink-0">
                        <CalendarDays className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {catalog.scheduleFolder.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          اعرض جدول المحاضرات الأسبوعي الصباحي للمراحل الثانية والثالثة والرابعة
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToWorkspaceTab('schedule')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>عرض الجدول</span>
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </section>
                )}
              </div>
            )}
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <UniversityOfHillaCrest className="h-10 w-auto" />
              <CollegeOfAdminEconLogo className="h-10 w-auto" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                جامعة الحلة · كلية الإدارة والاقتصاد · قسم المحاسبة
              </span>
              {catalog?.fetchedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>آخر تحديث {formatSyncTime(catalog.fetchedAt)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://hilla-unc.edu.iq/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors inline-flex items-center gap-1"
            >
              <span>موقع الجامعة</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://account.hilla-unc.edu.iq/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors inline-flex items-center gap-1"
            >
              <span>كلية الإدارة والاقتصاد</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={`https://drive.google.com/drive/folders/${rootFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors inline-flex items-center gap-1"
            >
              <span>المجلد الرسمي على Google Drive</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>

      {/* Integrated Lecture Reader Modal */}
      {viewerItem && (
        <LectureReaderModal
          item={viewerItem}
          playlist={viewerPlaylist}
          catalog={catalog}
          isCompleted={progress.completedIds.includes(viewerItem.entry.id)}
          isBookmarked={progress.bookmarkedIds.includes(viewerItem.entry.id)}
          note={progress.notesById[viewerItem.entry.id] || ''}
          onClose={() => setViewerItem(null)}
          onSelectItem={(next) => {
            setProgress((prev) => ({ ...prev, lastOpenedId: next.entry.id }));
            setViewerItem(next);
          }}
          onToggleComplete={toggleComplete}
          onToggleBookmark={toggleBookmark}
          onChangeNote={updateNote}
          onCopyLink={(id) => {
            const subjectId = folderTrail[folderTrail.length - 1]?.id;
            copyShareUrl(subjectId ? { subject: subjectId, lecture: id } : { lecture: id });
          }}
        />
      )}

      {/* Department-Wide Gemini AI Assistant Modal */}
      {showAIModal && (
        <DepartmentAIModal catalog={catalog} onClose={() => setShowAIModal(false)} />
      )}

      {/* Custom Folder Picker Modal */}
      {showFolderPicker && (
        <FolderPickerModal
          currentFolderId={rootFolderId}
          defaultFolderId={DEFAULT_ROOT_FOLDER_ID}
          onClose={() => setShowFolderPicker(false)}
          onApplyFolder={handleApplyFolder}
        />
      )}

      {/* Floating Scroll to Top Button */}
      {showScrollTop && !viewerItem && !showAIModal && !showFolderPicker && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="العودة إلى الأعلى"
          title="العودة إلى الأعلى"
          className="fixed bottom-5 left-5 z-30 inline-flex items-center justify-center w-11 h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-lg border border-teal-600/30 transition-colors"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* Offline Status & Copy Toast */}
      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-xs font-medium shadow-lg"
        >
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
