import { X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { CONFIG } from 'src/config-global';
import { useDebug } from 'src/contexts/debug/DebugContext';

import { Badge } from '@/components/ui/badge';

const CLICK_THRESHOLD = 5;
const CLICK_TIMEOUT = 2000;

/**
 * Displays the application version with a hidden debug mode toggle.
 * Clicking the version 5 times within 2 seconds enables debug mode.
 */
export function VersionDisplay() {
  const { isDebugMode, enableDebugMode, disableDebugMode } = useDebug();
  const [clickCount, setClickCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionClick = useCallback(() => {
    if (isDebugMode) {
      disableDebugMode();
      setClickCount(0);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount >= CLICK_THRESHOLD) {
      enableDebugMode();
      setClickCount(0);
    } else {
      timeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, CLICK_TIMEOUT);
    }
  }, [clickCount, isDebugMode, enableDebugMode, disableDebugMode]);

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      {isDebugMode && (
        <div className="mb-1 flex justify-center">
          <Badge className="gap-1 bg-amber-500 text-xs font-bold text-white hover:bg-amber-500">
            Debug mode
            <button
              type="button"
              onClick={disableDebugMode}
              className="ml-0.5 rounded-full hover:opacity-70"
              aria-label="Disable debug mode"
            >
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      )}
      {/* Deliberately not styled as interactive: the click target is a hidden
          debug toggle, not something a reader should be invited to press. */}
      <span
        onClick={handleVersionClick}
        className="block select-none px-2 pt-1 text-center text-xs tabular-nums text-muted-foreground"
      >
        {CONFIG.appVersion}
      </span>
    </div>
  );
}
