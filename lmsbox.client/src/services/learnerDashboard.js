import { getMyCourses } from './learnerCourses';
import { getCourseDetails } from './courseDetails';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function deriveLessonStatus(lesson) {
  if (lesson.isCompleted || toNumber(lesson.progress) >= 100) {
    return 'Completed';
  }

  if (toNumber(lesson.progress) > 0 || lesson.lastAccessedAt) {
    return 'In Progress';
  }

  return 'Not Started';
}

export async function getLearnerDashboardSnapshot(signal = null) {
  const courses = await getMyCourses('', 'all', signal);

  if (!Array.isArray(courses) || courses.length === 0) {
    return {
      courses: [],
      lessons: [],
      stats: {
        totalCourses: 0,
        completedCourses: 0,
        inProgressCourses: 0,
        totalLessons: 0,
        completedLessons: 0,
        inProgressLessons: 0,
        notStartedLessons: 0,
        averageCourseProgress: 0,
      },
    };
  }

  const detailResults = await Promise.all(
    courses.map(async (course) => {
      const detail = await getCourseDetails(course.id, signal);
      return {
        course,
        detail,
      };
    })
  );

  const normalizedCourses = detailResults.map(({ course, detail }) => {
    const lessons = Array.isArray(detail?.lessons) ? detail.lessons : [];
    return {
      id: course.id,
      title: course.title,
      banner: course.banner,
      progress: toNumber(course.progress),
      isCompleted: course.isCompleted || toNumber(course.progress) >= 100,
      enrolledDate: course.enrolledDate || null,
      lastAccessedDate: course.lastAccessedDate || null,
      lessons,
    };
  });

  const lessonRecords = normalizedCourses.flatMap((course) =>
    course.lessons.map((lesson) => {
      const progress = toNumber(lesson.progress);
      return {
        id: `${course.id}-${lesson.id}`,
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonType: lesson.type || 'content',
        ordinal: lesson.ordinal || 0,
        progress,
        isCompleted: Boolean(lesson.isCompleted) || progress >= 100,
        lastAccessedAt: lesson.lastAccessedAt || null,
        completedAt: lesson.completedAt || null,
        duration: lesson.duration || '',
      };
    })
  );

  const completedCourses = normalizedCourses.filter((c) => c.isCompleted).length;
  const inProgressCourses = normalizedCourses.filter((c) => c.progress > 0 && c.progress < 100).length;

  const completedLessons = lessonRecords.filter((l) => l.isCompleted).length;
  const inProgressLessons = lessonRecords.filter((l) => deriveLessonStatus(l) === 'In Progress').length;
  const notStartedLessons = lessonRecords.filter((l) => deriveLessonStatus(l) === 'Not Started').length;

  const averageCourseProgress = normalizedCourses.length
    ? Math.round(
        normalizedCourses.reduce((acc, course) => acc + toNumber(course.progress), 0) /
          normalizedCourses.length
      )
    : 0;

  return {
    courses: normalizedCourses,
    lessons: lessonRecords,
    stats: {
      totalCourses: normalizedCourses.length,
      completedCourses,
      inProgressCourses,
      totalLessons: lessonRecords.length,
      completedLessons,
      inProgressLessons,
      notStartedLessons,
      averageCourseProgress,
    },
  };
}
