'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MainContent, TopBar } from '@/components/layout';
import { apiClient } from '@/utils/api';
import useJobsList from '@/hooks/useJobsList';
import { useCurrentLocale } from '@/i18n/useCurrentLocale';
import { JobSummary } from '@/types';

export default function JobsPage() {
  const t = useTranslations('jobs');
  const tCommon = useTranslations('common');
  const locale = useCurrentLocale();
  const [showArchived, setShowArchived] = useState(false);
  const [jobTypeFilter, setJobTypeFilter] = useState<'all' | 'train' | 'infer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'queued' | 'running' | 'stopping' | 'stopped' | 'completed' | 'error'>('all');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; names: string[] } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { jobs, refreshJobs } = useJobsList({ reloadInterval: 5000, includeArchived: showArchived });

  const archiveJob = async (jobId: string, archived = true) => {
    await apiClient.post(`/api/jobs/${jobId}/archive`, { archived });
    refreshJobs();
  };

  const deleteJob = async (jobId: string) => {
    setIsDeleting(true);
    await apiClient.post(`/api/jobs/${jobId}/delete`);
    setPendingDelete(null);
    setIsDeleting(false);
    refreshJobs();
  };

  const archiveJobs = async (jobIds: string[], archived = true) => {
    if (jobIds.length === 0) return;
    setIsArchiving(true);
    try {
      await Promise.all(jobIds.map(jobId => apiClient.post(`/api/jobs/${jobId}/archive`, { archived })));
      setSelectedJobIds(current => current.filter(id => !jobIds.includes(id)));
      refreshJobs();
    } finally {
      setIsArchiving(false);
    }
  };

  const deleteJobs = async (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.all(jobIds.map(jobId => apiClient.post(`/api/jobs/${jobId}/delete`)));
      setSelectedJobIds(current => current.filter(id => !jobIds.includes(id)));
      setPendingDelete(null);
      refreshJobs();
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (jobTypeFilter !== 'all' && job.job_type !== jobTypeFilter) return false;
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      return true;
    });
  }, [jobs, jobTypeFilter, statusFilter]);

  useEffect(() => {
    const validIds = new Set(filteredJobs.map(job => job.id));
    setSelectedJobIds(current => current.filter(id => validIds.has(id)));
    setExpandedJobIds(current => current.filter(id => validIds.has(id)));
    setOpenMenuJobId(current => (current && validIds.has(current) ? current : null));
  }, [filteredJobs]);

  const selectedJobs = useMemo(
    () => filteredJobs.filter(job => selectedJobIds.includes(job.id)),
    [filteredJobs, selectedJobIds],
  );
  const selectableJobs = useMemo(
    () => filteredJobs.filter(job => !['running', 'stopping'].includes(job.status)),
    [filteredJobs],
  );
  const selectedCount = selectedJobs.length;
  const canSelectAll = selectableJobs.length > 0;
  const allSelectableSelected = canSelectAll && selectableJobs.every(job => selectedJobIds.includes(job.id));
  const selectedArchivableJobs = selectedJobs.filter(job => !['queued', 'running', 'stopping'].includes(job.status));
  const selectedArchivedCount = selectedJobs.filter(job => job.is_archived).length;
  const selectedUnarchivedCount = selectedJobs.filter(job => !job.is_archived).length;
  const canBulkDelete = selectedJobs.length > 0 && selectedJobs.every(job => !['running', 'stopping'].includes(job.status));
  const canBulkArchive = selectedArchivableJobs.some(job => !job.is_archived);
  const canBulkUnarchive = selectedArchivableJobs.some(job => job.is_archived);

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
        <div className="flex-1" />
        <Link href="/jobs/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">{tCommon('newTrain')}</Link>
      </TopBar>
      <MainContent>
        <div className="rounded-xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h2 className="text-lg font-semibold">{t('allJobs')}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={jobTypeFilter}
                  onChange={e => setJobTypeFilter(e.target.value as typeof jobTypeFilter)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">{t('allTypes')}</option>
                  <option value="train">{t('train')}</option>
                  <option value="infer">{t('infer')}</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">{t('allStatuses')}</option>
                  <option value="draft">{t('draft')}</option>
                  <option value="queued">{t('queued')}</option>
                  <option value="running">{t('running')}</option>
                  <option value="stopping">{t('stopping')}</option>
                  <option value="stopped">{t('stopped')}</option>
                  <option value="completed">{t('completed')}</option>
                  <option value="error">{t('error')}</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                  {t('showArchived')}
                </label>
                <div className="text-xs text-gray-500">{t('count', { count: filteredJobs.length })}</div>
                <button onClick={refreshJobs} className="text-sm text-blue-400">{tCommon('refresh')}</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  disabled={!canSelectAll}
                  onChange={event => {
                    if (event.target.checked) {
                      setSelectedJobIds(selectableJobs.map(job => job.id));
                    } else {
                      setSelectedJobIds([]);
                    }
                  }}
                />
                {t('selectVisible')}
              </label>
              <div className="text-xs text-gray-500">{t('selected', { count: selectedCount })}</div>
              <button
                onClick={() => void archiveJobs(selectedArchivableJobs.filter(job => !job.is_archived).map(job => job.id), true)}
                disabled={!canBulkArchive || isArchiving}
                className="rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isArchiving && selectedUnarchivedCount > 0 ? tCommon('working') : t('archiveSelected')}
              </button>
              <button
                onClick={() => void archiveJobs(selectedArchivableJobs.filter(job => job.is_archived).map(job => job.id), false)}
                disabled={!canBulkUnarchive || isArchiving}
                className="rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isArchiving && selectedArchivedCount > 0 ? tCommon('working') : t('unarchiveSelected')}
              </button>
              <button
                onClick={() => setPendingDelete({ ids: selectedJobs.map(job => job.id), names: selectedJobs.map(job => job.name) })}
                disabled={!canBulkDelete || isDeleting}
                className="rounded-md border border-red-900 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('deleteSelected')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed text-left text-sm text-gray-300">
              <thead className="border-b border-gray-800 bg-gray-950/60 text-xs uppercase tracking-[0.18em] text-gray-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="w-[34rem] px-5 py-3">{t('job')}</th>
                  <th className="w-20 px-4 py-3">{t('type')}</th>
                  <th className="w-20 px-4 py-3">{t('gpu')}</th>
                  <th className="w-24 px-4 py-3">{t('progress')}</th>
                  <th className="w-28 px-4 py-3">{t('status')}</th>
                  <th className="w-28 px-4 py-3">{t('updated')}</th>
                  <th className="w-20 px-5 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => {
                  const archiveLocked = ['queued', 'running', 'stopping'].includes(job.status);
                  const deleteLocked = ['running', 'stopping'].includes(job.status);
                  const checked = selectedJobIds.includes(job.id);
                  const expanded = expandedJobIds.includes(job.id);
                  const summary = job.info || job.artifact_root;
                  return (
                    <tr key={job.id} className="border-b border-gray-800/80 hover:bg-gray-950/70">
                      <td className="px-4 py-4">
                        {!deleteLocked ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => toggleJobSelection(job, event.target.checked, setSelectedJobIds)}
                            aria-label={t('selectJob', { name: job.name })}
                          />
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/jobs/${job.id}`} className="block min-w-0 max-w-[34rem]">
                          <div className="truncate font-medium text-gray-100" title={job.name}>{job.name}</div>
                        </Link>
                        <div className="mt-1 flex items-start gap-2">
                          <div
                            className={expanded ? 'text-xs text-gray-500 break-words' : 'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500'}
                            title={summary}
                          >
                            {summary}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedJobIds(current =>
                                current.includes(job.id) ? current.filter(id => id !== job.id) : [...current, job.id],
                              )
                            }
                            className="shrink-0 rounded border border-gray-800 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-500 hover:border-gray-700 hover:text-gray-300"
                          >
                            {expanded ? t('less') : t('more')}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs uppercase text-gray-400">{job.job_type === 'train' ? t('train') : t('infer')}</td>
                      <td className="px-4 py-4 text-sm text-gray-300">{job.gpu_ids}</td>
                      <td className="px-4 py-4 text-sm text-gray-300">
                        {job.progress_current}/{job.progress_total || 0}
                        {job.is_archived ? <span className="ml-2 rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-500">{t('archived')}</span> : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${statusBadgeClass(job.status)}`}>{jobStatusLabel(job.status, t)}</span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">{formatTimestamp(job.updated_at, locale)}</td>
                      <td className="px-5 py-4">
                        <div className="relative flex justify-end">
                          {archiveLocked && deleteLocked ? (
                            <span className="text-xs text-gray-600">{t('locked')}</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setOpenMenuJobId(current => (current === job.id ? null : job.id))}
                                className="rounded-md border border-gray-700 px-2.5 py-2 text-sm font-medium text-gray-200 hover:border-gray-600"
                                aria-label={t('openActions', { name: job.name })}
                              >
                                ⋯
                              </button>
                              {openMenuJobId === job.id ? (
                                <div className="absolute right-0 top-11 z-20 w-36 rounded-xl border border-gray-800 bg-gray-950 p-1.5 shadow-2xl">
                                  {!archiveLocked ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuJobId(null);
                                        void archiveJob(job.id, !job.is_archived);
                                      }}
                                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-200 hover:bg-gray-900"
                                    >
                                      {job.is_archived ? t('unarchive') : t('archive')}
                                    </button>
                                  ) : null}
                                  {!deleteLocked ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuJobId(null);
                                        setPendingDelete({ ids: [job.id], names: [job.name] });
                                      }}
                                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-red-300 hover:bg-red-950/40"
                                    >
                                      {tCommon('delete')}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredJobs.length === 0 ? <div className="px-5 py-8 text-sm text-gray-500">{t('noMatch')}</div> : null}
          </div>
        </div>
      </MainContent>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.ids.length === 1 ? t('deleteJob') : t('deleteJobs')}
        message={buildDeleteMessage(pendingDelete, t)}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        busyLabel={tCommon('working')}
        tone="danger"
        busy={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            if (pendingDelete.ids.length === 1) {
              await deleteJob(pendingDelete.ids[0]);
            } else {
              await deleteJobs(pendingDelete.ids);
            }
          } catch (error) {
            console.error('Failed to delete job', error);
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
}

function formatTimestamp(value: string, locale: 'en' | 'zh') {
  try {
    return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function statusBadgeClass(status: string) {
  if (status === 'running') return 'border border-emerald-900 bg-emerald-950/50 text-emerald-300';
  if (status === 'queued' || status === 'draft') return 'border border-amber-900 bg-amber-950/50 text-amber-300';
  if (status === 'completed') return 'border border-sky-900 bg-sky-950/50 text-sky-300';
  if (status === 'stopping' || status === 'stopped') return 'border border-orange-900 bg-orange-950/50 text-orange-300';
  if (status === 'error') return 'border border-red-900 bg-red-950/50 text-red-300';
  return 'border border-gray-800 bg-gray-950 text-gray-400';
}

function jobStatusLabel(
  status: JobSummary['status'],
  t: ReturnType<typeof useTranslations<'jobs'>>,
) {
  return t(`allStatusesLabel.${status}`);
}

function toggleJobSelection(
  job: JobSummary,
  checked: boolean,
  setSelectedJobIds: React.Dispatch<React.SetStateAction<string[]>>,
) {
  if (['running', 'stopping'].includes(job.status)) return;
  setSelectedJobIds(current => {
    if (checked) {
      return current.includes(job.id) ? current : [...current, job.id];
    }
    return current.filter(id => id !== job.id);
  });
}

function buildDeleteMessage(
  pendingDelete: { ids: string[]; names: string[] } | null,
  t: ReturnType<typeof useTranslations<'jobs'>>,
) {
  if (!pendingDelete) return '';
  if (pendingDelete.ids.length === 1) {
    return t('deleteSingleMessage', { name: pendingDelete.names[0] });
  }
  const preview = pendingDelete.names.slice(0, 5).map(name => `- ${name}`).join('\n');
  const more = pendingDelete.names.length > 5 ? t('andMore', { count: pendingDelete.names.length - 5 }) : '';
  return t('deleteMultiMessage', { count: pendingDelete.ids.length, items: preview, more });
}
