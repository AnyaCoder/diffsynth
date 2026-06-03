'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import useDatasetList from '@/hooks/useDatasetList';
import { apiClient } from '@/utils/api';

export default function DatasetsPage() {
  const t = useTranslations('datasetsPage');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const { datasets, refreshDatasets } = useDatasetList();
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const createDataset = async () => {
    if (!name.trim()) return;
    await apiClient.post('/api/datasets/create', { name });
    pushToast({ title: t('createDataset'), description: name, tone: 'success' });
    setName('');
    refreshDatasets();
  };

  const deleteDataset = async (datasetName: string) => {
    setIsDeleting(true);
    await apiClient.post('/api/datasets/delete', { name: datasetName });
    pushToast({ title: tCommon('delete'), description: datasetName, tone: 'warning' });
    setPendingDelete(null);
    setIsDeleting(false);
    refreshDatasets();
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{tCommon('datasets')}</h1>
      </TopBar>
      <MainContent className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">{t('createDataset')}</h2>
          <div className="mt-4 flex gap-3">
            <input value={name} onChange={e => setName(e.target.value)} className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" placeholder={t('datasetNamePlaceholder')} />
            <button onClick={createDataset} className="rounded-lg bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">{tCommon('create')}</button>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">{t('datasetList')}</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {datasets.map(dataset => (
              <div key={dataset} className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                <Link href={`/datasets/${encodeURIComponent(dataset)}`} className="text-base font-medium hover:text-blue-400">{dataset}</Link>
                <div className="mt-4 flex gap-2">
                  <Link href={`/datasets/${encodeURIComponent(dataset)}`} className="rounded-md border border-gray-700 px-3 py-2 text-sm hover:border-gray-600">{tCommon('open')}</Link>
                  <button onClick={() => setPendingDelete(dataset)} className="rounded-md border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/40">{tCommon('delete')}</button>
                </div>
              </div>
            ))}
            {datasets.length === 0 ? <div className="text-sm text-gray-500">{t('noDatasets')}</div> : null}
          </div>
        </div>
      </MainContent>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tCommon('delete')}
        message={pendingDelete ? t('deleteDatasetMessage', { name: pendingDelete }) : ''}
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
          await deleteDataset(pendingDelete);
        }}
      />
    </>
  );
}
