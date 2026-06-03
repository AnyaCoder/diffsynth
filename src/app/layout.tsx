import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import ToastProvider from '@/components/ToastProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import AuthWrapper from '@/components/AuthWrapper';
import { Suspense } from 'react';
import { isApiAuthEnabled } from '@/auth';
import I18nProvider from '@/i18n/I18nProvider';
import { getCurrentLocale } from '@/i18n/server';
import { loadMessages } from '@/i18n/loadMessages';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DiffSynth Qwen Control',
  description: 'Qwen-Image-2512 training and inference web console',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authRequired = isApiAuthEnabled();
  const locale = await getCurrentLocale();
  const messages = loadMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme') || 'dark';
                if (theme === 'dark') document.documentElement.classList.add('dark');
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthWrapper authRequired={authRequired}>
              <ToastProvider>
                <div className="flex h-screen bg-gray-950">
                  <Sidebar />
                  <main className="relative flex-1 overflow-auto bg-gray-950 text-gray-100">
                    <Suspense>{children}</Suspense>
                  </main>
                </div>
              </ToastProvider>
            </AuthWrapper>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
