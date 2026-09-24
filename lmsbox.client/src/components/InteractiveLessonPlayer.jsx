import React, { useCallback, useEffect, useRef, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import { useTheme } from '../theme/ThemeContext';
import {
  buildInteractiveBlockSrcDoc,
  nextIframeHeight,
  INTERACTIVE_BLOCK_IFRAME_ALLOW,
  INTERACTIVE_BLOCK_IFRAME_SANDBOX,
} from '../utils/interactiveBlockIframe';

const AUTO_COMPLETE_ON_VIEW_TYPES = new Set(['hero', 'cards', 'remember', 'warning']);
const AUTO_COMPLETE_FALLBACK_MS = 400;

function shouldAutoCompleteBlock(block, iframeEl) {
  if (!block?.html) {
    return true;
  }

  const type = String(block.blockType || '').toLowerCase();
  if (AUTO_COMPLETE_ON_VIEW_TYPES.has(type)) {
    return true;
  }

  if (type !== 'text') {
    return false;
  }

  try {
    const root = iframeEl?.contentDocument?.querySelector('[data-block-type="text"]');
    return root?.getAttribute('data-show-continue') === '0';
  } catch {
    return false;
  }
}

function BlockFrame({ block, onComplete, theme }) {
  const iframeRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const [listenerReady, setListenerReady] = useState(false);
  const initialHeight = block.blockType === 'hero' ? 420 : 200;
  const [height, setHeight] = useState(initialHeight);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    setHeight(block.blockType === 'hero' ? 420 : 200);
  }, [block.id, block.html, block.blockType]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data) return;

      if (data.type === 'interactive-block-resize') {
        const minHeight = block.blockType === 'hero' ? 340 : 120;
        setHeight((prev) => nextIframeHeight(prev, data.height, minHeight));
        return;
      }

      if (data.type === 'interactive-block-complete') {
        onCompleteRef.current?.(data);
      }
    };

    window.addEventListener('message', handleMessage);
    setListenerReady(true);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [block.id, block.blockType]);

  const requestComplete = useCallback(() => {
    if (!block.id) return;
    onCompleteRef.current?.({ type: 'interactive-block-complete', blockId: block.id });
  }, [block.id]);

  useEffect(() => {
    if (block.isComplete || block.isLocked || block.html) {
      return undefined;
    }

    requestComplete();
    return undefined;
  }, [block.isComplete, block.isLocked, block.html, requestComplete]);

  const handleIframeLoad = () => {
    if (block.isComplete || block.isLocked) {
      return;
    }
    if (!shouldAutoCompleteBlock(block, iframeRef.current)) {
      return;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      requestComplete();
    }, AUTO_COMPLETE_FALLBACK_MS);
  };

  if (block.isLocked) {
    return null;
  }

  if (!block.html) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">
        This block has no content yet.
      </div>
    );
  }

  const srcDoc = listenerReady ? buildInteractiveBlockSrcDoc(block.html, theme) : '';

  return (
    <iframe
      ref={iframeRef}
      title={block.title || 'Interactive block'}
      className="w-full border-0 bg-transparent block"
      style={{ height: `${height}px` }}
      // Video embeds (YouTube/Vimeo/file) fail under a restrictive sandbox; template HTML is server-authored.
      {...(block.blockType === 'video'
        ? {}
        : { sandbox: INTERACTIVE_BLOCK_IFRAME_SANDBOX })}
      allow={INTERACTIVE_BLOCK_IFRAME_ALLOW}
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      srcDoc={srcDoc}
      onLoad={() => {
        if (!srcDoc) return;
        handleIframeLoad();
      }}
    />
  );
}

export default function InteractiveLessonPlayer({
  courseId,
  lessonId,
  preview = false,
  onLessonComplete,
}) {
  const theme = useTheme();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lessonRef = useRef(null);
  const completingIdsRef = useRef(new Set());
  const reportedLessonCompleteRef = useRef(false);

  const loadLesson = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await interactiveLessonsService.getLearnerLesson(courseId, lessonId, preview);
      setLesson(
        preview && data?.blocks
          ? {
              ...data,
              blocks: data.blocks.map((block) => ({ ...block, isLocked: false })),
            }
          : data
      );
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load interactive lesson.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [courseId, lessonId, preview]);

  useEffect(() => {
    completingIdsRef.current = new Set();
    reportedLessonCompleteRef.current = false;
    loadLesson();
  }, [loadLesson]);

  useEffect(() => {
    lessonRef.current = lesson;
  }, [lesson]);

  useEffect(() => {
    if (preview || !lesson?.blocks?.length || reportedLessonCompleteRef.current) {
      return;
    }
    if (!lesson.blocks.every((block) => block.isComplete)) {
      return;
    }
    reportedLessonCompleteRef.current = true;
    onLessonComplete?.();
  }, [lesson, preview, onLessonComplete]);

  const applyLocalCompletion = useCallback((blockId) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const completed = prev.blocks.map((b) =>
        b.id === blockId ? { ...b, isComplete: true } : b
      );

      if (preview || !prev.lockNextBlockUntilComplete) {
        return {
          ...prev,
          blocks: completed.map((block) => ({ ...block, isLocked: false })),
        };
      }

      let firstIncompleteFound = false;
      return {
        ...prev,
        blocks: completed.map((block) => {
          if (!firstIncompleteFound) {
            if (!block.isComplete) {
              firstIncompleteFound = true;
            }
            return { ...block, isLocked: false };
          }
          return { ...block, isLocked: true };
        }),
      };
    });
  }, [preview]);

  const handleBlockComplete = useCallback(async (data) => {
    const blockId = Number(data.blockId);
    if (!blockId) return;

    const currentBlock = lessonRef.current?.blocks?.find((block) => block.id === blockId);
    if (currentBlock?.isComplete || completingIdsRef.current.has(blockId)) {
      return;
    }
    completingIdsRef.current.add(blockId);

    if (preview) {
      applyLocalCompletion(blockId);
      return;
    }

    try {
      const result = await interactiveLessonsService.updateBlockProgress(courseId, lessonId, blockId, {
        isComplete: true,
      });

      applyLocalCompletion(blockId);

      if (result.lessonProgressUpdated && onLessonComplete) {
        reportedLessonCompleteRef.current = true;
        onLessonComplete();
      }

      await loadLesson({ silent: true });
    } catch (err) {
      completingIdsRef.current.delete(blockId);
      console.error('Failed to save block progress', err);
    }
  }, [applyLocalCompletion, courseId, lessonId, preview, onLessonComplete, loadLesson]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading interactive lesson...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!lesson?.blocks?.length) {
    return <div className="p-6 text-gray-600">No blocks available yet.</div>;
  }

  const visibleBlocks = preview
    ? lesson.blocks.map((block) => ({ ...block, isLocked: false }))
    : lesson.blocks.filter((block) => !block.isLocked);

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-8">
      {visibleBlocks.map((block) => (
        <section key={`${block.id}-${block.isLocked ? 'locked' : 'open'}`} className="w-full">
          <BlockFrame block={block} theme={theme} onComplete={handleBlockComplete} />
        </section>
      ))}
    </div>
  );
}
