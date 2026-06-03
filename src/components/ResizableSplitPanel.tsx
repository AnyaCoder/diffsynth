'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ResizableSplitPanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  rightMinWidthClassName?: string;
}

export default function ResizableSplitPanel({
  left,
  right,
  defaultLeftWidth = 820,
  minLeftWidth = 640,
  maxLeftWidth = 980,
  rightMinWidthClassName = 'xl:min-w-[320px]',
}: ResizableSplitPanelProps) {
  const tCommon = useTranslations('common');
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [desktopEqualHeight, setDesktopEqualHeight] = useState<number | null>(null);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      const delta = event.clientX - dragState.current.startX;
      const nextWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, dragState.current.startWidth + delta));
      setLeftWidth(nextWidth);
    };

    const handleUp = () => {
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [maxLeftWidth, minLeftWidth]);

  useEffect(() => {
    const syncHeight = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 1280) {
        setDesktopEqualHeight(null);
        return;
      }
      const nextHeight = leftPaneRef.current?.getBoundingClientRect().height ?? null;
      setDesktopEqualHeight(nextHeight && nextHeight > 0 ? Math.ceil(nextHeight) : null);
    };

    syncHeight();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncHeight);
    }

    const observer =
      typeof ResizeObserver !== 'undefined' && leftPaneRef.current
        ? new ResizeObserver(() => syncHeight())
        : null;
    if (observer && leftPaneRef.current) {
      observer.observe(leftPaneRef.current);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncHeight);
      }
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-0">
      <div
        ref={leftPaneRef}
        data-resizable-panel="left"
        className="shrink-0 xl:flex xl:max-w-[calc(100%-360px)]"
        style={{ width: `min(100%, ${leftWidth}px)` }}
      >
        {left}
      </div>
      <div
        className="relative hidden w-4 shrink-0 cursor-col-resize items-stretch justify-center xl:flex"
        onPointerDown={event => {
          dragState.current = { startX: event.clientX, startWidth: leftWidth };
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        aria-label={tCommon('resizeLeftPanel')}
        role="separator"
      >
        <div className="my-2 w-px rounded-full bg-gray-800" />
        <div className="pointer-events-none absolute left-1/2 top-32 -translate-x-1/2 rounded-full border border-gray-700 bg-gray-950 px-1 py-3 text-[10px] uppercase tracking-[0.25em] text-gray-500">
          {tCommon('drag')}
        </div>
      </div>
      <div
        data-resizable-panel="right"
        className={`min-w-0 flex-1 xl:flex xl:min-h-0 xl:overflow-hidden ${rightMinWidthClassName}`}
        style={desktopEqualHeight ? { height: `${desktopEqualHeight}px` } : undefined}
      >
        {right}
      </div>
    </div>
  );
}
