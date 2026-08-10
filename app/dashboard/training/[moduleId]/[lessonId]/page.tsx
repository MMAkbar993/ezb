'use client'

import TrainingLessonView from '@/components/training/TrainingLesson'

export default function TrainingLessonPage({
  params,
}: {
  params: { moduleId: string; lessonId: string }
}) {
  return <TrainingLessonView moduleId={params.moduleId} lessonId={params.lessonId} />
}
