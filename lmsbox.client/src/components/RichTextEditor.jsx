import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from 'lucide-react';

const DEFAULT_MAX_CHARACTERS = 10000;

// Heading levels are offered as "Heading 1/2/3" but map to h2/h3/h4 so the block heading
// above the body stays the top level for screen readers.
const TEXT_STYLES = [
  { value: 'paragraph', label: 'Normal text' },
  { value: 'h2', label: 'Heading 1' },
  { value: 'h3', label: 'Heading 2' },
  { value: 'h4', label: 'Heading 3' },
];

// Kept in sync with the sanitizer allow-list on the server. The floor is 14px so authored
// text cannot drop below the WCAG baseline.
const FONT_SIZES = [
  { value: '', label: 'Default size' },
  { value: '0.875rem', label: 'Small (14px)' },
  { value: '1rem', label: 'Normal (16px)' },
  { value: '1.125rem', label: 'Large (18px)' },
  { value: '1.25rem', label: 'Extra large (20px)' },
];

function ToolbarButton({ label, icon, onClick, isActive = false, disabled = false }) {
  // JSX needs a capitalized identifier to treat this as a component.
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border transition
        ${isActive
          ? 'border-slate-400 bg-slate-200 text-slate-900'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600
        disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}

/**
 * Table operations are named rather than iconised: there are a dozen of them and
 * icon-only controls for "add row above" versus "add column before" are guesswork.
 */
function TableActionButton({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition
        hover:bg-slate-100 hover:text-slate-900
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600
        disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function TableActionGroup({ label, children }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </span>
  );
}

function normalizeHref(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  return `https://${trimmed}`;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write the text learners will read...',
  ariaLabel = 'Text content',
  maxCharacters = DEFAULT_MAX_CHARACTERS,
}) {
  const [linkDraft, setLinkDraft] = useState(null);
  const linkInputRef = useRef(null);
  const fieldPrefix = useId();

  // Keeps the latest handler reachable without rebuilding the editor instance.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Tracks what we last handed to the parent so echoed values do not reset the caret.
  const lastEmittedHtml = useRef(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
        },
      }),
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxCharacters }),
    ],
    content: value || '',
    // The toolbar reads its state through useEditorState, which only picks up the instance
    // that existed on the first render, so the editor must be built synchronously.
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: 'lmsbox-rte__content',
        'aria-label': ariaLabel,
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.isEmpty ? '' : instance.getHTML();
      lastEmittedHtml.current = html;
      onChangeRef.current?.({ html, text: instance.getText() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === lastEmittedHtml.current) return;
    lastEmittedHtml.current = incoming;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (linkDraft !== null) linkInputRef.current?.focus();
  }, [linkDraft]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return null;
      return {
        bold: instance.isActive('bold'),
        italic: instance.isActive('italic'),
        underline: instance.isActive('underline'),
        strike: instance.isActive('strike'),
        bulletList: instance.isActive('bulletList'),
        orderedList: instance.isActive('orderedList'),
        blockquote: instance.isActive('blockquote'),
        code: instance.isActive('code'),
        link: instance.isActive('link'),
        alignLeft: instance.isActive({ textAlign: 'left' }),
        alignCenter: instance.isActive({ textAlign: 'center' }),
        alignRight: instance.isActive({ textAlign: 'right' }),
        textStyle: instance.isActive('heading', { level: 2 })
          ? 'h2'
          : instance.isActive('heading', { level: 3 })
            ? 'h3'
            : instance.isActive('heading', { level: 4 })
              ? 'h4'
              : 'paragraph',
        fontSize: instance.getAttributes('textStyle').fontSize || '',
        inTable: instance.isActive('table'),
        canInsertTable: instance.can().insertTable(),
        canMergeCells: instance.can().mergeCells(),
        canSplitCell: instance.can().splitCell(),
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
        characters: instance.storage.characterCount.characters(),
      };
    },
  });

  const openLinkEditor = useCallback(() => {
    if (!editor) return;
    setLinkDraft(editor.getAttributes('link').href || '');
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const href = normalizeHref(linkDraft);
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected, so insert the address as its own link text.
      editor.chain().focus().insertContent({
        type: 'text',
        text: href.replace(/^mailto:/i, ''),
        marks: [{ type: 'link', attrs: { href } }],
      }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkDraft(null);
  }, [editor, linkDraft]);

  const removeLink = useCallback(() => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkDraft(null);
  }, [editor]);

  const changeTextStyle = useCallback(
    (style) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (style === 'paragraph') {
        chain.setParagraph().run();
        return;
      }
      chain.setHeading({ level: Number(style.slice(1)) }).run();
    },
    [editor],
  );

  const changeFontSize = useCallback(
    (size) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (size) chain.setFontSize(size).run();
      else chain.unsetFontSize().run();
    },
    [editor],
  );

  const clearFormatting = useCallback(() => {
    editor?.chain().focus().unsetAllMarks().clearNodes().run();
  }, [editor]);

  if (!editor || !toolbar) {
    return <div className="h-52 w-full animate-pulse rounded border bg-slate-50" />;
  }

  return (
    <div className="lmsbox-rte overflow-hidden rounded border border-slate-300 bg-white focus-within:border-slate-500">
      {/* role="group" rather than "toolbar": every control stays an ordinary tab stop,
          so there is no arrow-key navigation contract to honour. */}
      <div
        role="group"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5"
      >
        <label className="sr-only" htmlFor={`${fieldPrefix}-text-style`}>Text style</label>
        <select
          id={`${fieldPrefix}-text-style`}
          value={toolbar.textStyle}
          onChange={(e) => changeTextStyle(e.target.value)}
          className="h-8 rounded border border-slate-300 bg-white px-1.5 text-sm text-slate-800"
        >
          {TEXT_STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>

        <label className="sr-only" htmlFor={`${fieldPrefix}-font-size`}>Font size</label>
        <select
          id={`${fieldPrefix}-font-size`}
          value={toolbar.fontSize}
          onChange={(e) => changeFontSize(e.target.value)}
          className="h-8 rounded border border-slate-300 bg-white px-1.5 text-sm text-slate-800"
        >
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </select>

        <ToolbarDivider />

        <ToolbarButton
          label="Bold"
          icon={Bold}
          isActive={toolbar.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          isActive={toolbar.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Underline"
          icon={Underline}
          isActive={toolbar.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="Strikethrough"
          icon={Strikethrough}
          isActive={toolbar.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          label="Bulleted list"
          icon={List}
          isActive={toolbar.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered list"
          icon={ListOrdered}
          isActive={toolbar.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          label="Align left"
          icon={AlignLeft}
          isActive={toolbar.alignLeft}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          label="Align centre"
          icon={AlignCenter}
          isActive={toolbar.alignCenter}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          label="Align right"
          icon={AlignRight}
          isActive={toolbar.alignRight}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />

        <ToolbarDivider />

        <ToolbarButton
          label={toolbar.link ? 'Edit link' : 'Insert link'}
          icon={Link2}
          isActive={toolbar.link}
          onClick={openLinkEditor}
        />
        <ToolbarButton
          label="Remove link"
          icon={Link2Off}
          disabled={!toolbar.link}
          onClick={removeLink}
        />
        <ToolbarButton
          label="Quote"
          icon={Quote}
          isActive={toolbar.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Inline code"
          icon={Code}
          isActive={toolbar.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          label="Divider"
          icon={Minus}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <ToolbarButton
          label="Insert table"
          icon={TableIcon}
          disabled={!toolbar.canInsertTable}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        />

        <ToolbarDivider />

        <ToolbarButton label="Clear formatting" icon={RemoveFormatting} onClick={clearFormatting} />
        <ToolbarButton
          label="Undo"
          icon={Undo2}
          disabled={!toolbar.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          icon={Redo2}
          disabled={!toolbar.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {toolbar.inTable && (
        <div
          role="group"
          aria-label="Table"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-2 py-2"
        >
          <TableActionGroup label="Row">
            <TableActionButton
              label="Add above"
              onClick={() => editor.chain().focus().addRowBefore().run()}
            />
            <TableActionButton
              label="Add below"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            />
            <TableActionButton
              label="Delete"
              onClick={() => editor.chain().focus().deleteRow().run()}
            />
          </TableActionGroup>

          <TableActionGroup label="Column">
            <TableActionButton
              label="Add before"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            />
            <TableActionButton
              label="Add after"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            />
            <TableActionButton
              label="Delete"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            />
          </TableActionGroup>

          <TableActionGroup label="Header">
            <TableActionButton
              label="Row"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            />
            <TableActionButton
              label="Column"
              onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
            />
            <TableActionButton
              label="Cell"
              onClick={() => editor.chain().focus().toggleHeaderCell().run()}
            />
          </TableActionGroup>

          <TableActionGroup label="Cells">
            <TableActionButton
              label="Merge"
              disabled={!toolbar.canMergeCells}
              onClick={() => editor.chain().focus().mergeCells().run()}
            />
            <TableActionButton
              label="Split"
              disabled={!toolbar.canSplitCell}
              onClick={() => editor.chain().focus().splitCell().run()}
            />
          </TableActionGroup>

          <TableActionButton
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />

          <span className="text-xs text-slate-500">Drag a column edge to resize.</span>
        </div>
      )}

      {linkDraft !== null && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
          <label className="text-sm text-slate-700" htmlFor={`${fieldPrefix}-link`}>Link address</label>
          <input
            id={`${fieldPrefix}-link`}
            ref={linkInputRef}
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setLinkDraft(null);
              }
            }}
            placeholder="https://example.com or name@example.com"
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setLinkDraft(null)}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
        {toolbar.characters.toLocaleString()} / {maxCharacters.toLocaleString()} characters
      </div>
    </div>
  );
}
