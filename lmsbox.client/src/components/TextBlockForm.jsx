import React, { useCallback } from 'react';
import RichTextEditor from './RichTextEditor';

const MAX_BODY_CHARACTERS = 10000;

/**
 * Blocks saved before the rich text editor only have a plain text body, so promote it
 * to paragraphs the first time such a block is opened.
 */
function toInitialHtml(value) {
  if (value.bodyHtml) return value.bodyHtml;

  const plain = (value.body || '').trim();
  if (!plain) return '';

  return plain
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

export default function TextBlockForm({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const showContinueButton = value.showContinueButton !== false;

  // The plain text mirror stays in `body` so older readers of the payload keep working.
  const handleBodyChange = useCallback(
    ({ html, text }) => {
      onChange({ ...value, bodyHtml: html, body: text });
    },
    [onChange, value],
  );

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <label className="block text-sm font-medium mb-1">Heading</label>
        <input
          value={value.heading || ''}
          onChange={(e) => update({ heading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional main heading"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subheading</label>
        <input
          value={value.subheading || ''}
          onChange={(e) => update({ subheading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional supporting line"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Text content *</label>
        <RichTextEditor
          value={toInitialHtml(value)}
          onChange={handleBodyChange}
          ariaLabel="Text content"
          placeholder="Write the text learners will read..."
          maxCharacters={MAX_BODY_CHARACTERS}
        />
        <p className="text-xs text-gray-500 mt-1">
          Use the toolbar for headings, font sizes, lists, links, and tables. Links open in a new tab,
          and table controls appear when the cursor is inside a table.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={showContinueButton}
          onChange={(e) => update({ showContinueButton: e.target.checked })}
        />
        <span>
          <span className="font-medium">Show Continue button</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {showContinueButton
              ? 'Learners must tap Continue to complete this block.'
              : 'No Continue button — the block completes automatically when shown.'}
          </span>
        </span>
      </label>
    </div>
  );
}
