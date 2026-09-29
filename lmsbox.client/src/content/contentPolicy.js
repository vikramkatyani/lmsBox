/** Keep in sync with lmsbox.domain.Models.ContentPolicy.CurrentVersion. */
export const CONTENT_POLICY_VERSION = '2026-09-29';

export const CONTENT_POLICY_UPDATED_LABEL = '29 September 2026';

export const contentPolicySections = [
  {
    id: 'purpose',
    title: '1. Purpose',
    paragraphs: [
      'This Content Policy sets the rules for courses, lessons, assessments, media, and resources created or uploaded on LMSBox. It exists so learners receive lawful, appropriate, and accurate training.',
      'An administrator can create a new course only after they acknowledge and accept this policy.',
    ],
  },
  {
    id: 'who',
    title: '2. Who this applies to',
    paragraphs: [
      'This policy applies to every person who creates or publishes course content, including organisation administrators, tenant administrators, and platform administrators.',
    ],
  },
  {
    id: 'responsibilities',
    title: '3. Your responsibilities',
    paragraphs: [
      'You are responsible for the content you add. Before a course is published to learners, check that the material is accurate, suitable for the intended audience, and lawful to distribute.',
      'Accepting this policy applies to the course you are creating. You confirm that the course, and the lessons and files you add to it, will follow these rules.',
    ],
  },
  {
    id: 'rights',
    title: '4. Rights and licensing',
    paragraphs: [
      'Upload only content you own or have permission to use. That includes text, images, video, audio, documents, SCORM packages, HTML, and any third-party or AI-assisted material.',
      'Do not copy books, articles, slides, videos, or other copyrighted work unless you have a licence, a written permission, or another clear legal right to use it in this course.',
    ],
  },
  {
    id: 'prohibited',
    title: '5. Prohibited content',
    paragraphs: [
      'Do not create, upload, or publish content that:',
    ],
    bullets: [
      'Infringes copyright, trademarks, or other intellectual property rights',
      'Is unlawful, defamatory, harassing, hateful, or discriminatory',
      'Sexualises or exploits minors, or is otherwise exploitative',
      'Promotes violence, illegal activity, or instructions for causing harm',
      'Contains malware, phishing, or attempts to collect credentials or secrets',
      'Includes personal data about learners or other people without a lawful reason',
      'Misleads learners about qualifications, certificates, completion, or required training',
    ],
  },
  {
    id: 'privacy',
    title: '6. Learner privacy',
    paragraphs: [
      'Keep personal information out of course content unless the training genuinely needs it. Assessments, surveys, and examples should collect or display only what is necessary.',
    ],
  },
  {
    id: 'quality',
    title: '7. Quality',
    paragraphs: [
      'Titles, descriptions, lessons, and quiz answers should be clear and fit for the audience. Review a draft course before you publish it.',
    ],
  },
  {
    id: 'enforcement',
    title: '8. Review and enforcement',
    paragraphs: [
      'Courses that break this policy may be unpublished or removed. Acceptance is recorded with the course, including the policy version and the time you accepted it.',
    ],
  },
  {
    id: 'acceptance',
    title: '9. Acceptance',
    paragraphs: [
      'By accepting, you confirm that you have read this Content Policy and that the course you create will comply with it.',
    ],
  },
];
