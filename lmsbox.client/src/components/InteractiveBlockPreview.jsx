import React, { useEffect, useRef, useState } from 'react';
import { buildInteractiveBlockSrcDoc, nextIframeHeight } from '../utils/interactiveBlockIframe';

export default function InteractiveBlockPreview({ title, html, minHeight = 448, emptyMessage }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    setHeight(minHeight);
  }, [html, minHeight]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data;
      if (data?.type === 'interactive-block-resize') {
        setHeight((prev) => nextIframeHeight(prev, data.height, minHeight));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [minHeight]);

  if (!html) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        {emptyMessage || 'Generate this block first to preview how learners will see it.'}
      </p>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={title ? `Preview: ${title}` : 'Block preview'}
      className="w-full border-0 bg-transparent block"
      style={{ height: `${height}px` }}
      sandbox="allow-scripts allow-same-origin"
      srcDoc={buildInteractiveBlockSrcDoc(html)}
    />
  );
}
