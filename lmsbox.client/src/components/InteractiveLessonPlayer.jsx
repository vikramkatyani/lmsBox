import React, { useCallback, useEffect, useRef, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import { buildInteractiveBlockSrcDoc, nextIframeHeight } from '../utils/interactiveBlockIframe';

function BlockFrame({ block, onComplete }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(420);

  useEffect(() => {
    setHeight(420);
  }, [block.id, block.html]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data) return;

      if (data.type === 'interactive-block-resize') {
        setHeight((prev) => nextIframeHeight(prev, data.height));
        return;
      }

      if (data.type === 'interactive-block-complete') {
        onComplete?.(data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete]);

  if (block.isLocked) {
    return (
      <div className="py-10 text-center text-gray-500 text-sm">
        Complete the previous section to unlock this content.
      </div>
    );
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
      sandbox="allow-scripts allow-same-origin"
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
      setLesson(data);
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

  const handleBlockComplete = useCallback(async (data) => {
    if (preview) return;

    const blockId = Number(data.blockId);
    if (!blockId) return;

    try {
      const result = await interactiveLessonsService.updateBlockProgress(courseId, lessonId, blockId, {
        isComplete: true,
      });

      setLesson((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) =>
            b.id === blockId ? { ...b, isComplete: true } : b
          ),
        };
      });

      if (result.lessonProgressUpdated && onLessonComplete) {
        onLessonComplete();
      }

      await loadLesson();
    } catch (err) {
      console.error('Failed to save block progress', err);
    }
  }, [courseId, lessonId, preview, onLessonComplete, loadLesson]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading interactive lesson...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  if (!lesson?.blocks?.length) {
    return <div className="p-6 text-gray-600">No blocks available yet.</div>;
  }

  return (
    <div className="w-full space-y-10">
      {lesson.blocks.map((block) => (
        <section key={block.id} className="w-full">
          <BlockFrame block={block} onComplete={handleBlockComplete} />
        </section>
      ))}
    </div>
  );
}
