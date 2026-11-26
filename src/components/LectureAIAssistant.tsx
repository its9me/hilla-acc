import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import type { DriveCatalog } from '../types/drive';

export interface AILectureContext {
  id: string;
  title: string;
  subjectTitle?: string;
  stageTitle?: string;
  mimeType?: string;
  fileTypeLabel?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  fileAttached?: boolean;
  note?: string;
}

interface LectureAIAssistantProps {
  lecture?: AILectureContext | null;
  catalog?: DriveCatalog | null;
  compact?: boolean;
}

function renderFormattedLine(line: string, keyPrefix: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-${idx}`} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
  });
}

function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
          const clean = line.replace(/^#{1,3}\s+/, '');
          return (
            <h4
              key={idx}
              className="text-sm font-bold text-teal-800 dark:text-teal-300 pt-1.5"
            >
              {renderFormattedLine(clean, `h-${idx}`)}
            </h4>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const clean = line.slice(2).trim();
          return (
            <div key={idx} className="flex items-start gap-2 pr-1">
              <span className="text-teal-700 dark:text-teal-400 font-bold mt-0.5" aria-hidden="true">
                •
              </span>
              <span className="flex-1">{renderFormattedLine(clean, `b-${idx}`)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderFormattedLine(line, `p-${idx}`)}</p>;
      })}
    </div>
  );
}

export function LectureAIAssistant({
  lecture = null,
  catalog = null,
  compact = false,
}: LectureAIAssistantProps) {
  const contextKey = lecture?.id || 'general';
  const [chatsByKey, setChatsByKey] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const messages = chatsByKey[contextKey] || [];

  const catalogSummary = useMemo(() => {
    if (!catalog) return undefined;
    return catalog.stages.map((st) => ({
      title: st.title,
      subjects: st.subjects.map((sub) => ({
        title: sub.title,
        lectures: sub.entries.filter((e) => !e.isFolder).map((e) => e.title),
      })),
    }));
  }, [catalog]);

  const quickPrompts = useMemo(() => {
    if (lecture) {
      return [
        'اشرح لي هذه المحاضرة بأسلوب مبسط',
        'لخّص أهم النقاط والقيود المحاسبية في المحاضرة',
        'اصنع لي 5 أسئلة اختبارية مع الحل من المحاضرة',
      ];
    }
    return [
      'ما هي المواد والمحاضرات المتوفرة في القسم؟',
      'اشرح لي أساسيات القيد المزدوج مع مثال عملي',
      'كيف أفرق بين المحاسبة المالية ومحاسبة التكاليف؟',
    ];
  }, [lecture]);

  useEffect(() => {
    setError(null);
  }, [contextKey]);

  useEffect(() => {
    if (messages.length === 0 && !loading && !error) return;
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, loading, error]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const previousMessages = chatsByKey[contextKey] || [];
    const nextMessages = [...previousMessages, userMsg];

    setChatsByKey((prev) => ({
      ...prev,
      [contextKey]: nextMessages,
    }));
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/ai/lecture-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: previousMessages.slice(-10).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          lecture: lecture
            ? {
                id: lecture.id,
                title: lecture.title,
                subjectTitle: lecture.subjectTitle,
                stageTitle: lecture.stageTitle,
                mimeType: lecture.mimeType,
                fileTypeLabel: lecture.fileTypeLabel,
              }
            : null,
          catalogSummary,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'المساعد الذكي يحتاج إلى استضافة تدعم خادم Node.js (مثل Render.com مجاناً عبر ملف render.yaml) مع ضبط GEMINI_API_KEY؛ أما تصفح المحاضرات وقراءتها وتحميلها فيعمل هنا بشكل كامل.'
        );
      }

      const data = (await response.json()) as {
        answer?: string;
        fileAttached?: boolean;
        note?: string;
        error?: string;
      };

      if (!response.ok || !data.answer) {
        throw new Error(data.error || 'تعذر الحصول على إجابة من المساعد الذكي.');
      }

      const modelMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.answer,
        fileAttached: data.fileAttached,
        note: data.note,
      };

      setChatsByKey((prev) => ({
        ...prev,
        [contextKey]: [...(prev[contextKey] || nextMessages), modelMsg],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالمساعد الذكي.');
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setChatsByKey((prev) => {
      const copy = { ...prev };
      delete copy[contextKey];
      return copy;
    });
    setError(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Context strip */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {lecture ? (
            <FileText className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
          ) : (
            <BookOpen className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-teal-900 dark:text-teal-200 truncate">
              {lecture ? `يساعدك في: ${lecture.title}` : 'مساعد قسم المحاسبة الشامل'}
            </p>
            {lecture?.subjectTitle && (
              <p className="text-[11px] text-teal-700/90 dark:text-teal-400/90 truncate">
                {lecture.stageTitle ? `${lecture.stageTitle} · ` : ''}
                {lecture.subjectTitle}
              </p>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={resetChat}
            title="بدء محادثة جديدة"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>جديد</span>
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto overscroll-contain space-y-3 py-3 ${
          compact ? 'min-h-[200px]' : 'min-h-[260px]'
        }`}
      >
        {messages.length === 0 ? (
          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span>اسأل Gemini AI عن المحاضرات</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lecture
                  ? 'يمكنني قراءة ملف المحاضرة المفتوح وشرح المفاهيم، كتابة القيود المحاسبية، وتلخيص الأفكار الرئيسية أو إعداد أسئلة تدريبية.'
                  : 'اختر أي محاضرة من القائمة أو اطرح سؤالك المحاسبي مباشرة وسأشرح لك بالتفصيل مع أمثلة واضحة.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                اقتراحات سريعة:
              </p>
              <div className="flex flex-col gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loading}
                    onClick={() => sendQuestion(prompt)}
                    className="text-right px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-teal-600/60 dark:hover:border-teal-500/60 hover:bg-teal-50/40 dark:hover:bg-teal-950/30 rounded-xl transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-teal-700 text-white mr-0 ml-6'
                  : 'bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 ml-0 mr-2'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <div className="space-y-2">
                  <FormattedAnswer text={msg.text} />
                  {msg.note && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                      {msg.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-teal-700 dark:text-teal-400 shrink-0" />
            <span>
              {lecture ? 'جاري قراءة المحاضرة وإعداد الشرح...' : 'جاري إعداد الإجابة...'}
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
        className="pt-2.5 border-t border-slate-200 dark:border-slate-800 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuestion(input);
              }
            }}
            placeholder={
              lecture
                ? 'اكتب سؤالك عن هذه المحاضرة...'
                : 'اكتب سؤالك حول المحاضرات أو المحاسبة...'
            }
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="إرسال السؤال"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-45 text-white transition-colors shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
