import 'dotenv/config';
import { GoogleGenAI, type Content, type Part } from '@google/genai';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  DriveCatalog,
  DriveEntry,
  DriveFileCategory,
  FolderListing,
  LectureIndexItem,
  StageNode,
  SubjectNode,
} from './src/types/drive.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_ROOT_FOLDER_ID = '1XRkN1f8lmr-rv3cqS0AZpswOCOibiQHP';
const CACHE_TTL_MS = 3 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const folderCache = new Map<string, CacheEntry<FolderListing>>();
const catalogCache = new Map<string, CacheEntry<DriveCatalog>>();

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function validateDriveId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,120}$/.test(id);
}

function classifyMimeAndLabel(
  isFolder: boolean,
  mimeType: string,
  title: string,
  altLabel: string
): { category: DriveFileCategory; fileTypeLabel: string } {
  if (isFolder) {
    return { category: 'folder', fileTypeLabel: 'مجلد' };
  }

  const lowerMime = mimeType.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const lowerAlt = altLabel.toLowerCase();

  if (lowerMime.includes('pdf') || lowerTitle.endsWith('.pdf') || lowerAlt.includes('pdf')) {
    return { category: 'pdf', fileTypeLabel: 'ملف PDF' };
  }
  if (
    lowerMime.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(lowerTitle) ||
    lowerAlt.includes('image')
  ) {
    return { category: 'image', fileTypeLabel: 'صورة' };
  }
  if (
    lowerMime.startsWith('video/') ||
    /\.(mp4|mkv|mov|avi|webm)$/i.test(lowerTitle) ||
    lowerAlt.includes('video')
  ) {
    return { category: 'video', fileTypeLabel: 'فيديو' };
  }
  if (
    lowerMime.startsWith('audio/') ||
    /\.(mp3|wav|m4a|ogg)$/i.test(lowerTitle) ||
    lowerAlt.includes('audio')
  ) {
    return { category: 'audio', fileTypeLabel: 'ملف صوتي' };
  }
  if (
    lowerMime.includes('presentation') ||
    lowerMime.includes('powerpoint') ||
    /\.(ppt|pptx|key)$/i.test(lowerTitle)
  ) {
    return { category: 'presentation', fileTypeLabel: 'عرض تقديمي' };
  }
  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    /\.(xls|xlsx|csv)$/i.test(lowerTitle)
  ) {
    return { category: 'spreadsheet', fileTypeLabel: 'جدول بيانات' };
  }
  if (
    lowerMime.includes('wordprocessing') ||
    lowerMime.includes('msword') ||
    lowerMime.includes('document') ||
    /\.(doc|docx|txt|rtf)$/i.test(lowerTitle)
  ) {
    return { category: 'document', fileTypeLabel: 'مستند نصي' };
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(lowerTitle) || lowerMime.includes('zip')) {
    return { category: 'archive', fileTypeLabel: 'ملف مضغوط' };
  }

  return { category: 'other', fileTypeLabel: 'ملف' };
}

function parseEmbeddedFolderHtml(folderId: string, html: string): FolderListing {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const folderTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : 'مجلد محاضرات';

  const chunks = html.split('<div class="flip-entry" id="entry-').slice(1);
  const entries: DriveEntry[] = [];

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^([^"]+)"/);
    if (!idMatch) continue;
    const id = idMatch[1];

    const hrefMatch = chunk.match(/<a href="([^"]+)"/);
    const href = hrefMatch ? decodeHtmlEntities(hrefMatch[1]) : '';
    const isFolder = href.includes('/folders/');

    const titleElMatch = chunk.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/);
    const title = titleElMatch ? decodeHtmlEntities(titleElMatch[1]) : 'بدون عنوان';

    const modMatch = chunk.match(/<div class="flip-entry-last-modified"><div>([\s\S]*?)<\/div>/);
    const modified = modMatch ? decodeHtmlEntities(modMatch[1]) : '';

    const iconMatch = chunk.match(/drive-thirdparty\.googleusercontent\.com\/\d+\/type\/([^"]+)/);
    const mimeType = iconMatch ? decodeHtmlEntities(iconMatch[1]) : isFolder ? 'application/vnd.google-apps.folder' : '';

    const thumbMatch = chunk.match(/<div class="flip-entry-thumb"><img src="([^"]+)"(?:\s+alt="([^"]*)")?/);
    const thumbnailUrl = thumbMatch ? decodeHtmlEntities(thumbMatch[1]) : null;
    const altLabel = thumbMatch?.[2] ? decodeHtmlEntities(thumbMatch[2]) : '';

    const { category, fileTypeLabel } = classifyMimeAndLabel(isFolder, mimeType, title, altLabel);

    const viewUrl = isFolder
      ? `https://drive.google.com/drive/folders/${id}`
      : `https://drive.google.com/file/d/${id}/view`;

    const previewUrl = isFolder
      ? `https://drive.google.com/embeddedfolderview?id=${id}#list`
      : `https://drive.google.com/file/d/${id}/preview`;

    const downloadUrl = isFolder
      ? `https://drive.google.com/drive/folders/${id}`
      : `https://drive.google.com/uc?export=download&id=${id}`;

    entries.push({
      id,
      title,
      isFolder,
      mimeType,
      category,
      fileTypeLabel,
      modified,
      thumbnailUrl,
      viewUrl,
      previewUrl,
      downloadUrl,
    });
  }

  return {
    folderId,
    folderTitle,
    entries,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchDriveFolder(folderId: string, bypassCache = false): Promise<FolderListing> {
  if (!validateDriveId(folderId)) {
    throw new Error('معرف المجلد غير صالح');
  }

  if (!bypassCache) {
    const cached = folderCache.get(folderId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const targetUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AccountingLecturesHub/1.0)',
      'Accept-Language': 'ar,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`تعذر الوصول إلى المجلد من Google Drive (رمز ${response.status})`);
  }

  const html = await response.text();
  if (html.includes('accounts.google.com/ServiceLogin') || html.includes('Sign in - Google Accounts')) {
    throw new Error('هذا المجلد خاص ويتطلب تفعيل المشاركة العامة ("أي شخص لديه الرابط") على Google Drive.');
  }

  const listing = parseEmbeddedFolderHtml(folderId, html);
  folderCache.set(folderId, {
    data: listing,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return listing;
}

function getStageOrder(title: string): number {
  const normalized = title.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  if (normalized.includes('الاولى') || normalized.includes('الأولى') || /\b1\b/.test(normalized)) return 1;
  if (normalized.includes('الثانيه') || /\b2\b/.test(normalized)) return 2;
  if (normalized.includes('الثالثه') || /\b3\b/.test(normalized)) return 3;
  if (normalized.includes('الرابعه') || /\b4\b/.test(normalized)) return 4;
  return 99;
}

function isScheduleFolder(title: string): boolean {
  const normalized = title.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  return normalized.includes('جدول');
}

async function buildDriveCatalog(rootFolderId: string, bypassCache = false): Promise<DriveCatalog> {
  if (!bypassCache) {
    const cached = catalogCache.get(rootFolderId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const root = await fetchDriveFolder(rootFolderId, bypassCache);
  const topFolders = root.entries.filter((e) => e.isFolder);
  const looseFiles = root.entries.filter((e) => !e.isFolder);

  const stageFolders = topFolders.filter((f) => !isScheduleFolder(f.title));
  const scheduleEntry = topFolders.find((f) => isScheduleFolder(f.title)) || null;

  const [stageListings, scheduleListing] = await Promise.all([
    Promise.all(
      stageFolders.map(async (stageEntry) => {
        const listing = await fetchDriveFolder(stageEntry.id, bypassCache);
        return { stageEntry, listing };
      })
    ),
    scheduleEntry ? fetchDriveFolder(scheduleEntry.id, bypassCache) : Promise.resolve(null),
  ]);

  const stages: StageNode[] = await Promise.all(
    stageListings.map(async ({ stageEntry, listing }) => {
      const subjectEntries = listing.entries.filter((e) => e.isFolder);
      const directFiles = listing.entries.filter((e) => !e.isFolder);

      const subjects: SubjectNode[] = await Promise.all(
        subjectEntries.map(async (subEntry) => {
          const subListing = await fetchDriveFolder(subEntry.id, bypassCache);
          const filesOnly = subListing.entries.filter((e) => !e.isFolder);
          const subfoldersOnly = subListing.entries.filter((e) => e.isFolder);
          return {
            id: subEntry.id,
            title: subEntry.title,
            modified: subEntry.modified,
            stageId: stageEntry.id,
            stageTitle: stageEntry.title,
            entries: subListing.entries,
            fileCount: filesOnly.length,
            subfolderCount: subfoldersOnly.length,
            viewUrl: subEntry.viewUrl,
          };
        })
      );

      subjects.sort((a, b) => a.title.localeCompare(b.title, 'ar'));

      const totalFiles =
        directFiles.length + subjects.reduce((sum, s) => sum + s.fileCount, 0);

      return {
        id: stageEntry.id,
        title: stageEntry.title,
        order: getStageOrder(stageEntry.title),
        modified: stageEntry.modified,
        subjects,
        directFiles,
        totalFiles,
        viewUrl: stageEntry.viewUrl,
      };
    })
  );

  stages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ar'));

  const allLectures: LectureIndexItem[] = [];
  for (const stage of stages) {
    for (const df of stage.directFiles) {
      allLectures.push({
        ...df,
        stageId: stage.id,
        stageTitle: stage.title,
        subjectId: stage.id,
        subjectTitle: stage.title,
      });
    }
    for (const subject of stage.subjects) {
      for (const entry of subject.entries) {
        if (!entry.isFolder) {
          allLectures.push({
            ...entry,
            stageId: stage.id,
            stageTitle: stage.title,
            subjectId: subject.id,
            subjectTitle: subject.title,
          });
        }
      }
    }
  }

  const totalSubjects = stages.reduce((sum, s) => sum + s.subjects.length, 0);
  const totalFiles =
    allLectures.length +
    looseFiles.length +
    (scheduleListing ? scheduleListing.entries.filter((e) => !e.isFolder).length : 0);

  const catalog: DriveCatalog = {
    rootId: rootFolderId,
    rootTitle: root.folderTitle,
    rootUrl: `https://drive.google.com/drive/folders/${rootFolderId}`,
    fetchedAt: new Date().toISOString(),
    stages,
    scheduleFolder: scheduleEntry
      ? {
          id: scheduleEntry.id,
          title: scheduleEntry.title,
          modified: scheduleEntry.modified,
          entries: scheduleListing ? scheduleListing.entries : [],
          viewUrl: scheduleEntry.viewUrl,
        }
      : null,
    looseFiles,
    totalSubjects,
    totalFiles,
    allLectures,
  };

  catalogCache.set(rootFolderId, {
    data: catalog,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return catalog;
}

const MAX_AI_FILE_BYTES = 18 * 1024 * 1024;
const AI_FILE_CACHE_TTL_MS = 10 * 60 * 1000;
const aiFileCache = new Map<
  string,
  { mimeType: string; base64: string; expiresAt: number }
>();

const SUPPORTED_AI_MIME_PREFIXES = ['application/pdf', 'image/', 'text/plain', 'text/csv'];

function normalizeAiMime(rawMime: string, mimeHint: string): string | null {
  const cleanRaw = rawMime.split(';')[0].trim().toLowerCase();
  if (SUPPORTED_AI_MIME_PREFIXES.some((prefix) => cleanRaw.startsWith(prefix))) {
    return cleanRaw;
  }
  const cleanHint = mimeHint.split(';')[0].trim().toLowerCase();
  if (
    cleanRaw === 'application/octet-stream' &&
    SUPPORTED_AI_MIME_PREFIXES.some((prefix) => cleanHint.startsWith(prefix))
  ) {
    return cleanHint;
  }
  return null;
}

async function fetchDriveFileForAI(
  fileId: string,
  mimeHint = ''
): Promise<{ file: { mimeType: string; base64: string } | null; note: string }> {
  if (!validateDriveId(fileId)) {
    return { file: null, note: 'معرف الملف غير صالح للقراءة المباشرة.' };
  }

  const cached = aiFileCache.get(fileId);
  if (cached && cached.expiresAt > Date.now()) {
    return { file: { mimeType: cached.mimeType, base64: cached.base64 }, note: '' };
  }

  // Fast local disk lookup for lectures mirrored in public/lectures/
  for (const candidate of [
    { ext: 'pdf', mime: 'application/pdf' },
    { ext: 'jpg', mime: 'image/jpeg' },
    { ext: 'png', mime: 'image/png' },
  ]) {
    const localPath = path.join(__dirname, 'public', 'lectures', `${fileId}.${candidate.ext}`);
    if (fs.existsSync(localPath)) {
      try {
        const stat = fs.statSync(localPath);
        if (stat.size > 0 && stat.size <= MAX_AI_FILE_BYTES) {
          const base64 = fs.readFileSync(localPath).toString('base64');
          aiFileCache.set(fileId, {
            mimeType: candidate.mime,
            base64,
            expiresAt: Date.now() + AI_FILE_CACHE_TTL_MS,
          });
          return { file: { mimeType: candidate.mime, base64 }, note: '' };
        }
      } catch {
        // Fall through to Drive fetch if local read fails
      }
    }
  }

  const lowerHint = mimeHint.toLowerCase();
  if (
    lowerHint.includes('folder') ||
    lowerHint.startsWith('video/') ||
    lowerHint.startsWith('audio/') ||
    lowerHint.includes('zip')
  ) {
    return {
      file: null,
      note: 'هذا النوع من الملفات لا يدعم القراءة النصية المباشرة، سيتم الشرح بالاعتماد على عنوان المحاضرة واسم المادة.',
    };
  }

  try {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    const response = await fetch(downloadUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AccountingLecturesHub/1.0)',
      },
    });

    if (!response.ok) {
      return {
        file: null,
        note: 'تعذر تنزيل محتوى الملف من Google Drive حالياً، سيتم الشرح وفق عنوان المحاضرة.',
      };
    }

    const rawContentType = response.headers.get('content-type') || '';
    if (rawContentType.toLowerCase().includes('text/html')) {
      return {
        file: null,
        note: 'الملف يتطلب تأكيد تنزيل إضافي من Google Drive أو أنه ملف مضغوط/تفاعلي؛ سيتم الشرح وفق عنوان المحاضرة والمادة.',
      };
    }

    const resolvedMime = normalizeAiMime(rawContentType, mimeHint);
    if (!resolvedMime) {
      return {
        file: null,
        note: 'صيغة هذا الملف غير مدعومة للاستخراج المباشر حالياً (يفضّل ملفات PDF والصور).',
      };
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_AI_FILE_BYTES) {
      return {
        file: null,
        note: 'حجم ملف المحاضرة يتجاوز الحد المسموح للتحليل التلقائي (18 ميجابايت).',
      };
    }

    const arrayBuf = await response.arrayBuffer();
    if (arrayBuf.byteLength > MAX_AI_FILE_BYTES) {
      return {
        file: null,
        note: 'حجم ملف المحاضرة يتجاوز الحد المسموح للتحليل التلقائي (18 ميجابايت).',
      };
    }

    const base64 = Buffer.from(arrayBuf).toString('base64');
    if (aiFileCache.size >= 12) {
      const oldestKey = aiFileCache.keys().next().value;
      if (oldestKey) aiFileCache.delete(oldestKey);
    }
    aiFileCache.set(fileId, {
      mimeType: resolvedMime,
      base64,
      expiresAt: Date.now() + AI_FILE_CACHE_TTL_MS,
    });

    return { file: { mimeType: resolvedMime, base64 }, note: '' };
  } catch {
    return {
      file: null,
      note: 'انتهت مهلة قراءة الملف من Google Drive، سيتم الشرح بناءً على بيانات المحاضرة.',
    };
  }
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errText = error instanceof Error ? error.message : String(error);
      const isNonRetryable =
        errText.includes('API_KEY_INVALID') ||
        errText.includes('PERMISSION_DENIED') ||
        errText.includes('INVALID_ARGUMENT') ||
        errText.includes('RESOURCE_EXHAUSTED') ||
        errText.includes('NOT_FOUND') ||
        errText.includes('400') ||
        errText.includes('401') ||
        errText.includes('403') ||
        errText.includes('404') ||
        errText.includes('429');

      if (isNonRetryable || attempt === maxRetries) {
        throw error;
      }

      const delayMs = 700 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('401')) {
    return {
      status: 401,
      message:
        'تعذر التحقق من صلاحية مفتاح Gemini AI. يرجى التأكد من صحة GEMINI_API_KEY في إعدادات الأسرار (Settings > Secrets).',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'تم الوصول إلى الحد المؤقت لطلبات الذكاء الاصطناعي. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      message: 'تعذر الوصول إلى نموذج Gemini المطلوب حالياً.',
    };
  }
  return {
    status: 502,
    message: 'حدث خطأ أثناء الاتصال بخدمة Gemini AI. يرجى المحاولة مرة أخرى.',
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/drive/folder/:folderId', async (req, res) => {
    try {
      const folderId = req.params.folderId || DEFAULT_ROOT_FOLDER_ID;
      const refresh = req.query.refresh === '1';
      const data = await fetchDriveFolder(folderId, refresh);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب محتويات المجلد';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/drive/catalog', async (req, res) => {
    try {
      const folderId =
        typeof req.query.folderId === 'string' && req.query.folderId.trim()
          ? req.query.folderId.trim()
          : DEFAULT_ROOT_FOLDER_ID;
      const refresh = req.query.refresh === '1';
      const data = await buildDriveCatalog(folderId, refresh);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل فهرس المحاضرات';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.post('/api/ai/lecture-chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        res.status(503).json({
          error:
            'مفتاح Gemini AI غير مضبوط على الخادم بعد. يرجى إضافته في إعدادات الأسرار (Settings > Secrets) أو متغير البيئة GEMINI_API_KEY.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const body = (req.body || {}) as {
        message?: unknown;
        history?: unknown;
        lecture?: {
          id?: unknown;
          title?: unknown;
          subjectTitle?: unknown;
          stageTitle?: unknown;
          mimeType?: unknown;
          fileTypeLabel?: unknown;
        } | null;
        catalogSummary?: Array<{
          title?: unknown;
          subjects?: Array<{ title?: unknown; lectures?: unknown }>;
        }>;
      };

      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        res.status(400).json({ error: 'يرجى كتابة سؤالك أولاً.' });
        return;
      }
      if (message.length > 4000) {
        res.status(400).json({ error: 'النص طويل جداً، يرجى اختصار السؤال إلى أقل من 4000 حرف.' });
        return;
      }

      const lectureId =
        body.lecture && typeof body.lecture.id === 'string' && validateDriveId(body.lecture.id)
          ? body.lecture.id
          : null;
      const lectureTitle =
        body.lecture && typeof body.lecture.title === 'string' ? body.lecture.title.trim() : '';
      const subjectTitle =
        body.lecture && typeof body.lecture.subjectTitle === 'string'
          ? body.lecture.subjectTitle.trim()
          : '';
      const stageTitle =
        body.lecture && typeof body.lecture.stageTitle === 'string'
          ? body.lecture.stageTitle.trim()
          : '';
      const lectureMimeHint =
        body.lecture && typeof body.lecture.mimeType === 'string'
          ? body.lecture.mimeType.trim()
          : '';
      const lectureTypeLabel =
        body.lecture && typeof body.lecture.fileTypeLabel === 'string'
          ? body.lecture.fileTypeLabel.trim()
          : '';

      let attachedFile: { mimeType: string; base64: string } | null = null;
      let fileReadNote = '';

      if (lectureId) {
        const result = await fetchDriveFileForAI(lectureId, lectureMimeHint);
        attachedFile = result.file;
        fileReadNote = result.note;
      }

      const catalogLines: string[] = [];
      if (Array.isArray(body.catalogSummary)) {
        for (const stage of body.catalogSummary.slice(0, 8)) {
          const stTitle = typeof stage?.title === 'string' ? stage.title.trim() : '';
          if (!stTitle) continue;
          const subjList = Array.isArray(stage.subjects) ? stage.subjects : [];
          const subjFormatted = subjList
            .slice(0, 20)
            .map((sub) => {
              const subName = typeof sub?.title === 'string' ? sub.title.trim() : '';
              const lecs = Array.isArray(sub?.lectures)
                ? sub.lectures
                    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
                    .slice(0, 12)
                : [];
              return subName
                ? `${subName}${lecs.length > 0 ? ` (${lecs.join('، ')})` : ''}`
                : '';
            })
            .filter(Boolean);
          catalogLines.push(
            `- ${stTitle}: ${subjFormatted.length > 0 ? subjFormatted.join(' | ') : 'لا توجد مواد مضافة بعد'}`
          );
        }
      }

      const lectureContextBlock = lectureTitle
        ? [
            'بيانات المحاضرة المفتوحة حالياً:',
            `- عنوان الملف: ${lectureTitle}`,
            subjectTitle ? `- المادة: ${subjectTitle}` : '',
            stageTitle ? `- المرحلة: ${stageTitle}` : '',
            lectureTypeLabel ? `- نوع الملف: ${lectureTypeLabel}` : '',
            attachedFile
              ? '- حالة الملف: تم إرفاق محتوى الملف الكامل مع هذا السؤال، اعتمد على محتواه الفعلي أولاً.'
              : `- حالة الملف: ${fileReadNote || 'تعذر إرفاق نص الملف مباشرة، اشرح للطالب بوضوح اعتماداً على عنوان المحاضرة واسم المادة والمفاهيم المحاسبية المرتبطة مع توضيح ذلك.'}`,
          ]
            .filter(Boolean)
            .join('\n')
        : 'وضع المساعدة: استشارة عامة حول مواد ومحاضرات قسم المحاسبة.';

      const systemInstruction = [
        'أنت المساعد الأكاديمي الذكي لطلبة قسم المحاسبة في كلية الإدارة والاقتصاد - جامعة الحلة.',
        'مهمتك مساعدة الطلبة على فهم المحاضرات، وشرح المفاهيم المحاسبية، والقيود اليومية (من حـ/ ... إلى حـ/ ...)، والمعادلات، وتلخيص الدروس، وصياغة أسئلة اختبارية مع حلولها.',
        'استخدم لغة عربية واضحة ومبسطة ومنظمة بعناوين ونقاط وأمثلة رقمية عملية عند الحاجة.',
        'إذا كان ملف المحاضرة مرفقاً، فالتزم بدقة بمحتوى الملف ولا تخترع فقرات أو أرقاماً غير واردة فيه مدعياً أنها من الملف.',
        'اجعل طول الإجابة متوازناً ووافياً دون حشو زائد.',
        '',
        lectureContextBlock,
        catalogLines.length > 0
          ? `\nفهرس المواد والمحاضرات المتوفرة في القسم:\n${catalogLines.join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const sanitizedHistory: Content[] = [];
      if (Array.isArray(body.history)) {
        for (const item of body.history.slice(-10)) {
          if (!item || typeof item !== 'object') continue;
          const turn = item as { role?: unknown; text?: unknown };
          const role = turn.role === 'model' ? 'model' : turn.role === 'user' ? 'user' : null;
          const text = typeof turn.text === 'string' ? turn.text.trim() : '';
          if (role && text) {
            sanitizedHistory.push({ role, parts: [{ text: text.slice(0, 4000) }] });
          }
        }
      }

      const latestUserParts: Part[] = [];
      if (attachedFile) {
        latestUserParts.push({
          inlineData: {
            mimeType: attachedFile.mimeType,
            data: attachedFile.base64,
          },
        });
      }
      latestUserParts.push({ text: message });

      const contents: Content[] = [
        ...sanitizedHistory,
        { role: 'user', parts: latestUserParts },
      ];

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
          },
        })
      );

      const answer = response.text?.trim();
      if (!answer) {
        res.status(502).json({ error: 'لم يرد المساعد الذكي بإجابة واضحة. يرجى المحاولة مرة أخرى.' });
        return;
      }

      res.json({
        answer,
        fileAttached: Boolean(attachedFile),
        note: attachedFile ? undefined : fileReadNote || undefined,
      });
    } catch (error) {
      const parsed = mapGeminiError(error);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
