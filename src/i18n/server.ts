import { cookies } from 'next/headers';
import { AppLocale, defaultLocale, isAppLocale, languageCookieName } from './config';

export async function getCurrentLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(languageCookieName)?.value;
  return isAppLocale(value) ? value : defaultLocale;
}
