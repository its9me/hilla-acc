import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

interface LocalPdfViewerProps {
  url: string;
  title: string;
  onFallbackToDrive?: () => void;
}

interface PageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  targetWidth: number;
  defaultAspectRatio: number;
  scrollContainer: HTMLDivElement | null;
  onBecameVisible: (pageNumber: number) => void;
}

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  targetWidth,
  defaultAspectRatio,
  scrollContainer,
  onBecameVisible,
}: PageCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const [pageHeight, setPageHeight] = useState(() =>
    Math.max(240, Math.round(targetWidth * defaultAspectRatio))
  );
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    setPageHeight(Math.max(240, Math.round(targetWidth * defaultAspectRatio)));
  }, [targetWidth, defaultAspectRatio]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
            if (entry.intersectionRatio >= 0.35) {
              onBecameVisible(pageNumber);
            }
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: '550px 0px',
        threshold: [0, 0.35],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollContainer, pageNumber, onBecameVisible]);

  useEffect(() => {
    if (!shouldRender || targetWidth <= 0) return;

    let cancelled = false;
    let activeTask: RenderTask | null = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        setPageHeight(Math.round(viewport.height));

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        activeTask = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });

        await activeTask.promise;
        if (!cancelled) {
          setRendered(true);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          return;
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (activeTask) {
        try {
          activeTask.cancel();
        } catch {
          // ignore cancel errors
        }
      }
    };
  }, [pdfDoc, pageNumber, targetWidth, shouldRender]);

  return (
    <div
      ref={wrapperRef}
      data-pdf-page={pageNumber}
      style={{ width: `${targetWidth}px`, minHeight: `${pageHeight}px` }}
      className="relative mx-auto bg-white shadow-md ring-1 ring-slate-200 dark:ring-slate-800 rounded-md overflow-hidden flex items-center justify-center shrink-0"
    >
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-white text-xs text-slate-400">
          صفحة {pageNumber}
        </div>
      )}
    </div>
  );
}

export function LocalPdfViewer({ url, title, onFallbackToDrive }: LocalPdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(1.414);
  const [containerWidth, setContainerWidth] = useState(720);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackRef = useRef(onFallbackToDrive);
  fallbackRef.current = onFallbackToDrive;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(260, el.clientWidth - 28);
      setContainerWidth(next);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let activeLoadingTask: { destroy: () => Promise<void> } | null = null;
    const abortController = new AbortController();

    const loadPdf = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        setPdfDoc(null);
        setNumPages(0);
        setCurrentPage(1);
        setZoomMultiplier(1);

        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`تعذر تحميل ملف المحاضرة (رمز ${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const bytes = new Uint8Array(buffer);
        const isValidPdf =
          bytes.length >= 5 &&
          bytes[0] === 0x25 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x44 &&
          bytes[3] === 0x46;

        if (!isValidPdf) {
          throw new Error('استجابة غير صالحة لملف PDF، سيتم التحويل إلى عارض Drive.');
        }

        const [pdfjsLib, workerModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);

        if (cancelled) return;

        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

        const base = import.meta.env.BASE_URL || './';
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          cMapUrl: `${base}pdfjs/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
        });
        activeLoadingTask = loadingTask;

        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        const firstPage = await doc.getPage(1);
        if (cancelled) return;

        const vp = firstPage.getViewport({ scale: 1 });
        if (vp.width > 0 && vp.height > 0) {
          setDefaultAspectRatio(vp.height / vp.width);
        }

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'تعذر عرض ملف PDF محلياً.';
        setErrorMessage(msg);
        setLoading(false);
        fallbackRef.current?.();
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      abortController.abort();
      if (activeLoadingTask) {
        activeLoadingTask.destroy().catch(() => {});
      }
    };
  }, [url]);

  const scrollToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(numPages, targetPage));
      const container = scrollRef.current;
      if (!container) return;
      const pageEl = container.querySelector<HTMLElement>(`[data-pdf-page="${clamped}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(clamped);
      }
    },
    [numPages]
  );

  const fitWidthBase = Math.min(containerWidth, 920);
  const targetPageWidth = Math.max(240, Math.round(fitWidthBase * zoomMultiplier));

  return (
    <div className="flex flex-col w-full h-full bg-slate-200/80 dark:bg-slate-950 select-none">
      {/* Compact PDF Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || numPages === 0}
            onClick={() => scrollToPage(currentPage - 1)}
            aria-label="الصفحة السابقة"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-200">
            {numPages > 0 ? `${currentPage} / ${numPages}` : '...'}
          </span>
          <button
            type="button"
            disabled={currentPage >= numPages || numPages === 0}
            onClick={() => scrollToPage(currentPage + 1)}
            aria-label="الصفحة التالية"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={zoomMultiplier <= 0.6}
            onClick={() => setZoomMultiplier((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            aria-label="تصغير"
            title="تصغير"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomMultiplier(1)}
            title="ملاءمة العرض"
            className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono tabular-nums"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>{Math.round(zoomMultiplier * 100)}%</span>
          </button>
          <button
            type="button"
            disabled={zoomMultiplier >= 2.2}
            onClick={() => setZoomMultiplier((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
            aria-label="تكبير"
            title="تكبير"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Pages Area */}
      <div
        ref={scrollRef}
        aria-label={title}
        className="relative flex-1 min-h-0 overflow-auto p-3 sm:p-4 space-y-4"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50/90 dark:bg-slate-950/90 z-10 p-4 text-center">
            <div className="w-8 h-8 border-2 border-teal-700 dark:border-teal-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              جاري تجهيز صفحات المحاضرة...
            </p>
          </div>
        )}

        {errorMessage && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <p className="text-sm text-slate-700 dark:text-slate-200">{errorMessage}</p>
            {onFallbackToDrive && (
              <button
                type="button"
                onClick={onFallbackToDrive}
                className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                الفتح عبر عارض Google Drive
              </button>
            )}
          </div>
        )}

        {pdfDoc &&
          Array.from({ length: numPages }, (_, idx) => (
            <PdfPageCanvas
              key={`${numPages}-${idx + 1}`}
              pdfDoc={pdfDoc}
              pageNumber={idx + 1}
              targetWidth={targetPageWidth}
              defaultAspectRatio={defaultAspectRatio}
              scrollContainer={scrollRef.current}
              onBecameVisible={setCurrentPage}
            />
          ))}
      </div>
    </div>
  );
}
