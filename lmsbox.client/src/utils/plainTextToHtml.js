/**
 * Blocks saved before the rich text editor only have a plain text body, so promote it
 * to paragraphs the first time such a block is opened.
 */
export function plainTextToHtml(plain) {
  const text = (plain || '').trim();
  if (!text) return '';

  return text
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

export function initialRichHtml(value, htmlKey, plainKey) {
  if (value?.[htmlKey]) return value[htmlKey];
  return plainTextToHtml(value?.[plainKey] || '');
}
