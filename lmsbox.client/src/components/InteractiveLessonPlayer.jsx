import React, { useCallback, useEffect, useRef, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import {
  buildInteractiveBlockSrcDoc,
  nextIframeHeight,
  INTERACTIVE_BLOCK_IFRAME_ALLOW,
  INTERACTIVE_BLOCK_IFRAME_SANDBOX,
} from '../utils/interactiveBlockIframe';

function BlockFrame({ block, onComplete }) {
  const iframeRef = useRef(null);
  const initialHeight = block.blockType === 'hero' ? 420 : 200;
  const [height, setHeight] = useState(initialHeight);

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
        onComplete?.(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete, block.blockType]);

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
      srcDoc={buildInteractiveBlockSrcDoc(block.html)}
    />
  );
}

export default function InteractiveLessonPlayer({
  courseId,
  lessonId,
  preview = false,
  onLessonComplete,
}) {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLesson = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [courseId, lessonId, preview]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

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
        onLessonComplete();
      }

      await loadLesson();
    } catch (err) {
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
          <BlockFrame block={block} onComplete={handleBlockComplete} />
        </section>
      ))}
    </div>
  );
}
