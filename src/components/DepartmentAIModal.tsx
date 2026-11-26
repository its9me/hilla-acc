import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { DriveCatalog } from '../types/drive';
import { LectureAIAssistant, type AILectureContext } from './LectureAIAssistant';

interface DepartmentAIModalProps {
  catalog: DriveCatalog | null;
  onClose: () => void;
}

export function DepartmentAIModal({ catalog, onClose }: DepartmentAIModalProps) {
  const [selectedLectureId, setSelectedLectureId] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const selectedLecture = useMemo<AILectureContext | null>(() => {
    if (!catalog || !selectedLectureId) return null;
    const match = catalog.allLectures.find((l) => l.id === selectedLectureId);
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      subjectTitle: match.subjectTitle,
      stageTitle: match.stageTitle,
      mimeType: match.mimeType,
      fileTypeLabel: match.fileTypeLabel,
    };
  }, [catalog, selectedLectureId]);

  const groupedLectures = useMemo(() => {
    if (!catalog) return [];
    const groups: Array<{
      groupLabel: string;
      items: Array<{ id: string; title: string }>;
    }> = [];

    for (const stage of catalog.stages) {
      for (const subject of stage.subjects) {
        const files = subject.entries.filter((e) => !e.isFolder);
        if (files.length > 0) {
          groups.push({
            groupLabel: `${stage.title} — ${subject.title}`,
            items: files.map((f) => ({ id: f.id, title: f.title })),
          });
        }
      }
      if (stage.directFiles.length > 0) {
        groups.push({
          groupLabel: stage.title,
          items: stage.directFiles.map((f) => ({ id: f.id, title: f.title })),
        });
      }
    }
    return groups;
  }, [catalog]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="المساعد الذكي للمحاضرات"
    >
      <div className="w-full h-full sm:h-[85vh] sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-100 dark:border-teal-900/70 text-teal-700 dark:text-teal-400 shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                المساعد الذكي للمحاضرات (Gemini AI)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                اسأل عن أي محاضرة أو اطلب شرحاً وتلخيصاً للقيود والمفاهيم المحاسبية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المساعد الذكي"
            className="inline-flex items-center justify-center w-9 h-9 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional Lecture Selector */}
        {groupedLectures.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label
                htmlFor="ai-lecture-picker"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                اختر محاضرة للشرح:
              </label>
              <select
                id="ai-lecture-picker"
                value={selectedLectureId}
                onChange={(e) => setSelectedLectureId(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              >
                <option value="">سؤال عام حول جميع المواد والمحاضرات</option>
                {groupedLectures.map((group) => (
                  <optgroup key={group.groupLabel} label={group.groupLabel}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Chat Workspace */}
        <div className="flex-1 min-h-0 p-5 flex flex-col">
          <LectureAIAssistant lecture={selectedLecture} catalog={catalog} />
        </div>
      </div>
    </div>
  );
}
