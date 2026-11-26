export type DriveFileCategory =
  | 'folder'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'presentation'
  | 'spreadsheet'
  | 'archive'
  | 'other';

export interface DriveEntry {
  id: string;
  title: string;
  isFolder: boolean;
  mimeType: string;
  category: DriveFileCategory;
  fileTypeLabel: string;
  modified: string;
  thumbnailUrl: string | null;
  viewUrl: string;
  previewUrl: string;
  downloadUrl: string;
}

export interface FolderListing {
  folderId: string;
  folderTitle: string;
  entries: DriveEntry[];
  fetchedAt: string;
}

export interface SubjectNode {
  id: string;
  title: string;
  modified: string;
  stageId: string;
  stageTitle: string;
  entries: DriveEntry[];
  fileCount: number;
  subfolderCount: number;
  viewUrl: string;
}

export interface StageNode {
  id: string;
  title: string;
  order: number;
  modified: string;
  subjects: SubjectNode[];
  directFiles: DriveEntry[];
  totalFiles: number;
  viewUrl: string;
}

export interface LectureIndexItem extends DriveEntry {
  stageId: string;
  stageTitle: string;
  subjectId: string;
  subjectTitle: string;
}

export interface DriveCatalog {
  rootId: string;
  rootTitle: string;
  rootUrl: string;
  fetchedAt: string;
  stages: StageNode[];
  scheduleFolder: {
    id: string;
    title: string;
    modified: string;
    entries: DriveEntry[];
    viewUrl: string;
  } | null;
  looseFiles: DriveEntry[];
  totalSubjects: number;
  totalFiles: number;
  allLectures: LectureIndexItem[];
}

export interface StudyProgressMap {
  completedIds: string[];
  bookmarkedIds: string[];
  notesById: Record<string, string>;
  lastOpenedId: string | null;
}
