'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import InferenceGallery from '@/components/InferenceGallery';
import { useTheme } from '@/components/ThemeProvider';
import { JobResult } from '@/types';

type GalleryFilter = 'all' | 'service' | 'lora' | 'base';

export interface InferenceHistoryItem {
  id: string;
  name: string;
  info: string;
}

interface InferenceResultFeedProps {
  results: JobResult[];
  history: InferenceHistoryItem[];
  favoriteImagePaths: string[];
  onRefresh: () => void;
  onToggleFavorite: (item: JobResult) => void;
  onReuse: (item: JobResult) => void;
  onReplay: (item: JobResult) => void;
  onDelete: (item: JobResult) => void | Promise<void>;
}

export default function InferenceResultFeed({
  results,
  history,
  favoriteImagePaths,
  onRefresh,
  onToggleFavorite,
  onReuse,
  onReplay,
  onDelete,
}: InferenceResultFeedProps) {
  const t = useTranslations('inferencePage');
  const tGallery = useTranslations('inferenceGallery');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [previewImage, setPreviewImage] = useState<JobResult | null>(null);

  const filteredResults = useMemo(() => {
    switch (filter) {
      case 'service':
        return results.filter(item => item.served_by === 'service');
      case 'lora':
        return results.filter(item => item.use_lora);
      case 'base':
        return results.filter(item => !item.use_lora);
      default:
        return results;
    }
  }, [filter, results]);

  const counts = useMemo(
    () => ({
      all: results.length,
      service: results.filter(item => item.served_by === 'service').length,
      lora: results.filter(item => item.use_lora).length,
      base: results.filter(item => !item.use_lora).length,
    }),
    [results]
  );

  const filterPills = useMemo(
    () => [
      { key: 'all' as const, label: tGallery('filterAll'), count: counts.all },
      { key: 'service' as const, label: tGallery('filterService'), count: counts.service },
      { key: 'lora' as const, label: tGallery('filterLora'), count: counts.lora },
      { key: 'base' as const, label: tGallery('filterBase'), count: counts.base },
    ],
    [counts, tGallery]
  );

  return (
    <>
      <div
        data-panel-role="infer-right"
        className={`overflow-hidden rounded-[30px] border shadow-[0_28px_80px_rgba(0,0,0,0.26)] xl:flex xl:h-full xl:min-h-0 xl:flex-col ${
          isDark
            ? 'border-gray-800 bg-[linear-gradient(180deg,rgba(14,17,21,0.98),rgba(9,11,14,0.98))]'
            : 'border-gray-300 bg-[linear-gradient(180deg,rgba(241,243,245,0.98),rgba(234,236,239,0.98))] shadow-[0_18px_40px_rgba(15,23,42,0.05)]'
        }`}
      >
        <div
          className={`shrink-0 border-b px-5 py-5 ${
            isDark
              ? 'border-gray-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.05),transparent_30%)]'
              : 'border-gray-300 bg-[linear-gradient(180deg,rgba(236,238,241,0.98),rgba(243,244,246,0.98))]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-gray-500">{tGallery('eyebrow')}</div>
              <h2 className={`mt-2 text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-950'}`}>{t('galleryTitle')}</h2>
              <p className={`mt-2 max-w-xl text-sm leading-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('galleryHint')}</p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isDark
                  ? 'border-gray-800 bg-gray-950/70 text-gray-200 hover:border-cyan-700/50 hover:text-white'
                  : 'border-gray-400 bg-gray-100 text-gray-700 hover:border-gray-500 hover:bg-gray-200 hover:text-gray-950'
              }`}
            >
              {t('refreshGallery')}
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {filterPills.map(pill => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setFilter(pill.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                  filter === pill.key
                    ? isDark
                      ? 'border border-cyan-700/50 bg-cyan-950/40 text-cyan-50'
                      : 'border border-gray-500 bg-gray-800 text-white'
                    : isDark
                      ? 'border border-gray-800 bg-gray-950/50 text-gray-400 hover:border-gray-700 hover:text-gray-100'
                      : 'border border-gray-400 bg-gray-100 text-gray-600 hover:border-gray-500 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    filter === pill.key
                      ? isDark
                        ? 'bg-cyan-400/14 text-cyan-100'
                        : 'bg-white/18 text-white'
                      : isDark
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <InferenceGallery
            items={filteredResults}
            emptyLabel={t('noGalleryResults')}
            onOpen={setPreviewImage}
            favoriteImagePaths={favoriteImagePaths}
            onToggleFavorite={onToggleFavorite}
            onReuse={onReuse}
            onReplay={onReplay}
            onDelete={onDelete}
          />
        </div>

        <div className={`shrink-0 border-t px-5 py-4 ${isDark ? 'border-gray-800 bg-gray-950/40' : 'border-gray-200 bg-white/70'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-500">{t('recentRequests')}</div>
              <div className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tGallery('historyHint')}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {history.map(item => (
              <a
                key={item.id}
                href={`/jobs/${item.id}`}
                className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${
                  isDark
                    ? 'border-gray-800 bg-gray-950/60 hover:border-cyan-700/50 hover:bg-gray-950/80'
                    : 'border-gray-300 bg-gray-100 hover:border-gray-400 hover:bg-gray-200'
                }`}
              >
                <div className="min-w-0">
                  <div className={`truncate text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{item.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">{item.info}</div>
                </div>
                <div className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium ${isDark ? 'border-gray-800 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
                  {tGallery('historyOpen')}
                </div>
              </a>
            ))}
            {history.length === 0 ? (
              <div className={`rounded-2xl border border-dashed px-4 py-5 text-sm text-gray-500 ${isDark ? 'border-gray-800' : 'border-gray-300 bg-gray-100'}`}>
                {t('noLocalRequests')}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {previewImage ? (
        <button
          type="button"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6 backdrop-blur-md"
        >
          <img
            src={previewImage.image_url}
            alt={previewImage.prompt || 'preview'}
            className="max-h-[88vh] max-w-[94vw] rounded-[28px] border border-white/10 bg-black object-contain shadow-2xl"
          />
        </button>
      ) : null}
    </>
  );
}
