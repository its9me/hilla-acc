export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{15,100}$/.test(trimmed)) {
    return trimmed;
  }

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,100})/);
  if (folderMatch) {
    return folderMatch[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,100})/);
  if (idParamMatch) {
    return idParamMatch[1];
  }

  return null;
}

export function formatSyncTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
