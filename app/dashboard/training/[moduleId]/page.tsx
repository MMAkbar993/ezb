'use client'

import TrainingModule from '@/components/training/TrainingModule'

export default function TrainingModulePage({ params }: { params: { moduleId: string } }) {
  return <TrainingModule moduleId={params.moduleId} />
}
