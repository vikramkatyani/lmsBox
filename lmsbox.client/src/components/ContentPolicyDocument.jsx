import { CONTENT_POLICY_UPDATED_LABEL, CONTENT_POLICY_VERSION, contentPolicySections } from '../content/contentPolicy';

export default function ContentPolicyDocument() {
  return (
    <article className="space-y-8 text-gray-700">
      <p className="text-sm text-gray-500">
        Version {CONTENT_POLICY_VERSION} · Last updated {CONTENT_POLICY_UPDATED_LABEL}
      </p>
      {contentPolicySections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6">{paragraph}</p>
          ))}
          {section.bullets?.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-sm leading-6">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
