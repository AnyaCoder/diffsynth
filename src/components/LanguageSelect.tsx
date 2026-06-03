'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AppLocale, languageCookieName } from '@/i18n/config';
import { useCurrentLocale } from '@/i18n/useCurrentLocale';

export default function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('common');
  const router = useRouter();
  const locale = useCurrentLocale();

  const setLocale = (nextLocale: AppLocale) => {
    document.cookie = `${languageCookieName}=${nextLocale}; path=/; expires=Thu, 01 Jan 2035 00:00:00 GMT; SameSite=Lax`;
    router.refresh();
  };

  return (
    <label className={compact ? 'flex items-center gap-2 text-sm text-gray-300' : 'block'}>
      {!compact ? <div className="mb-2 text-sm font-medium text-gray-300">{t('language')}</div> : null}
      <select
        value={locale}
        onChange={event => setLocale(event.target.value as AppLocale)}
        className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        <option value="en">{t('english')}</option>
        <option value="zh">{t('chinese')}</option>
      </select>
    </label>
  );
}
