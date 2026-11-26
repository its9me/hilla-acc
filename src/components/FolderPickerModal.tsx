import { useEffect, useState, type FormEvent } from 'react';
import { FolderSync, RotateCcw, X } from 'lucide-react';
import { extractDriveFolderId } from '../utils/arabic';

interface FolderPickerModalProps {
  currentFolderId: string;
  defaultFolderId: string;
  onClose: () => void;
  onApplyFolder: (folderId: string) => void;
}

export function FolderPickerModal({
  currentFolderId,
  defaultFolderId,
  onClose,
  onApplyFolder,
}: FolderPickerModalProps) {
  const [inputValue, setInputValue] = useState(
    currentFolderId === defaultFolderId
      ? ''
      : `https://drive.google.com/drive/folders/${currentFolderId}`
  );
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const extracted = extractDriveFolderId(inputValue);
    if (!extracted) {
      setError('يرجى إدخال رابط مجلد Google Drive صحيح أو معرف المجلد.');
      return;
    }
    setError(null);
    onApplyFolder(extracted);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="تغيير مصدر مجلد Google Drive"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <FolderSync className="w-5 h-5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              تغيير رابط مجلد المحاضرات
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="drive-folder-url"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              رابط المجلد العام على Google Drive
            </label>
            <input
              id="drive-folder-url"
              type="text"
              dir="ltr"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
            />
            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              يجب أن تكون صلاحية المشاركة للمجلد مضبوطة على «أي شخص لديه الرابط» ليتم عرض المحاضرات تلقائياً.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {currentFolderId !== defaultFolderId ? (
              <button
                type="button"
                onClick={() => {
                  onApplyFolder(defaultFolderId);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>العودة لمجلد قسم المحاسبة</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                تحميل المجلد
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
