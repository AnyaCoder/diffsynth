'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrainCircuit, FolderKanban, Gauge, Images, PlaySquare, RadioTower, Settings, X } from 'lucide-react';
import { createGlobalState } from 'react-global-hooks';
import { useTranslations } from 'next-intl';
import ThemeToggle from './ThemeToggle';

export const mobileSidebarState = createGlobalState<boolean>(false);

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = mobileSidebarState.use();
  const pathname = usePathname();
  const tCommon = useTranslations('common');
  const tSidebar = useTranslations('sidebar');

  const navigation = [
    { name: tCommon('dashboard'), href: '/dashboard', icon: Gauge },
    { name: tCommon('datasets'), href: '/datasets', icon: FolderKanban },
    { name: tCommon('newTrain'), href: '/jobs/new', icon: BrainCircuit },
    { name: tCommon('jobList'), href: '/jobs', icon: Images },
    { name: tCommon('singleInference'), href: '/inference', icon: PlaySquare },
    { name: tCommon('modelServices'), href: '/services', icon: RadioTower },
  ];

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const sidebarContent = (
    <>
      <div className="border-b border-gray-800 px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{tSidebar('diffSynth')}</p>
            <h1 className="mt-2 text-lg font-semibold text-gray-100">{tSidebar('qwenControl')}</h1>
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-100 md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-2">
          {navigation.map(item => {
            const active = isNavigationItemActive(pathname, item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center rounded-lg px-4 py-3 transition ${
                    active
                      ? 'bg-[#0969da] text-white dark:bg-blue-600'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{tCommon('theme')}</div>
            <div className="mt-1 text-sm text-gray-300">{tCommon('darkConsole')}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              aria-label={tSidebar('openSettings')}
              className={`rounded-lg border p-2 transition ${
                pathname === '/settings'
                  ? 'border-[#0969da] bg-[#ddf4ff] text-[#0969da] dark:border-blue-500 dark:bg-blue-600/10 dark:text-blue-300'
                  : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-gray-100'
              }`}
            >
              <Settings className="h-4 w-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-72 flex-col border-r border-gray-800 bg-gray-900 md:flex">{sidebarContent}</aside>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition ${isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'} md:hidden`}
        onClick={() => setIsMobileOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-800 bg-gray-900 transition-transform md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function isNavigationItemActive(pathname: string, href: string) {
  if (href === '/jobs') {
    return pathname === '/jobs' || (pathname.startsWith('/jobs/') && pathname !== '/jobs/new');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
