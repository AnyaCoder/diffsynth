'use client';

import { useLocale } from 'next-intl';
import { AppLocale } from './config';

export function useCurrentLocale() {
  return useLocale() as AppLocale;
}
