'use client';

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { RouterLink } from 'src/routes/components';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from 'src/components/ui/sidebar';
import { Label } from 'src/components/ui/label';
import { ScrollArea } from 'src/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'src/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useSettings } from 'src/hooks/use-settings';
import { HistoryDataRange, HistoryWindowSize } from 'src/types';

import type { NavItem } from '../config-nav-dashboard';

const HISTORY_RANGE_OPTIONS: { value: HistoryDataRange; label: string }[] = [
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 3600, label: '60 min' },
  { value: 28800, label: '8 hours' },
  { value: -1, label: 'All time' },
];

const WINDOW_SIZE_OPTIONS: { value: HistoryWindowSize; label: string }[] = [
  { value: 0, label: 'Auto' },
  { value: 1, label: '1s (Raw)' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
];

export type AppSidebarProps = {
  data: NavItem[];
  slots?: {
    topArea?: React.ReactNode;
    bottomArea?: React.ReactNode;
  };
};

/**
 * Renders a single navigation item using shadcn SidebarMenuButton.
 * For items with children, renders as a collapsible instead of a link.
 * Locked items display with faded styling and a padlock icon.
 */
function NavItemComponent({ item, pathname }: { item: NavItem; pathname: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.path === pathname;
  const isLocked = item.locked ?? false;

  if (hasChildren) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title}>
              {item.icon}
              <span>{item.title}</span>
              <ChevronDown
                className={cn(
                  'ml-auto size-4 transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => (
                <SidebarMenuSubItem key={child.path}>
                  <SidebarMenuSubButton asChild isActive={child.path === pathname}>
                    <RouterLink href={child.path || '#'}>
                      {child.icon}
                      <span>{child.title}</span>
                    </RouterLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={isLocked ? `${item.title} (Locked)` : item.title}
        className={cn(isLocked && 'opacity-50')}
      >
        <RouterLink href={item.path || '#'}>
          <span className={cn('relative', isLocked && 'text-muted-foreground')}>
            {item.icon}
            {isLocked && (
              <Lock size={12} className="absolute -right-1 -top-1 text-muted-foreground" />
            )}
          </span>
          <span className={cn(isLocked && 'text-muted-foreground')}>{item.title}</span>
        </RouterLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Dashboard sidebar navigation using shadcn Sidebar components.
 * Displays navigation items grouped by type (main, sub, debug) with support
 * for nested items and active state highlighting.
 */
export function AppSidebar({ data, slots }: AppSidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { settings, saveSettings } = useSettings({ reloadEverySecond: false });

  const mainItems = data.filter((item) => item.group === 'main');
  const subItems = data.filter((item) => item.group === 'sub');
  const debugItems = data.filter((item) => item.group === 'debug');
  const footerItems = data.filter((item) => item.group === 'footer');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">{slots?.topArea}</SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <NavItemComponent key={item.path || item.title} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="flex items-end justify-between gap-3 px-2 py-2 group-data-[collapsible=icon]:hidden">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="history-range" className="text-xs text-muted-foreground">
                    History Range
                  </Label>
                  <Select
                    value={String(settings.historyDataRange)}
                    onValueChange={(value) =>
                      saveSettings({
                        ...settings,
                        historyDataRange: parseInt(value, 10) as HistoryDataRange,
                      })
                    }
                  >
                    <SelectTrigger id="history-range" className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HISTORY_RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="window-size" className="text-xs text-muted-foreground">
                    Window Size
                  </Label>
                  <Select
                    value={String(settings.historyWindowSize)}
                    onValueChange={(value) =>
                      saveSettings({
                        ...settings,
                        historyWindowSize: parseInt(value, 10) as HistoryWindowSize,
                      })
                    }
                  >
                    <SelectTrigger id="window-size" className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WINDOW_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          {subItems.length > 0 && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {subItems.map((item) => (
                      <NavItemComponent
                        key={item.path || item.title}
                        item={item}
                        pathname={pathname}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}

          {debugItems.length > 0 && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {debugItems.map((item) => (
                      <NavItemComponent
                        key={item.path || item.title}
                        item={item}
                        pathname={pathname}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="gap-1 p-2">
        {footerItems.length > 0 && (
          <SidebarMenu>
            {footerItems.map((item) => (
              <NavItemComponent key={item.path || item.title} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        )}
        {slots?.bottomArea}
      </SidebarFooter>
    </Sidebar>
  );
}
