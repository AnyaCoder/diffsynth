'use client';

import LanguageSelect from '@/components/LanguageSelect';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import useSettings from '@/hooks/useSettings';
import { apiClient } from '@/utils/api';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const { settings, setSettings, isSettingsLoaded } = useSettings();
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      await apiClient.post('/api/settings', settings);
      setStatus('success');
      pushToast({ title: t('saved'), tone: 'success' });
    } catch (error) {
      console.error('Failed to save settings', error);
      setStatus('error');
      pushToast({ title: t('failed'), tone: 'error' });
    }
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
      </TopBar>
      <MainContent>
        <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold">{t('runtimePaths')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('runtimePathsHelp')}</p>
            <div className="mt-5 grid grid-cols-1 gap-4">
              {[
                ['DATASETS_ROOT', t('datasetsRoot')],
                ['TRAINING_ROOT', t('trainingRoot')],
                ['INFERENCE_ROOT', t('inferenceRoot')],
                ['CONDA_ENV_NAME', t('condaEnvName')],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
                  <input
                    disabled={!isSettingsLoaded}
                    name={key}
                    value={(settings as any)[key] || ''}
                    onChange={onChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold">{t('languageSection')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('languageHelp')}</p>
            <div className="mt-5">
              <LanguageSelect />
            </div>
          </div>
          <button className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500" type="submit">
            {status === 'saving' ? tCommon('saving') : `${tCommon('save')} ${t('title')}`}
          </button>
          {status === 'success' ? <div className="text-sm text-green-400">{t('saved')}</div> : null}
          {status === 'error' ? <div className="text-sm text-red-400">{t('failed')}</div> : null}
        </form>
      </MainContent>
    </>
  );
}
