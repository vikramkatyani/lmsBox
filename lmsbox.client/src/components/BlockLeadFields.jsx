const MAX_HEADING = 200;
const MAX_INTRO = 500;

export default function BlockLeadFields({
  value,
  onChange,
  showHeading = true,
  showIntro = true,
}) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <>
      {showHeading && (
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={value.heading || ''}
            onChange={(e) => update({ heading: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="Optional title shown to learners"
            maxLength={MAX_HEADING}
          />
        </div>
      )}
      {showIntro && (
        <div>
          <label className="block text-sm font-medium mb-1">Introduction</label>
          <textarea
            value={value.intro || ''}
            onChange={(e) => update({ intro: e.target.value })}
            className="w-full border rounded px-3 py-2"
            rows={2}
            placeholder="Optional short introduction"
            maxLength={MAX_INTRO}
          />
        </div>
      )}
    </>
  );
}
