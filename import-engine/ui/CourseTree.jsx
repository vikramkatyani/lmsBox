import React, { useState } from 'react';

/**
 * Collapsible file-explorer tree for the course object model.
 * Pure presentation — selection bubbles up; no business logic.
 */
export function CourseTree({ root, selectedKey, onSelect }) {
  return (
    <ul className="font-mono text-sm text-slate-800">
      <TreeNode
        node={root}
        depth={0}
        selectedKey={selectedKey}
        onSelect={onSelect}
        defaultExpanded
      />
    </ul>
  );
}

function TreeNode({ node, depth, selectedKey, onSelect, defaultExpanded = false }) {
  const hasChildren = node.children?.length > 0;
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2);
  const selected = selectedKey === node.key;

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer ${
          selected ? 'bg-[#1b365d] text-white' : 'hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={() => onSelect(node.key)}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-[10px] ${
              selected ? 'text-white' : 'text-slate-500'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="mr-0.5 inline-block w-4 text-center text-slate-400">·</span>
        )}

        <span className="truncate">{node.label}</span>

        {node.badge && node.kind !== 'component' && (
          <span
            className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
              selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {node.badge}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
              defaultExpanded={depth < 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default CourseTree;
