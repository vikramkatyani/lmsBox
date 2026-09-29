import { Link } from 'react-router-dom';

const highlights = [
  'You own the content or have permission to use it, including media and third-party files.',
  'Content must be lawful, accurate, and appropriate for the learners who will take the course.',
  'Do not upload copyrighted, harmful, misleading, or privacy-sensitive material without a lawful basis.',
];

export default function ContentPolicyAcknowledgement({ accepted, onChange, showError }) {
  return (
    <div className={`rounded-lg border p-4 ${showError && !accepted ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <h2 className="text-sm font-semibold text-gray-900">Content Policy</h2>
      <p className="mt-1 text-sm text-gray-600">
        A new course can be created only after you acknowledge and accept the content policy.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <Link
          to="/admin/content-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#1b365d] underline hover:text-[#0f2340]"
        >
          Read the full Content Policy
        </Link>
      </p>
      <label className="mt-4 flex items-start gap-2">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-800">
          I have read, understood, and accept the Content Policy for this course.
        </span>
      </label>
      {showError && !accepted && (
        <p className="mt-2 text-sm text-red-600">Accept the Content Policy before creating this course.</p>
      )}
    </div>
  );
}
