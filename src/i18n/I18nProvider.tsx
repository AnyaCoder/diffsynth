'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useMemo } from 'react';
import { AppLocale } from './config';

export default function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  messages: Record<string, unknown>;
}) {
  const now = useMemo(() => new Date(), []);
  return (
    <NextIntlClientProvider locale={locale} messages={messages} now={now} timeZone="Asia/Shanghai">
      {children}
    </NextIntlClientProvider>
  );
}
