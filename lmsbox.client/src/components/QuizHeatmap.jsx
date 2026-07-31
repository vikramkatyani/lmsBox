function heatColor(value) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const r = Math.round(220 + (v / 100) * 35);
  const g = Math.round(200 - (v / 100) * 170);
  const b = Math.round(120 - (v / 100) * 100);
  return `rgb(${r}, ${g}, ${b})`;
}

const TITLE_SEPARATORS = [' — ', ' – ', ' - '];

function resolveCourseAndQuiz(item, labelKey) {
  const apiCourseName = (item.courseName || item.CourseName || '').trim();
  const rawLabel = (item[labelKey] ?? item.quizTitle ?? item.category ?? item.question ?? '—').trim();

  if (apiCourseName) {
    let quizName = rawLabel;
    for (const sep of TITLE_SEPARATORS) {
      const prefix = `${apiCourseName}${sep}`;
      if (quizName.startsWith(prefix)) {
        quizName = quizName.slice(prefix.length).trim();
        break;
      }
    }
    return { courseName: apiCourseName, quizName: quizName || rawLabel };
  }

  for (const sep of TITLE_SEPARATORS) {
    const idx = rawLabel.indexOf(sep);
    if (idx > 0) {
      const courseName = rawLabel.slice(0, idx).trim();
      const quizName = rawLabel.slice(idx + sep.length).trim();
      if (courseName && quizName) {
        return { courseName, quizName };
      }
    }
  }

  return { courseName: '', quizName: rawLabel };
}

export default function QuizHeatmap({
  title,
  description,
  items,
  valueKey = 'incorrectRate',
  labelKey = 'label',
  subLabelKey,
  emptyMessage,
  onItemClick,
  singleCard = false,
  valueSuffix = 'fail',
  showCourseDetails = false
}) {
  if (!items?.length) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        <p className="text-sm text-gray-400 mt-4 py-6 text-center">{emptyMessage || 'No data yet'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-1 mb-3">{description}</p>}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span>Easy</span>
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-green-300 via-yellow-300 to-red-500 max-w-[120px]" />
        <span>Hard</span>
      </div>
      <div className={
        singleCard
          ? 'max-w-md'
          : showCourseDetails
            ? 'grid grid-cols-[repeat(auto-fill,minmax(200px,240px))] gap-3 max-h-96 overflow-y-auto content-start'
            : items.some((item) => (item.courseName || item.CourseName)?.trim())
              ? 'grid grid-cols-[repeat(auto-fill,minmax(200px,240px))] gap-3 max-h-96 overflow-y-auto content-start'
              : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto'
      }>
        {items.map((item, idx) => {
          const value = item[valueKey] ?? 0;
          const { courseName, quizName } = resolveCourseAndQuiz(item, labelKey);
          const hasCourseContext = showCourseDetails || Boolean(courseName);
          const sub = subLabelKey
            ? (subLabelKey === 'answerCount' && item.answerCount != null
              ? `${item.answerCount} answers`
              : subLabelKey === 'attemptCount' && item.attemptCount != null
                ? `${item.attemptCount} attempt${item.attemptCount === 1 ? '' : 's'}`
                : item[subLabelKey])
            : (item.attemptCount != null
              ? `${item.attemptCount} attempt${item.attemptCount === 1 ? '' : 's'}`
              : (item.answerCount != null ? `${item.answerCount} answers` : null));
          const clickable = !singleCard && typeof onItemClick === 'function' && (item.quizId || item.questionId);
          const CardTag = clickable ? 'button' : 'div';
          const tooltip = [courseName, quizName, `${value}% ${valueSuffix}`].filter(Boolean).join(' · ');
          return (
            <CardTag
              key={`${item.courseId || ''}-${item.quizId || item.questionId || item.category || idx}`}
              title={tooltip}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? () => onItemClick(item) : undefined}
              className={`rounded-md border border-white/50 shadow-sm flex flex-col text-left transition ${
                singleCard
                  ? 'p-4 text-sm min-h-[6.5rem] w-full'
                  : hasCourseContext
                    ? 'p-3 text-xs min-h-[6.5rem] w-full'
                    : 'p-2 text-xs min-h-[4rem] w-full'
              } ${
                clickable ? 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-white/70 focus:outline-none focus:ring-2 focus:ring-[#1b365d]/30' : 'cursor-default'
              }`}
              style={{ backgroundColor: heatColor(value), color: value > 55 ? '#fff' : '#1b365d' }}
            >
              {hasCourseContext ? (
                <div className="space-y-1 mb-2">
                  {courseName && (
                    <span className={`block opacity-90 leading-snug break-words ${singleCard ? 'text-xs' : 'text-[0.65rem]'}`}>
                      {courseName}
                    </span>
                  )}
                  <span className={`block font-semibold leading-snug break-words ${singleCard ? 'text-base' : 'text-xs'}`}>
                    {quizName}
                  </span>
                </div>
              ) : (
                <span className={`font-medium line-clamp-2 leading-tight ${singleCard ? 'text-base' : ''}`}>{quizName}</span>
              )}
              <div className="mt-auto">
                {sub && <span className="opacity-80 block mt-1">{sub}</span>}
                <span className={`font-bold block mt-1 ${singleCard ? 'text-lg' : ''}`}>{value}% {valueSuffix}</span>
              </div>
            </CardTag>
          );
        })}
      </div>
    </div>
  );
}

