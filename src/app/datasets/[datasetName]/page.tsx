'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, FolderOpen, ImageUp, LoaderCircle, Maximize2, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MainContent, TopBar } from '@/components/layout';
import { useToast } from '@/components/ToastProvider';
import useDatasetItems from '@/hooks/useDatasetItems';
import type { DatasetItem } from '@/types';
import { apiClient } from '@/utils/api';

const rowSizeOptions = [2, 3, 4];
const pageSizeOptions = [8, 12, 16, 24, 32, 48];

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetName: string }> }) {
  const t = useTranslations('datasetDetail');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const [datasetName, setDatasetName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [maxItemsPerRow, setMaxItemsPerRow] = useState(3);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<DatasetItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<DatasetItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    params.then(value => setDatasetName(decodeURIComponent(value.datasetName)));
  }, [params]);

  const { items, setItems, refreshItems } = useDatasetItems(datasetName);
  const pageCount = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [currentPage, items, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, pageCount));
  }, [pageCount]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const files = acceptedFiles.filter(isSupportedDatasetFile);
    setSelectedFiles(files);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: true,
    noKeyboard: true,
    noClick: true,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'text/plain': ['.txt'],
    },
  });

  const uploadSummary = useMemo(() => summarizeUploadFiles(selectedFiles), [selectedFiles]);

  const upload = async () => {
    if (!selectedFiles.length || isUploading) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('datasetName', datasetName);
      selectedFiles.forEach(file => {
        formData.append('files', file);
        formData.append('relativePaths', getRelativePath(file));
      });
      await apiClient.post('/api/datasets/upload', formData);
      pushToast({ title: t('upload'), description: uploadSummary, tone: 'success' });
      setSelectedFiles([]);
      refreshItems();
    } finally {
      setIsUploading(false);
    }
  };

  const saveCaptions = async () => {
    await apiClient.post('/api/datasets/captions/save', {
      datasetName,
      items: items.map(item => ({
        file_name: item.file_name,
        relative_path: item.relative_path,
        caption: item.caption,
      })),
    });
    pushToast({ title: t('saveCaptions'), description: datasetName, tone: 'success' });
    refreshItems();
  };

  const deleteItem = async () => {
    if (!pendingDeleteItem || isDeletingItem) return;
    setIsDeletingItem(true);
    try {
      await apiClient.post('/api/datasets/items/delete', {
        datasetName,
        relativePath: pendingDeleteItem.relative_path,
      });
      setItems(prev => prev.filter(item => item.relative_path !== pendingDeleteItem.relative_path));
      pushToast({ title: t('deleteImage'), description: pendingDeleteItem.file_name, tone: 'warning' });
      setPendingDeleteItem(null);
      await refreshItems();
    } finally {
      setIsDeletingItem(false);
    }
  };

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewItem]);

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{datasetName || tCommon('datasets')}</h1>
      </TopBar>
      <MainContent className="space-y-6 pb-36">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <h2 className="text-lg font-semibold text-gray-300">{t('uploadImages')}</h2>
          <div
            {...getRootProps()}
            className={`mt-4 rounded-lg border-2 border-dashed px-6 py-8 transition ${
              isDragActive
                ? 'border-gray-600 bg-gray-900 dark:border-blue-400 dark:bg-blue-500/10'
                : 'border-gray-800 bg-gray-950 hover:border-gray-700 hover:bg-gray-900'
            }`}
          >
            <input {...getInputProps()} />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.txt"
              onChange={event => setSelectedFiles(Array.from(event.target.files || []).filter(isSupportedDatasetFile))}
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            />
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-500">
                <ImageUp className="h-8 w-8" />
              </div>
              <div className="mt-5 text-base font-medium text-gray-300">{t('uploadFolderHint')}</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{t('uploadFolderSubhint')}</div>
              <div className="mt-6 flex flex-col items-center gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm font-medium text-gray-300 transition hover:border-gray-700 hover:bg-gray-900"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('chooseFolder')}
                </button>
                <button
                  type="button"
                  onClick={open}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm font-medium text-gray-500 transition hover:border-gray-700 hover:bg-gray-900 hover:text-gray-300"
                >
                  <ImageUp className="h-4 w-4" />
                  {t('chooseFiles')}
                </button>
              </div>
              <div className="mt-5 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-500">
                {selectedFiles.length > 0 ? uploadSummary : t('noFolderSelected')}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <button
              onClick={upload}
              disabled={!selectedFiles.length || isUploading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f883d] px-4 py-3 font-medium text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-900/40 dark:disabled:text-blue-200/60"
            >
              {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {t('upload')}
            </button>
            <button onClick={saveCaptions} className="rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 font-medium text-gray-500 transition hover:border-gray-700 hover:bg-gray-900 hover:text-gray-300">
              {t('saveCaptions')}
            </button>
          </div>
        </div>

        <div
          data-dataset-role="items-grid"
          className={`grid gap-4 ${getDatasetGridClass(maxItemsPerRow)}`}
        >
          {pagedItems.map(item => (
            <div
              key={item.relative_path}
              data-dataset-role="image-card"
              className="group rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-gray-700 hover:shadow-[0_22px_46px_rgba(15,23,42,0.18)] focus-within:-translate-y-1 focus-within:border-gray-700 focus-within:shadow-[0_22px_46px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_24px_54px_rgba(0,0,0,0.32)] dark:focus-within:shadow-[0_24px_54px_rgba(0,0,0,0.32)]"
            >
              <div className="relative overflow-hidden rounded-lg">
                <img
                  src={item.thumb_url}
                  alt={item.file_name}
                  className="h-72 w-full rounded-lg object-cover transition duration-300 group-hover:scale-[1.025] group-focus-within:scale-[1.025]"
                />
                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    aria-label={t('previewImage')}
                    onClick={() => setPreviewItem(item)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-950/86 text-gray-300 shadow-[0_10px_26px_rgba(15,23,42,0.22)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-gray-700 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-600 dark:bg-gray-950/82"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('deleteImage')}
                    onClick={() => setPendingDeleteItem(item)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-950/86 text-[#cf222e] shadow-[0_10px_26px_rgba(15,23,42,0.22)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-red-900/60 hover:bg-red-950/20 focus:outline-none focus:ring-2 focus:ring-red-900/40 dark:bg-gray-950/82 dark:text-red-300 dark:hover:bg-red-950/35"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-300">{item.file_name}</div>
                  <div className="mt-1 truncate text-xs text-gray-500">{item.relative_path}</div>
                </div>
                <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  item.has_caption
                    ? 'border border-gray-800 bg-gray-950 text-gray-500 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'border border-gray-800 bg-gray-950 text-gray-500 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-300'
                }`}>
                  {item.has_caption ? t('captioned') : t('pending')}
                </div>
              </div>
              <textarea
                value={item.caption}
                onChange={event =>
                  setItems(prev =>
                    prev.map(current =>
                      current.relative_path === item.relative_path
                        ? { ...current, caption: event.target.value, has_caption: event.target.value.trim().length > 0 }
                        : current
                    )
                  )
                }
                className="mt-3 min-h-28 w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-gray-300 outline-none focus:border-gray-600 dark:focus:border-blue-500"
                placeholder={t('captionPlaceholder')}
              />
            </div>
          ))}
          {items.length === 0 ? <div className="text-sm text-gray-500">{t('noImages')}</div> : null}
        </div>

        {items.length > 0 ? (
          <DatasetPaginationDock
            currentPage={currentPage}
            pageCount={pageCount}
            maxItemsPerRow={maxItemsPerRow}
            itemsPerPage={itemsPerPage}
            rowSizeOptions={rowSizeOptions}
            pageSizeOptions={pageSizeOptions}
            onChangePage={setCurrentPage}
            onChangeMaxItemsPerRow={value => {
              setMaxItemsPerRow(value);
              setCurrentPage(1);
            }}
            onChangeItemsPerPage={value => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
            t={t}
          />
        ) : null}
      </MainContent>
      {previewItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.file_name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6 backdrop-blur-md"
          onClick={() => setPreviewItem(null)}
        >
          <img
            src={previewItem.thumb_url}
            alt={previewItem.file_name}
            className="max-h-[88vh] max-w-[94vw] rounded-lg border border-white/10 bg-black object-contain shadow-2xl"
            onClick={event => event.stopPropagation()}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDeleteItem)}
        title={t('deleteImageTitle')}
        message={pendingDeleteItem ? t('deleteImageMessage', { name: pendingDeleteItem.file_name }) : ''}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        busyLabel={t('deletingImage')}
        tone="danger"
        busy={isDeletingItem}
        onConfirm={deleteItem}
        onCancel={() => setPendingDeleteItem(null)}
      />
    </>
  );
}

function DatasetPaginationDock({
  currentPage,
  pageCount,
  maxItemsPerRow,
  itemsPerPage,
  rowSizeOptions,
  pageSizeOptions,
  onChangePage,
  onChangeMaxItemsPerRow,
  onChangeItemsPerPage,
  t,
}: {
  currentPage: number;
  pageCount: number;
  maxItemsPerRow: number;
  itemsPerPage: number;
  rowSizeOptions: number[];
  pageSizeOptions: number[];
  onChangePage: (page: number) => void;
  onChangeMaxItemsPerRow: (value: number) => void;
  onChangeItemsPerPage: (value: number) => void;
  t: ReturnType<typeof useTranslations<'datasetDetail'>>;
}) {
  const pageItems = getPaginationItems(currentPage, pageCount);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < pageCount;

  return (
    <nav
      data-dataset-role="pagination-dock"
      aria-label={t('pagination')}
      className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/88 p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl md:bottom-6 md:right-6 md:max-w-[calc(100vw-22rem)] dark:bg-gray-950/78 dark:shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
    >
      <div data-dataset-role="pagination-pages" className="flex min-w-0 items-center gap-2 overflow-x-auto">
        <PageButton
          ariaLabel={t('previousPage')}
          disabled={!canGoPrev}
          onClick={() => onChangePage(currentPage - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </PageButton>
        {pageItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-950/72 text-lg font-semibold text-gray-500 backdrop-blur-md dark:bg-gray-900/78"
            >
              ...
            </span>
          ) : (
            <PageButton
              key={item}
              active={item === currentPage}
              ariaLabel={t('pageNumber', { page: item })}
              onClick={() => onChangePage(item)}
            >
              {item}
            </PageButton>
          )
        )}
        <PageButton
          ariaLabel={t('nextPage')}
          disabled={!canGoNext}
          onClick={() => onChangePage(currentPage + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </PageButton>
      </div>
      <div className="mx-1 h-10 w-px shrink-0 bg-gray-800" />
      <div data-dataset-role="pagination-options" className="flex shrink-0 items-center gap-2">
        <FloatingSelect
          label={t('maxItemsPerRow')}
          value={maxItemsPerRow}
          options={rowSizeOptions}
          onChange={onChangeMaxItemsPerRow}
        />
        <FloatingSelect
          label={t('itemsPerPage')}
          value={itemsPerPage}
          options={pageSizeOptions}
          onChange={onChangeItemsPerPage}
        />
      </div>
    </nav>
  );
}

function FloatingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/72 px-4 text-sm text-gray-500 shadow-sm backdrop-blur-md dark:bg-gray-900/76">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="h-10 rounded-lg border border-gray-800 bg-gray-950/92 px-3 text-sm font-medium text-gray-300 outline-none focus:border-gray-600 dark:focus:border-blue-500"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PageButton({
  active = false,
  disabled = false,
  ariaLabel,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-semibold transition ${
        active
          ? 'bg-[#0969da] text-white shadow-sm dark:bg-blue-600'
          : 'bg-gray-950/72 text-gray-300 backdrop-blur-md hover:bg-gray-900/86 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-gray-950/72 dark:bg-gray-900/78 dark:hover:bg-gray-800/86 dark:disabled:hover:bg-gray-900/78'
      }`}
    >
      {children}
    </button>
  );
}

function getDatasetGridClass(maxItemsPerRow: number) {
  if (maxItemsPerRow === 2) {
    return 'grid-cols-2';
  }
  if (maxItemsPerRow === 3) {
    return 'grid-cols-2 xl:grid-cols-3';
  }
  return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
}

function getPaginationItems(currentPage: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 10) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount]);
  if (currentPage <= 5) {
    for (let page = 2; page <= 7; page += 1) pages.add(page);
  } else if (currentPage >= pageCount - 4) {
    for (let page = pageCount - 6; page < pageCount; page += 1) pages.add(page);
  } else {
    for (let page = currentPage - 2; page <= currentPage + 2; page += 1) pages.add(page);
  }

  const sortedPages = Array.from(pages).filter(page => page >= 1 && page <= pageCount).sort((left, right) => left - right);
  const items: Array<number | 'ellipsis'> = [];
  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) {
      items.push('ellipsis');
    }
    items.push(page);
  });
  return items;
}

function getRelativePath(file: File) {
  return (((file as File & { webkitRelativePath?: string }).webkitRelativePath) || file.name)
    .split('\\')
    .join('/');
}

function isSupportedDatasetFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.txt')
  );
}

function summarizeUploadFiles(files: File[]) {
  const imageCount = files.filter(file => isImageFile(file.name)).length;
  const textCount = files.filter(file => file.name.toLowerCase().endsWith('.txt')).length;
  return `${files.length} files selected · ${imageCount} images · ${textCount} captions`;
}

function isImageFile(fileName: string) {
  const name = fileName.toLowerCase();
  return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
}
