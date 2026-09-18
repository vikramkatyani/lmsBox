import React from 'react';
import { useParams } from 'react-router-dom';
import InteractiveLessonPlayer from '../components/InteractiveLessonPlayer';
import usePageTitle from '../hooks/usePageTitle';

export default function InteractiveLessonPreview() {
  const { lessonId } = useParams();
  usePageTitle('Preview Interactive Lesson');

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('courseId') || '';

  return (
    <div className="min-h-screen bg-[var(--color-page-bg,#F5F5EF)]">
      <main className="max-w-7xl mx-auto p-4">
        <InteractiveLessonPlayer courseId={courseId} lessonId={lessonId} preview />
      </main>
    </div>
  );
}
