import React, { useState, type ReactNode } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterCardItem {
  id: string;
  label: string;
  count: number | string;
  active?: boolean;
  onClick: () => void;
}

export interface PageHeaderSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onSubmit?: (e?: React.FormEvent) => void;
}

export interface PageHeaderProps {
  title: ReactNode | string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  search?: PageHeaderSearchProps | ReactNode;
  filters?: ReactNode;
  filterCards?: FilterCardItem[];
  tabs?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
  children?: ReactNode;
  onOpenMobileNav?: () => void;
}

export const MobileNavContext = React.createContext<{
  openMobileNav: () => void;
}>({ openMobileNav: () => {} });

export function useMobileNav() {
  return React.useContext(MobileNavContext);
}

export function PageHeader({
  title,
  primaryAction,
  secondaryActions,
  search,
  filters,
  filterCards,
  tabs,
  breadcrumbs,
  className,
  children,
  onOpenMobileNav,
}: PageHeaderProps) {
  const navCtx = useMobileNav();
  const handleOpenNav = onOpenMobileNav || navCtx.openMobileNav;
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const isSearchObject = search && typeof search === 'object' && 'value' in search && 'onChange' in search;
  const searchObj = isSearchObject ? (search as PageHeaderSearchProps) : null;
  const hasSearch = Boolean(search);
  const hasToolbar = Boolean(hasSearch || filters);

  return (
    <div className={cn('page-header-container w-full mb-6', className)}>
      {/* Optional Breadcrumbs */}
      {breadcrumbs && <div className="mb-2.5 text-xs text-[hsl(var(--muted-foreground))]">{breadcrumbs}</div>}

      {/* Row 1: Title & Actions */}
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        {/* Title + Mobile Menu */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleOpenNav}
            aria-label="Open navigation menu"
            className="md:hidden flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition shrink-0 cursor-pointer"
          >
            <Menu size={18} />
          </button>
          {typeof title === 'string' ? (
            <h1 className="text-[24px] sm:text-[28px] md:text-[30px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none truncate">
              {title}
            </h1>
          ) : (
            title
          )}
        </div>

        {/* Actions on right */}
        <div className="flex items-center gap-2 shrink-0">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>

      {/* Row 2: Toolbar (Search & Filter dropdowns, 16px gap above table) */}
      {hasToolbar && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Area */}
          {hasSearch && (
            <div className="flex items-center gap-3 min-w-0 w-full sm:max-w-[340px]">
              {searchObj ? (
                <div className="relative w-full">
                  <input
                    type="search"
                    value={searchObj.value}
                    onChange={(e) => searchObj.onChange(e.target.value)}
                    placeholder={searchObj.placeholder || 'Search...'}
                    className="w-full h-[40px] min-h-[40px] pl-3.5 pr-10 rounded-[10px] border border-[#E3E3EC] bg-white text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 transition shadow-2xs"
                  />
                  {searchObj.value ? (
                    <button
                      type="button"
                      onClick={() => searchObj.onChange('')}
                      aria-label="Clear search"
                      className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                  <Search
                    size={15}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
                  />
                </div>
              ) : (
                (search as ReactNode)
              )}
            </div>
          )}

          {/* Filter dropdowns on the right of toolbar (or stacked on mobile) */}
          {filters && (
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 overflow-x-auto pb-0.5 scrollbar-none sm:ml-auto">
              {filters}
            </div>
          )}
        </div>
      )}

      {/* Row 3: Filter Cards */}
      {filterCards && filterCards.length > 0 && (
        <div className="mt-4">
          <div
            className="grid grid-flow-col auto-cols-[minmax(120px,1fr)] sm:auto-cols-fr gap-3 overflow-x-auto pb-1.5 scrollbar-none"
            role="tablist"
            aria-label="Filter status cards"
          >
            {filterCards.map((card) => {
              const isActive = Boolean(card.active);
              return (
                <button
                  type="button"
                  key={card.id}
                  onClick={card.onClick}
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    'flex flex-col justify-between rounded-[12px] border p-3 h-[72px] min-w-[110px] text-left transition-all cursor-pointer select-none',
                    isActive
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 ring-1 ring-[hsl(var(--primary))]/20'
                      : 'border-[hsl(var(--card-border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--border))]/80 hover:bg-[hsl(var(--muted))]/40'
                  )}
                >
                  <span
                    className={cn(
                      'text-[12.5px] font-medium leading-none truncate',
                      isActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    {card.label}
                  </span>
                  <span className="text-[22px] sm:text-[24px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
                    {card.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 1px hairline divider with 24-32px spacing to page content */}
          <div className="mt-5 border-b border-[hsl(var(--border))]" />
        </div>
      )}

      {/* Optional Tabs */}
      {tabs && <div className="mt-4 border-b border-[hsl(var(--border))]">{tabs}</div>}

      {/* Extra Header Content */}
      {children}
    </div>
  );
}
