'use client';

import { useEffect, useMemo, useState } from 'react';
import { ModelSourceOption, buildModelSourceOptions, resolveSelectedModelSource } from '@/domain/modelSource';
import { JobSummary } from '@/types';

export default function useModelSourceSelection({
  jobs,
  baseLabel,
  baseModel,
}: {
  jobs: Pick<JobSummary, 'id' | 'name' | 'job_type' | 'config_json' | 'artifact_root'>[];
  baseLabel: string;
  baseModel?: string;
}) {
  const [sourceTrainJobId, setSourceTrainJobId] = useState<string | null>(null);
  const [checkpointPath, setCheckpointPath] = useState('');

  const modelSourceOptions = useMemo(
    () =>
      buildModelSourceOptions({
        jobs,
        baseLabel,
        baseModel,
      }),
    [baseLabel, baseModel, jobs],
  );

  const selectedModelSource = useMemo(
    () => resolveSelectedModelSource(modelSourceOptions, sourceTrainJobId),
    [modelSourceOptions, sourceTrainJobId],
  );

  useEffect(() => {
    setCheckpointPath(selectedModelSource.checkpointPath);
  }, [selectedModelSource.id, selectedModelSource.checkpointPath]);

  const selectModelSource = (option: ModelSourceOption) => {
    setSourceTrainJobId(option.sourceTrainJobId);
    setCheckpointPath(option.checkpointPath);
  };

  return {
    checkpointPath,
    modelSourceOptions,
    selectedModelSource,
    selectModelSource,
    setCheckpointPath,
    setSourceTrainJobId,
    sourceTrainJobId,
  };
}
