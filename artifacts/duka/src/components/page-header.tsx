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

      {/* Row 2: Toolbar (Search & Filter dropdowns, 16px below row 1) */}
      {hasToolbar && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Area */}
          {hasSearch && (
            <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-[340px]">
              {searchObj ? (
                <>
                  {/* Desktop / tablet search input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      searchObj.onSubmit?.(e);
                    }}
                    className={cn(
                      'relative items-center w-full transition-all',
                      mobileSearchOpen ? 'flex' : 'hidden sm:flex'
                    )}
                  >
                    <Search
                      size={14}
                      className="absolute left-3 text-[hsl(var(--muted-foreground))] pointer-events-none"
                    />
                    <input
                      type="search"
                      value={searchObj.value}
                      onChange={(e) => searchObj.onChange(e.target.value)}
                      placeholder={searchObj.placeholder || 'Search...'}
                      className="w-full h-9 min-h-[38px] pl-8 pr-8 rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/25 transition"
                    />
                    {searchObj.value ? (
                      <button
                        type="button"
                        onClick={() => searchObj.onChange('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    ) : mobileSearchOpen ? (
                      <button
                        type="button"
                        onClick={() => setMobileSearchOpen(false)}
                        aria-label="Close search"
                        className="sm:hidden absolute right-2.5 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </form>

                  {/* Mobile search toggle icon button when collapsed */}
                  {!mobileSearchOpen && (
                    <button
                      type="button"
                      onClick={() => setMobileSearchOpen(true)}
                      aria-label="Search"
                      className="sm:hidden inline-flex items-center gap-1.5 h-9 min-h-[44px] px-3 rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
                    >
                      <Search size={14} />
                      <span className="truncate max-w-[120px]">
                        {searchObj.value || searchObj.placeholder || 'Search...'}
                      </span>
                    </button>
                  )}
                </>
              ) : (
                search
              )}
            </div>
          )}

          {/* Filter dropdowns on the right of toolbar */}
          {filters && (
            <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-0.5 scrollbar-none sm:ml-auto">
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
