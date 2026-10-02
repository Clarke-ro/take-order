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
        <div className="flex items-center gap-3 shrink-0">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>

      {/* Row 2: Toolbar (Search, Compact Segmented Filter Bar, and Filters) */}
      {(hasToolbar || (filterCards && filterCards.length > 0)) && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Area */}
            {hasSearch && (
              <div className="flex items-center min-w-0 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[340px] shrink-0">
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

            {/* Compact Segmented Filter Bar */}
            {filterCards && filterCards.length > 0 && (
              <div
                className="w-full sm:w-auto max-w-full overflow-x-auto scrollbar-none py-0.5"
                role="tablist"
                aria-label="Filter status tabs"
              >
                <div className="inline-flex items-center h-[40px] min-h-[40px] p-1 rounded-[10px] sm:rounded-[12px] border border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-850 gap-1">
                  {filterCards.map((card) => {
                    const isActive = Boolean(card.active);
                    return (
                      <button
                        type="button"
                        key={card.id}
                        onClick={card.onClick}
                        role="tab"
                        aria-selected={isActive}
                        data-testid={`filter-tab-${card.id}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13.5px] sm:text-[14px] font-medium transition-all select-none whitespace-nowrap cursor-pointer min-h-[32px] sm:min-h-0',
                          isActive
                            ? 'bg-white text-[hsl(var(--primary))] shadow-2xs border border-[hsl(var(--primary))]/20 font-semibold dark:bg-neutral-900 dark:text-[hsl(var(--primary))]'
                            : 'text-[#6B7280] hover:text-[#111827] dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent'
                        )}
                      >
                        <span>{card.label}</span>
                        <span
                          className={cn(
                            'inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-semibold rounded-full min-w-[18px]',
                            isActive
                              ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] dark:bg-[hsl(var(--primary))]/20'
                              : 'bg-black/5 text-[#6B7280] dark:bg-white/10 dark:text-neutral-400'
                          )}
                        >
                          {card.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter dropdowns on the right of toolbar */}
            {filters && (
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 overflow-x-auto pb-0.5 scrollbar-none sm:ml-auto">
                {filters}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Optional Tabs */}
      {tabs && <div className="mt-4 border-b border-[hsl(var(--border))]">{tabs}</div>}

      {/* Extra Header Content */}
      {children}
    </div>
  );
}
