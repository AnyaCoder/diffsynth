'use client';
import classNames from 'classnames';
import { useTranslations } from 'next-intl';
import ThemeLogo from './ThemeLogo';
import { mobileSidebarState } from './Sidebar';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const MobileMenuButton: React.FC = () => {
  const tCommon = useTranslations('common');
  const [, setIsMobileOpen] = mobileSidebarState.use();
  return (
    <button
      onClick={() => setIsMobileOpen(true)}
      className="ml-2 mr-1 flex items-center rounded-md px-1 py-1 hover:bg-gray-800 md:hidden"
      aria-label={tCommon('openMenu')}
    >
      <ThemeLogo />
    </button>
  );
};

export const TopBar: React.FC<Props> = ({ children, className }) => {
  return (
    <div
      className={classNames(
        'absolute left-0 top-0 z-10 flex h-12 w-full items-center overflow-x-auto whitespace-nowrap border-b border-gray-800 bg-gray-900 px-2 shadow-sm',
        className,
      )}
    >
      <MobileMenuButton />
      {children ? children : null}
    </div>
  );
};

export const MainContent: React.FC<Props> = ({ children, className }) => {
  return (
    <div className={classNames('absolute left-0 top-0 h-full w-full overflow-auto px-2 pt-14 sm:px-4', className)}>
      {children ? children : null}
    </div>
  );
};
