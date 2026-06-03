'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { FolderOpen, ImageUp, LoaderCircle } from 'lucide-react';
import { MainContent, TopBar } from '@/components/layout';
import { useToast } from '@/components/ToastProvider';
import useDatasetItems from '@/hooks/useDatasetItems';
import { apiClient } from '@/utils/api';

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetName: string }> }) {
  const t = useTranslations('datasetDetail');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const [datasetName, setDatasetName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    params.then(value => setDatasetName(decodeURIComponent(value.datasetName)));
  }, [params]);

  const { items, setItems, refreshItems } = useDatasetItems(datasetName);

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

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{datasetName || tCommon('datasets')}</h1>
      </TopBar>
      <MainContent className="space-y-6">
        <div className="rounded-[28px] border border-gray-800 bg-[linear-gradient(180deg,rgba(22,24,28,0.96),rgba(12,14,18,0.98))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <h2 className="text-lg font-semibold">{t('uploadImages')}</h2>
          <div
            {...getRootProps()}
            className={`mt-4 rounded-[24px] border-2 border-dashed px-6 py-8 transition ${
              isDragActive
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-gray-700 bg-[linear-gradient(180deg,rgba(12,14,18,0.82),rgba(10,12,15,0.9))] hover:border-gray-600'
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-700 bg-gray-900/80 text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <ImageUp className="h-8 w-8" />
              </div>
              <div className="mt-5 text-base font-medium text-gray-100">{t('uploadFolderHint')}</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">{t('uploadFolderSubhint')}</div>
              <div className="mt-6 flex flex-col items-center gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-medium text-gray-100 transition hover:border-gray-600 hover:bg-gray-800"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('chooseFolder')}
                </button>
                <button
                  type="button"
                  onClick={open}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-sm font-medium text-gray-300 transition hover:border-gray-600 hover:text-white"
                >
                  <ImageUp className="h-4 w-4" />
                  {t('chooseFiles')}
                </button>
              </div>
              <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/90 px-4 py-3 text-sm text-gray-400">
                {selectedFiles.length > 0 ? uploadSummary : t('noFolderSelected')}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <button
              onClick={upload}
              disabled={!selectedFiles.length || isUploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900/40 disabled:text-blue-200/60"
            >
              {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {t('upload')}
            </button>
            <button onClick={saveCaptions} className="rounded-xl border border-gray-700 px-4 py-3 font-medium hover:border-gray-600">
              {t('saveCaptions')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item, index) => (
            <div key={item.relative_path} className="rounded-[24px] border border-gray-800 bg-gray-900 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <img src={item.thumb_url} alt={item.file_name} className="h-72 w-full rounded-[18px] object-cover" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-100">{item.file_name}</div>
                  <div className="mt-1 truncate text-xs text-gray-500">{item.relative_path}</div>
                </div>
                <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  item.has_caption ? 'bg-emerald-950/70 text-emerald-300' : 'bg-amber-950/70 text-amber-300'
                }`}>
                  {item.has_caption ? t('captioned') : t('pending')}
                </div>
              </div>
              <textarea
                value={item.caption}
                onChange={event =>
                  setItems(prev =>
                    prev.map((current, currentIndex) =>
                      currentIndex === index
                        ? { ...current, caption: event.target.value, has_caption: event.target.value.trim().length > 0 }
                        : current
                    )
                  )
                }
                className="mt-3 min-h-28 w-full rounded-[18px] border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
                placeholder={t('captionPlaceholder')}
              />
            </div>
          ))}
          {items.length === 0 ? <div className="text-sm text-gray-500">{t('noImages')}</div> : null}
        </div>
      </MainContent>
    </>
  );
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
