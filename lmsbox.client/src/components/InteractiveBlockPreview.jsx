import React, { useEffect, useRef, useState } from 'react';
import {
  buildInteractiveBlockSrcDoc,
  nextIframeHeight,
  INTERACTIVE_BLOCK_IFRAME_ALLOW,
  INTERACTIVE_BLOCK_IFRAME_SANDBOX,
} from '../utils/interactiveBlockIframe';

export default function InteractiveBlockPreview({
  title,
  html,
  minHeight,
  emptyMessage,
  blockType,
}) {
  const iframeRef = useRef(null);
  const resolvedMinHeight = minHeight ?? (blockType === 'hero' ? 420 : 160);
  const [height, setHeight] = useState(resolvedMinHeight);

  useEffect(() => {
    setHeight(resolvedMinHeight);
  }, [html, resolvedMinHeight]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (data?.type === 'interactive-block-resize') {
        setHeight((prev) => nextIframeHeight(prev, data.height, resolvedMinHeight));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resolvedMinHeight]);

  if (!html) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        {emptyMessage || 'Generate this block first to preview how learners will see it.'}
      </p>
    );
  }

  const isVideo =
    blockType === 'video' ||
    (typeof html === 'string' && html.includes('data-block-type="video"'));

  return (
    <iframe
      ref={iframeRef}
      title={title ? `Preview: ${title}` : 'Block preview'}
      className="w-full border-0 bg-transparent block"
      style={{ height: `${height}px` }}
      {...(isVideo ? {} : { sandbox: INTERACTIVE_BLOCK_IFRAME_SANDBOX })}
      allow={INTERACTIVE_BLOCK_IFRAME_ALLOW}
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      srcDoc={buildInteractiveBlockSrcDoc(html)}
    />
  );
}
