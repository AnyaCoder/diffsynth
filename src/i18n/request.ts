import { getRequestConfig } from 'next-intl/server';
import { getCurrentLocale } from './server';
import { loadMessages } from './loadMessages';

export default getRequestConfig(async () => {
  const locale = await getCurrentLocale();
  return {
    locale,
    messages: loadMessages(locale),
  };
});
