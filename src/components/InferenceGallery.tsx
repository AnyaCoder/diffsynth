'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Heart, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useTheme } from '@/components/ThemeProvider';
import { JobResult } from '@/types';

interface InferenceGalleryProps {
  items: JobResult[];
  emptyLabel: string;
  onOpen?: (item: JobResult) => void;
  hero?: boolean;
  favoriteImagePaths?: string[];
  onToggleFavorite?: (item: JobResult) => void;
  onReuse?: (item: JobResult) => void;
  onReplay?: (item: JobResult) => void;
  onDelete?: (item: JobResult) => void | Promise<void>;
}

interface CardVariant {
  frameClassName: string;
}

export default function InferenceGallery({
  items,
  emptyLabel,
  onOpen,
  hero = false,
  favoriteImagePaths = [],
  onToggleFavorite,
  onReuse,
  onReplay,
  onDelete,
}: InferenceGalleryProps) {
  const t = useTranslations('inferenceGallery');
  const { theme } = useTheme();
  const favoriteSet = useMemo(() => new Set(favoriteImagePaths), [favoriteImagePaths]);
  const [pendingDelete, setPendingDelete] = useState<JobResult | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isDark = theme === 'dark';
  const cards = useMemo(
    () =>
      items.map((item, index) => ({
        key: `${item.image_path}-${index}`,
        item,
        variant: getCardVariant(index, hero),
      })),
    [items, hero]
  );

  if (items.length === 0) {
    return (
      <div
        className={`rounded-[28px] border border-dashed px-6 py-20 text-center text-sm text-gray-500 ${
          isDark ? 'border-gray-800 bg-gray-950/70' : 'border-gray-300 bg-gray-100'
        }`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className={`${hero ? 'columns-1 md:columns-2 2xl:columns-3' : 'columns-1 xl:columns-2 2xl:columns-3'} gap-5 [column-fill:_balance]`}>
        {cards.map(({ item, key, variant }) => {
            const modeTone = getModeTone(item, isDark);
            const title = item.prompt || t('untitled');
            const isFavorite = favoriteSet.has(item.image_path);
            const cardHref = item.job_id ? `/jobs/${item.job_id}` : item.image_url;

            return (
            <article
              key={key}
              className={`group relative mb-5 break-inside-avoid overflow-hidden rounded-[32px] border transition duration-500 hover:-translate-y-1 ${
                isDark
                  ? 'border-white/6 bg-[#090b0d] shadow-[0_26px_80px_rgba(0,0,0,0.36)] hover:border-white/12'
                  : 'border-gray-300 bg-gray-100 shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:border-gray-400'
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 z-[1] opacity-0 transition duration-500 group-hover:opacity-100 ${modeTone.glowClassName}`} />
              <Link
                href={cardHref}
                onClick={event => {
                  if (item.job_id) {
                    return;
                  }
                  event.preventDefault();
                  onOpen?.(item);
                }}
                className={`relative block w-full overflow-hidden text-left ${variant.frameClassName}`}
              >
                <img
                  src={item.image_url}
                  alt={title}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
                />
                <div
                  className={`absolute inset-0 z-[2] ${
                    isDark
                      ? 'bg-[linear-gradient(180deg,rgba(3,6,9,0.04),rgba(3,6,9,0.02)_26%,rgba(3,6,9,0.04)_60%,rgba(3,6,9,0.16)_100%)]'
                      : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_28%,rgba(15,23,42,0.02)_60%,rgba(15,23,42,0.14)_100%)]'
                  }`}
                />
                <div className="absolute inset-x-0 top-0 z-[3] flex items-start justify-between gap-3 p-4">
                  <div className="flex max-w-[82%] flex-wrap gap-2">
                    {item.served_by === 'service' ? (
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.22em] backdrop-blur-sm ${modeTone.modeBadgeClassName}`}>
                        {t('servedByService')}
                      </span>
                    ) : onDelete && item.job_id ? (
                      <button
                        type="button"
                        onClick={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          setPendingDelete(item);
                        }}
                        aria-label={t('delete')}
                        className={`rounded-full border p-2 backdrop-blur-sm transition ${
                          isDark
                            ? 'border-red-400/28 bg-red-500/14 text-red-100 hover:border-red-300/40 hover:bg-red-500/20 hover:text-white'
                            : 'border-gray-400 bg-gray-100/88 text-red-500 hover:border-gray-500 hover:bg-gray-200 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.22em] backdrop-blur-sm ${modeTone.modeBadgeClassName}`}>
                        {t('servedByEphemeral')}
                      </span>
                    )}
                    {item.use_lora ? (
                      <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/12 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.22em] text-fuchsia-100 backdrop-blur-sm">
                        LoRA
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpen?.(item);
                      }}
                      aria-label={t('expand')}
                      className={`rounded-full border p-2 backdrop-blur-sm transition ${
                        isDark
                          ? 'border-white/10 bg-black/28 text-white/70 hover:border-white/18 hover:text-white'
                          : 'border-gray-400 bg-gray-100/88 text-gray-600 hover:border-gray-500 hover:bg-gray-200 hover:text-gray-950'
                      }`}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {onToggleFavorite ? (
                      <button
                        type="button"
                        onClick={event => {
                          event.preventDefault();
                        event.stopPropagation();
                        onToggleFavorite(item);
                      }}
                      aria-label={isFavorite ? t('unfavorite') : t('favorite')}
                        className={`rounded-full border p-2 backdrop-blur-sm transition ${
                          isFavorite
                            ? isDark
                              ? 'border-rose-300/28 bg-rose-300/16 text-rose-100'
                              : 'border-gray-400 bg-gray-100/88 text-rose-500'
                            : isDark
                              ? 'border-white/10 bg-black/28 text-white/70 hover:border-white/18 hover:text-white'
                              : 'border-gray-400 bg-gray-100/88 text-gray-600 hover:border-gray-500 hover:bg-gray-200 hover:text-gray-950'
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`absolute inset-x-0 bottom-0 z-[3] h-14 ${
                    isDark
                      ? 'bg-[linear-gradient(180deg,transparent,rgba(3,6,9,0.38))]'
                      : 'bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.18))]'
                  }`}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] flex items-end justify-between gap-3 px-4 pb-4">
                  <div className="min-w-0">
                    <div
                      className={`truncate text-sm font-semibold [text-shadow:0_8px_24px_rgba(0,0,0,0.68)] ${
                        isDark ? 'text-white/92' : 'text-white'
                      }`}
                    >
                      {title}
                    </div>
                    <div
                      className={`mt-1 text-[11px] font-medium [text-shadow:0_8px_24px_rgba(0,0,0,0.68)] ${
                        isDark ? 'text-white/72' : 'text-white/88'
                      }`}
                    >
                      {formatCreatedAt(item.created_at)}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] [text-shadow:0_8px_24px_rgba(0,0,0,0.68)] ${
                      isDark ? 'text-white/54' : 'text-white/82'
                    }`}
                  >
                    {item.use_lora ? 'LoRA' : t('baseModel')}
                  </div>
                </div>
              </Link>
            </article>
            );
          })}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('deleteTitle')}
        message={pendingDelete ? t('deleteMessage', { name: pendingDelete.job_name || t('untitled') }) : ''}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        busyLabel={t('deleting')}
        tone="danger"
        busy={deleting}
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete || !onDelete) return;
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

function getCardVariant(index: number, hero: boolean): CardVariant {
  const variants = hero
    ? [
        { frameClassName: 'aspect-[4/5]' },
        { frameClassName: 'aspect-[5/7]' },
        { frameClassName: 'aspect-[3/4]' },
        { frameClassName: 'aspect-[1/1.28]' },
      ]
    : [
        { frameClassName: 'aspect-[4/5]' },
        { frameClassName: 'aspect-[5/7]' },
        { frameClassName: 'aspect-[3/4]' },
        { frameClassName: 'aspect-[1/1.18]' },
        { frameClassName: 'aspect-[1/1.42]' },
      ];
  return variants[index % variants.length];
}

function getModeTone(item: JobResult, isDark: boolean) {
  if (item.use_lora) {
    return {
      glowClassName: isDark
        ? 'bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.22),transparent_52%)]'
        : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_52%)]',
      modeBadgeClassName: isDark
        ? 'border-fuchsia-400/28 bg-fuchsia-400/12 text-fuchsia-100'
        : 'border-gray-400 bg-gray-900/82 text-white',
    };
  }
  if (item.served_by === 'service') {
    return {
      glowClassName: isDark
        ? 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_50%)]'
        : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_50%)]',
      modeBadgeClassName: isDark
        ? 'border-cyan-300/24 bg-cyan-300/12 text-cyan-100'
        : 'border-gray-400 bg-gray-900/82 text-white',
    };
  }
  return {
    glowClassName: isDark
      ? 'bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_52%)]'
      : 'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_52%)]',
    modeBadgeClassName: isDark
      ? 'border-amber-300/24 bg-amber-300/12 text-amber-100'
      : 'border-gray-400 bg-gray-900/82 text-white',
  };
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
