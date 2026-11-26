import {
  File,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Image as ImageIcon,
  Presentation,
} from 'lucide-react';
import type { DriveFileCategory } from '../types/drive';

interface FileTypeIconProps {
  category: DriveFileCategory;
  className?: string;
}

export function FileTypeIcon({ category, className = 'w-5 h-5' }: FileTypeIconProps) {
  switch (category) {
    case 'folder':
      return <Folder className={`${className} text-teal-700 dark:text-teal-400`} aria-hidden="true" />;
    case 'pdf':
      return <FileText className={`${className} text-rose-600 dark:text-rose-400`} aria-hidden="true" />;
    case 'image':
      return <ImageIcon className={`${className} text-sky-600 dark:text-sky-400`} aria-hidden="true" />;
    case 'video':
      return <FileVideo className={`${className} text-indigo-600 dark:text-indigo-400`} aria-hidden="true" />;
    case 'audio':
      return <FileAudio className={`${className} text-amber-600 dark:text-amber-400`} aria-hidden="true" />;
    case 'presentation':
      return <Presentation className={`${className} text-orange-600 dark:text-orange-400`} aria-hidden="true" />;
    case 'spreadsheet':
      return <FileSpreadsheet className={`${className} text-emerald-600 dark:text-emerald-400`} aria-hidden="true" />;
    case 'document':
      return <FileText className={`${className} text-blue-600 dark:text-blue-400`} aria-hidden="true" />;
    case 'archive':
      return <FileArchive className={`${className} text-slate-600 dark:text-slate-300`} aria-hidden="true" />;
    default:
      return <File className={`${className} text-slate-500 dark:text-slate-400`} aria-hidden="true" />;
  }
}

export function getCategorySurfaceClass(category: DriveFileCategory): string {
  switch (category) {
    case 'folder':
      return 'bg-teal-50 border-teal-100 dark:bg-teal-950/60 dark:border-teal-900/70';
    case 'pdf':
      return 'bg-rose-50 border-rose-100 dark:bg-rose-950/60 dark:border-rose-900/70';
    case 'image':
      return 'bg-sky-50 border-sky-100 dark:bg-sky-950/60 dark:border-sky-900/70';
    case 'video':
      return 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/60 dark:border-indigo-900/70';
    case 'audio':
      return 'bg-amber-50 border-amber-100 dark:bg-amber-950/60 dark:border-amber-900/70';
    case 'presentation':
      return 'bg-orange-50 border-orange-100 dark:bg-orange-950/60 dark:border-orange-900/70';
    case 'spreadsheet':
      return 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/60 dark:border-emerald-900/70';
    case 'document':
      return 'bg-blue-50 border-blue-100 dark:bg-blue-950/60 dark:border-blue-900/70';
    default:
      return 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
  }
}
