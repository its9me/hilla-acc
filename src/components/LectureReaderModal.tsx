import { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Link2,
  Maximize2,
  Minimize2,
  NotebookPen,
  Sparkles,
  X,
} from 'lucide-react';
import type { DriveCatalog, DriveEntry } from '../types/drive';
import { getLectureDownloadProps, getLocalLectureUrl } from '../utils/lectures';
import { FileTypeIcon } from './FileTypeIcon';
import { LectureAIAssistant } from './LectureAIAssistant';

export interface ViewerContextItem {
  entry: DriveEntry;
  stageTitle?: string;
  subjectTitle?: string;
}

interface LectureReaderModalProps {
  item: ViewerContextItem;
  playlist: ViewerContextItem[];
  catalog?: DriveCatalog | null;
  isCompleted: boolean;
  isBookmarked: boolean;
  note: string;
  onClose: () => void;
  onSelectItem: (item: ViewerContextItem) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onChangeNote: (id: string, note: string) => void;
  onCopyLink: (id: string) => void;
}

export function LectureReaderModal({
  item,
  playlist,
  catalog = null,
  isCompleted,
  isBookmarked,
  note,
  onClose,
  onSelectItem,
  onToggleComplete,
  onToggleBookmark,
  onChangeNote,
  onCopyLink,
}: LectureReaderModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [panelTab, setPanelTab] = useState<'ai' | 'notes'>('ai');
  const [useDriveViewer, setUseDriveViewer] = useState(false);

  const localUrl = getLocalLectureUrl(item.entry.id);
  const downloadProps = getLectureDownloadProps(item.entry);

  const currentIndex = playlist.findIndex((p) => p.entry.id === item.entry.id);
  const prevItem = currentIndex > 0 ? playlist[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < playlist.length - 1 ? playlist[currentIndex + 1] : null;

  useEffect(() => {
    setIframeLoaded(false);
    setLinkCopied(false);
    setUseDriveViewer(false);
  }, [item.entry.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleNoteInput = (value: string) => {
    onChangeNote(item.entry.id, value);
    setNoteSavedNotice(true);
    window.setTimeout(() => setNoteSavedNotice(false), 1500);
  };

  const handleShareClick = () => {
    onCopyLink(item.entry.id);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.entry.title}
    >
      <div
        className={`relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-200 ${
          expanded
            ? 'w-full h-full rounded-none'
            : 'w-full h-full sm:h-[90vh] sm:max-w-7xl sm:rounded-2xl'
        }`}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
              <FileTypeIcon category={item.entry.category} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {item.entry.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                {item.stageTitle && <span>{item.stageTitle}</span>}
                {item.stageTitle && item.subjectTitle && <span aria-hidden="true">·</span>}
                {item.subjectTitle && <span>{item.subjectTitle}</span>}
                {item.entry.modified && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.entry.modified}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">نسخ الرابط</span>
                </>
              )}
            </button>

            <a
              href={downloadProps.href}
              download={downloadProps.downloadName}
              target={downloadProps.isLocal ? undefined : '_blank'}
              rel={downloadProps.isLocal ? undefined : 'noopener noreferrer'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>تحميل</span>
            </a>

            {localUrl && (
              <button
                type="button"
                onClick={() => {
                  setIframeLoaded(false);
                  setUseDriveViewer((v) => !v);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>{useDriveViewer ? 'العرض السريع' : 'عارض Drive'}</span>
              </button>
            )}

            <a
              href={localUrl && !useDriveViewer ? localUrl : item.entry.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span>{localUrl && !useDriveViewer ? 'فتح مباشر' : 'فتح في Drive'}</span>
            </a>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="hidden lg:inline-flex items-center justify-center w-9 h-9 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label={expanded ? 'تصغير النافذة' : 'ملء الشاشة'}
              title={expanded ? 'تصغير النافذة' : 'ملء الشاشة'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-9 h-9 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-Zone Split Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden overscroll-contain">
          {/* Interactive Preview Stage */}
          <div className="relative h-[42vh] min-h-[250px] lg:h-auto lg:flex-1 bg-slate-100 dark:bg-slate-950 lg:min-h-0 shrink-0 lg:shrink">
            {localUrl && !useDriveViewer && item.entry.category === 'image' ? (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
                <img
                  src={localUrl}
                  alt={item.entry.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              </div>
            ) : (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 z-10">
                    <div className="w-8 h-8 border-2 border-teal-700 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      جاري تحميل معاينة المحاضرة...
                    </p>
                  </div>
                )}
                <iframe
                  key={`${item.entry.id}-${useDriveViewer ? 'drive' : 'local'}`}
                  src={localUrl && !useDriveViewer ? localUrl : item.entry.previewUrl}
                  title={item.entry.title}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen"
                  onLoad={() => setIframeLoaded(true)}
                />
              </>
            )}
          </div>

          {/* Study Companion Side Deck */}
          <aside className="w-full lg:w-96 xl:w-[26rem] border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 min-h-[420px] lg:min-h-0 lg:h-full overflow-hidden">
            <div className="p-4 sm:p-5 space-y-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              {/* Navigation within playlist */}
              {playlist.length > 1 && (
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!prevItem}
                    onClick={() => prevItem && onSelectItem(prevItem)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    <span>السابقة</span>
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {currentIndex + 1} / {playlist.length}
                  </span>
                  <button
                    type="button"
                    disabled={!nextItem}
                    onClick={() => nextItem && onSelectItem(nextItem)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
                  >
                    <span>التالية</span>
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Study Action Controls */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleComplete(item.entry.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  )}
                  <span>{isCompleted ? 'تمت الدراسة' : 'تحديد كمكتملة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleBookmark(item.entry.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    isBookmarked
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Bookmark
                    className={`w-4 h-4 shrink-0 ${
                      isBookmarked
                        ? 'fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{isBookmarked ? 'في المحفوظات' : 'حفظ للمراجعة'}</span>
                </button>
              </div>

              {/* Segmented Companion Switch */}
              <div
                role="tablist"
                aria-label="أدوات دراسة المحاضرة"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === 'ai'}
                  onClick={() => setPanelTab('ai')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    panelTab === 'ai'
                      ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>المساعد الذكي</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === 'notes'}
                  onClick={() => setPanelTab('notes')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    panelTab === 'notes'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>ملاحظاتك</span>
                </button>
              </div>
            </div>

            {/* Active Companion Tab Panel */}
            <div className="flex-1 min-h-0 p-4 sm:p-5 flex flex-col overflow-hidden">
              {panelTab === 'ai' ? (
                <LectureAIAssistant
                  compact
                  catalog={catalog}
                  lecture={{
                    id: item.entry.id,
                    title: item.entry.title,
                    subjectTitle: item.subjectTitle,
                    stageTitle: item.stageTitle,
                    mimeType: item.entry.mimeType,
                    fileTypeLabel: item.entry.fileTypeLabel,
                  }}
                />
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="lecture-study-notes"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      ملاحظاتك الشخصية
                    </label>
                    {noteSavedNotice && (
                      <span className="text-xs text-teal-700 dark:text-teal-400">
                        تم الحفظ تلقائياً
                      </span>
                    )}
                  </div>
                  <textarea
                    id="lecture-study-notes"
                    rows={8}
                    value={note}
                    onChange={(e) => handleNoteInput(e.target.value)}
                    placeholder="اكتب ملخصاً أو أسئلة للمراجعة حول هذه المحاضرة..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15 resize-none"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تُحفظ الملاحظات محلياً على جهازك لسهولة الرجوع إليها لاحقاً.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
