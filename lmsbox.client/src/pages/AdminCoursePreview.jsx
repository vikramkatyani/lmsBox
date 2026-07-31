import React from 'react';
import CourseContent from './CourseContent';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminCoursePreview() {
  usePageTitle('Course Preview');

  return <CourseContent previewMode />;
}
