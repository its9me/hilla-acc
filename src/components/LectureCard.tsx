import { useState } from 'react';
import {
  Bookmark,
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Link2,
} from 'lucide-react';
import type { DriveEntry } from '../types/drive';
import { getLectureDownloadProps, getLocalLectureUrl } from '../utils/lectures';
import { FileTypeIcon, getCategorySurfaceClass } from './FileTypeIcon';

interface LectureCardProps {
  entry: DriveEntry;
  contextLabel?: string;
  viewMode: 'grid' | 'list';
  isCompleted: boolean;
  isBookmarked: boolean;
  hasNote: boolean;
  onOpen: (entry: DriveEntry) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onCopyLink?: (entry: DriveEntry) => void;
}

export function LectureCard({
  entry,
  contextLabel,
  viewMode,
  isCompleted,
  isBookmarked,
  hasNote,
  onOpen,
  onToggleComplete,
  onToggleBookmark,
  onCopyLink,
}: LectureCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const downloadProps = getLectureDownloadProps(entry);
  const localThumbUrl =
    entry.category === 'image' ? getLocalLectureUrl(entry.id) : null;
  const resolvedThumbUrl = localThumbUrl || entry.thumbnailUrl;

  const handleCopy = () => {
    if (!onCopyLink) return;
    onCopyLink(entry);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (viewMode === 'list') {
    return (
      <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-teal-600/45 dark:hover:border-teal-500/50 transition-colors">
        <button
          type="button"
          onClick={() => onOpen(entry)}
          className="flex items-center gap-4 text-right min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg"
        >
          <div
            className={`flex items-center justify-center w-11 h-11 rounded-lg border shrink-0 ${getCategorySurfaceClass(
              entry.category
            )}`}
          >
            <FileTypeIcon category={entry.category} className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors truncate">
              {entry.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>{entry.fileTypeLabel}</span>
              {contextLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-52">{contextLabel}</span>
                </>
              )}
              {entry.modified && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{entry.modified}</span>
                </>
              )}
              {!entry.isFolder && isCompleted && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    تمت الدراسة
                  </span>
                </>
              )}
              {!entry.isFolder && hasNote && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-teal-700 dark:text-teal-400">تحتوي ملاحظة</span>
                </>
              )}
            </div>
          </div>
        </button>

        {!entry.isFolder ? (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => onToggleComplete(entry.id)}
              title={isCompleted ? 'إلغاء تحديد كمكتملة' : 'تحديد كمكتملة'}
              aria-label={isCompleted ? 'إلغاء تحديد كمكتملة' : 'تحديد كمكتملة'}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                isCompleted
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onToggleBookmark(entry.id)}
              title={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المحاضرة'}
              aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المحاضرة'}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                isBookmarked
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  isBookmarked ? 'fill-amber-600 dark:fill-amber-400' : ''
                }`}
              />
            </button>

            {onCopyLink && (
              <button
                type="button"
                onClick={handleCopy}
                title="نسخ رابط المشاركة"
                aria-label="نسخ رابط المشاركة"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
              </button>
            )}

            <a
              href={downloadProps.href}
              download={downloadProps.downloadName}
              target={downloadProps.isLocal ? undefined : '_blank'}
              rel={downloadProps.isLocal ? undefined : 'noopener noreferrer'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>تحميل</span>
            </a>

            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>معاينة</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(entry)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0 self-end sm:self-center"
          >
            <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>فتح المجلد</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <article className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-teal-600/45 dark:hover:border-teal-500/50 transition-colors">
      {/* Preview Thumbnail Slot */}
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 overflow-hidden text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        {resolvedThumbUrl && !thumbFailed ? (
          <img
            src={resolvedThumbUrl}
            alt={entry.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4">
            <div
              className={`flex items-center justify-center w-14 h-14 rounded-xl border ${getCategorySurfaceClass(
                entry.category
              )}`}
            >
              {entry.isFolder ? (
                <FolderOpen className="w-7 h-7 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              ) : (
                <FileTypeIcon category={entry.category} className="w-7 h-7" />
              )}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {entry.fileTypeLabel}
            </span>
          </div>
        )}
      </button>

      {/* Card Body */}
      <div className="flex-1 flex flex-col justify-between p-4 gap-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onOpen(entry)}
            className="text-right w-full focus-visible:outline-none"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors line-clamp-2 leading-snug">
              {entry.title}
            </h3>
          </button>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{entry.fileTypeLabel}</span>
            {contextLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-44">{contextLabel}</span>
              </>
            )}
            {entry.modified && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{entry.modified}</span>
              </>
            )}
            {!entry.isFolder && isCompleted && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">مكتملة</span>
              </>
            )}
            {!entry.isFolder && hasNote && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-teal-700 dark:text-teal-400 inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" aria-hidden="true" />
                  <span>ملاحظة</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {!entry.isFolder ? (
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleComplete(entry.id)}
                title={isCompleted ? 'إلغاء تحديد كمكتملة' : 'تحديد كمكتملة'}
                aria-label={isCompleted ? 'إلغاء تحديد كمكتملة' : 'تحديد كمكتملة'}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                  isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onToggleBookmark(entry.id)}
                title={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المحاضرة'}
                aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المحاضرة'}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                  isBookmarked
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    isBookmarked ? 'fill-amber-600 dark:fill-amber-400' : ''
                  }`}
                />
              </button>

              {onCopyLink && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title="نسخ رابط المشاركة"
                  aria-label="نسخ رابط المشاركة"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <a
                href={downloadProps.href}
                download={downloadProps.downloadName}
                target={downloadProps.isLocal ? undefined : '_blank'}
                rel={downloadProps.isLocal ? undefined : 'noopener noreferrer'}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تحميل</span>
              </a>

              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>قراءة</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              <span>فتح المجلد الفرعي</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
