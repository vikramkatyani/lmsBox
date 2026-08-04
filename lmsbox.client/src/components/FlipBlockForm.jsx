import React from 'react';
import toast from 'react-hot-toast';

const MAX_CARDS = 8;
const MAX_FRONT_TITLE = 200;
const MAX_BACK_BODY = 1000;
const MAX_HINT = 60;

const EMPTY_CARD = { frontTitle: '', backBody: '', frontHint: '', backHint: '' };

export default function FlipBlockForm({ value, onChange }) {
  const cards = Array.isArray(value.cards) ? value.cards : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const updateCard = (index, patch) => {
    update({
      cards: cards.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    });
  };

  const addCard = () => {
    if (cards.length >= MAX_CARDS) {
      toast.error(`A flip cards block can have at most ${MAX_CARDS} cards`);
      return;
    }
    update({ cards: [...cards, { ...EMPTY_CARD }] });
  };

  const removeCard = (index) => {
    update({ cards: cards.filter((_, i) => i !== index) });
  };

  const moveCard = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cards.length) return;
    const reordered = [...cards];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ cards: reordered });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every card has been flipped once. A single card fills the width, otherwise cards use a 2-column grid.
      </p>

      <div className="space-y-4">
        <h4 className="font-medium">Cards ({cards.length}/{MAX_CARDS})</h4>

        {cards.length === 0 && (
          <p className="text-sm text-gray-500">No cards yet. Add at least one card below.</p>
        )}

        {cards.map((card, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Card {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveCard(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveCard(index, 'down')}
                  disabled={index === cards.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeCard(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Front title *</label>
              <input
                value={card.frontTitle || ''}
                onChange={(e) => updateCard(index, { frontTitle: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="The term or question on the front"
                maxLength={MAX_FRONT_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Back body *</label>
              <textarea
                value={card.backBody || ''}
                onChange={(e) => updateCard(index, { backBody: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="The answer revealed on the back"
                maxLength={MAX_BACK_BODY}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Front hint</label>
                <input
                  value={card.frontHint || ''}
                  onChange={(e) => updateCard(index, { frontHint: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Tap to flip"
                  maxLength={MAX_HINT}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Back hint</label>
                <input
                  value={card.backHint || ''}
                  onChange={(e) => updateCard(index, { backHint: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Definition"
                  maxLength={MAX_HINT}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCard}
          disabled={cards.length >= MAX_CARDS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add card
        </button>
      </div>
    </div>
  );
}
