'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Heart, Image as ImageIcon, Loader2, RefreshCw, Repeat2, RotateCcw, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { JobResult } from '@/types';

export interface InferenceHistoryItem {
  id: string;
  name: string;
  info: string;
}

interface InferenceOutputPanelProps {
  results: JobResult[];
  history: InferenceHistoryItem[];
  favoriteImagePaths: string[];
  isSubmittingReplay: boolean;
  activeRequest?: {
    id: string;
    name: string;
    status?: string;
    info?: string;
  } | null;
  activeHasResult?: boolean;
  focusImagePath?: string | null;
  onRefresh: () => void;
  onToggleFavorite: (item: JobResult) => void;
  onReuse: (item: JobResult) => void;
  onReplay: (item: JobResult) => void;
  onDelete: (item: JobResult) => void | Promise<void>;
}

export default function InferenceOutputPanel({
  results,
  history,
  favoriteImagePaths,
  isSubmittingReplay,
  activeRequest = null,
  activeHasResult = false,
  focusImagePath = null,
  onRefresh,
  onToggleFavorite,
  onReuse,
  onReplay,
  onDelete,
}: InferenceOutputPanelProps) {
  const t = useTranslations('inferencePage');
  const tGallery = useTranslations('inferenceGallery');
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<JobResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JobResult | null>(null);
  const [deleting, setDeleting] = useState(false);

  const favoriteSet = useMemo(() => new Set(favoriteImagePaths), [favoriteImagePaths]);
  const selectedResult = useMemo(() => {
    if (!results.length) return null;
    return results.find(item => item.image_path === selectedImagePath) ?? results[0];
  }, [results, selectedImagePath]);

  useEffect(() => {
    if (!results.length) {
      setSelectedImagePath(null);
      return;
    }
    if (!selectedImagePath || !results.some(item => item.image_path === selectedImagePath)) {
      setSelectedImagePath(results[0].image_path);
    }
  }, [results, selectedImagePath]);

  const isFavorite = selectedResult ? favoriteSet.has(selectedResult.image_path) : false;
  const openHref = selectedResult?.job_id ? `/jobs/${selectedResult.job_id}` : selectedResult?.image_url || '#';
  const activeStatus = activeRequest?.status || 'queued';
  const activeIsTerminal = ['completed', 'error', 'stopped'].includes(activeStatus);
  const showActivePending = Boolean(activeRequest) && !activeHasResult && !activeIsTerminal;
  const showActiveTerminalWithoutResult = Boolean(activeRequest) && !activeHasResult && activeIsTerminal;

  useEffect(() => {
    if (!focusImagePath || !results.some(item => item.image_path === focusImagePath)) return;
    setSelectedImagePath(focusImagePath);
  }, [focusImagePath, results]);

  return (
    <>
      <section
        data-panel-role="infer-right"
        data-layout-area="image-output"
        className="min-w-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-300">{t('outputPanelTitle')}</h2>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-sm font-medium text-gray-500 transition hover:border-gray-700 hover:bg-gray-900 hover:text-gray-300"
          >
            <RefreshCw className="h-4 w-4" />
            {t('refreshOutput')}
          </button>
        </div>

        <div className="p-4">
          <div
            data-output-role="preview-frame"
            className="flex min-h-[420px] items-center justify-center rounded-lg border border-gray-800 bg-gray-950 p-4 xl:min-h-[520px]"
          >
            {showActivePending ? (
              <GenerationPendingState
                title={t('outputPendingTitle')}
                status={activeStatus}
                name={activeRequest?.name || ''}
                info={activeRequest?.info || t('outputPendingQueued')}
              />
            ) : showActiveTerminalWithoutResult ? (
              <div className="flex max-w-sm flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
                <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-800 bg-gray-900">
                  <ImageIcon className="h-7 w-7" />
                </span>
                <span className="font-medium text-gray-400">{t('outputNoImageTitle')}</span>
                <span>{activeRequest?.info || t('outputNoImage')}</span>
              </div>
            ) : selectedResult ? (
              <button
                type="button"
                onClick={() => setPreviewImage(selectedResult)}
                className="flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-gray-900"
                aria-label={tGallery('expand')}
              >
                <img
                  src={selectedResult.image_url}
                  alt={selectedResult.prompt || tGallery('untitled')}
                  className="max-h-[500px] max-w-full object-contain xl:max-h-[640px]"
                />
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
                <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-800 bg-gray-900">
                  <ImageIcon className="h-7 w-7" />
                </span>
                <span>{t('outputEmpty')}</span>
              </div>
            )}
          </div>

          {results.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {results.slice(0, 10).map((item, index) => {
                const isSelected = selectedResult?.image_path === item.image_path;
                return (
                  <button
                    key={`${item.image_path}-${index}`}
                    type="button"
                    onClick={() => setSelectedImagePath(item.image_path)}
                    aria-label={t('selectOutput', { index: index + 1 })}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-gray-950 transition ${
                      isSelected ? 'border-[#0969da] ring-2 ring-[#0969da]/30 dark:border-blue-500 dark:ring-blue-500/30' : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <img src={item.image_url} alt={item.prompt || tGallery('untitled')} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ActionButton disabled={!selectedResult} onClick={() => selectedResult && setPreviewImage(selectedResult)} icon={<ExternalLink className="h-4 w-4" />} label={tGallery('expand')} />
            {selectedResult ? (
              <Link
                href={openHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-sm font-medium text-gray-300 transition hover:border-gray-700 hover:bg-gray-900"
              >
                <ImageIcon className="h-4 w-4" />
                {selectedResult.job_id ? tGallery('openJob') : t('openImage')}
              </Link>
            ) : (
              <ActionButton disabled icon={<ImageIcon className="h-4 w-4" />} label={t('openImage')} />
            )}
            <ActionButton disabled={!selectedResult} onClick={() => selectedResult && onReuse(selectedResult)} icon={<Repeat2 className="h-4 w-4" />} label={tGallery('reuse')} />
            <ActionButton disabled={!selectedResult || isSubmittingReplay} onClick={() => selectedResult && onReplay(selectedResult)} icon={<RotateCcw className="h-4 w-4" />} label={tGallery('rerun')} />
            <ActionButton
              disabled={!selectedResult}
              onClick={() => selectedResult && onToggleFavorite(selectedResult)}
              icon={<Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />}
              label={isFavorite ? tGallery('unfavorite') : tGallery('favorite')}
            />
          </div>

          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
            <div className="text-sm font-semibold text-gray-300">{t('outputMetadata')}</div>
            {selectedResult ? (
              <div className="mt-3 space-y-3">
                <div className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{selectedResult.prompt || tGallery('untitled')}</div>
                <div className="grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                  <InfoRow label={t('steps')} value={String(selectedResult.num_inference_steps)} />
                  <InfoRow label={t('seed')} value={String(selectedResult.seed)} />
                  <InfoRow label={t('gpuId')} value={selectedResult.gpu_ids || '-'} />
                  <InfoRow label={t('servedBy')} value={selectedResult.served_by === 'service' ? tGallery('servedByService') : tGallery('servedByEphemeral')} />
                  <InfoRow label={t('modelSource')} value={selectedResult.use_lora ? t('loraTag') : t('baseModelTag')} />
                  <InfoRow label={t('createdAt')} value={formatCreatedAt(selectedResult.created_at)} />
                </div>
                {selectedResult.checkpoint_path ? (
                  <div className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs leading-5 text-gray-500">
                    {compactPath(selectedResult.checkpoint_path)}
                  </div>
                ) : null}
                {selectedResult.job_id ? (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(selectedResult)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-xs font-medium text-[#cf222e] transition hover:bg-gray-900 dark:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    {tGallery('delete')}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-500">{t('outputEmpty')}</div>
            )}
          </div>

          {history.length > 0 ? (
            <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
              <div className="text-sm font-semibold text-gray-300">{t('recentRequests')}</div>
              <div className="mt-3 space-y-2">
                {history.slice(0, 3).map(item => (
                  <Link
                    key={item.id}
                    href={`/jobs/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm transition hover:border-gray-700"
                  >
                    <span className="min-w-0 truncate text-gray-300">{item.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">{item.info}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {previewImage ? (
        <button
          type="button"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6 backdrop-blur-md"
        >
          <img
            src={previewImage.image_url}
            alt={previewImage.prompt || tGallery('untitled')}
            className="max-h-[88vh] max-w-[94vw] rounded-lg border border-white/10 bg-black object-contain shadow-2xl"
          />
        </button>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tGallery('deleteTitle')}
        message={pendingDelete ? tGallery('deleteMessage', { name: pendingDelete.job_name || tGallery('untitled') }) : ''}
        confirmLabel={tGallery('delete')}
        cancelLabel={tGallery('cancel')}
        busyLabel={tGallery('deleting')}
        tone="danger"
        busy={deleting}
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await onDelete(pendingDelete);
            setPendingDelete(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}

function GenerationPendingState({
  title,
  status,
  name,
  info,
}: {
  title: string;
  status: string;
  name: string;
  info: string;
}) {
  return (
    <div className="flex max-w-md flex-col items-center justify-center gap-4 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#0969da]/20 bg-[#0969da]/10 text-[#0969da] dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
        <span className="absolute inset-0 rounded-full border border-[#0969da]/20 dark:border-blue-300/20" />
        <Loader2 className="h-9 w-9 animate-spin" />
      </div>
      <div>
        <div className="text-base font-semibold text-gray-300">{title}</div>
        <div className="mt-1 text-sm text-gray-500">{info}</div>
      </div>
      <div className="min-w-0 rounded-full border border-gray-800 bg-gray-900 px-3 py-1 text-xs text-gray-500">
        <span className="font-mono">{name}</span>
        <span className="px-2">·</span>
        <span>{status}</span>
      </div>
    </div>
  );
}

function ActionButton({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-sm font-medium text-gray-300 transition hover:border-gray-700 hover:bg-gray-900 disabled:cursor-not-allowed disabled:text-gray-500"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-gray-800 bg-gray-900 px-3 py-2">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 truncate text-right text-gray-300">{value}</span>
    </div>
  );
}

function formatCreatedAt(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function compactPath(value: string) {
  if (value.length <= 84) return value;
  return `${value.slice(0, 36)}...${value.slice(-42)}`;
}
