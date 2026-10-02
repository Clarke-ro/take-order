import React, { type ReactNode, type KeyboardEvent } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Search, X, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (item: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  minWidth?: string | number;
  className?: string;
  headerClassName?: string;
  ariaLabel?: string;
}

export interface DataTableFilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel?: string;
  className?: string;
}

export function DataTableFilterDropdown({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: DataTableFilterDropdownProps) {
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel || label}
        className="h-[40px] min-h-[40px] appearance-none pl-3.5 pr-8 rounded-[10px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 text-[13px] font-medium text-[#374151] dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 transition cursor-pointer select-none shadow-2xs"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export interface DataTableToolbarProps {
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    onSubmit?: (e?: React.FormEvent) => void;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DataTableToolbar({
  search,
  filters,
  actions,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        'data-table-toolbar mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
        {search && (
          <div className="relative w-full sm:max-w-[340px]">
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || 'Search...'}
              className="w-full h-[40px] min-h-[40px] pl-3.5 pr-10 rounded-[10px] border border-[#E3E3EC] bg-white text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 transition shadow-2xs"
            />
            {search.value ? (
              <button
                type="button"
                onClick={() => search.onChange('')}
                aria-label="Clear search"
                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
              >
                <X size={13} />
              </button>
            ) : null}
            <Search
              size={15}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
          </div>
        )}
        {filters && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {filters}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T, e: React.MouseEvent<HTMLTableRowElement>) => void;
  rowClassName?: (item: T, index: number) => string;
  rowAriaLabel?: (item: T, index: number) => string;
  rowTestId?: (item: T, index: number) => string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyState?: {
    isFiltered?: boolean;
    noDataTitle?: string;
    noDataMessage?: string;
    noResultsTitle?: string;
    noResultsMessage?: string;
    action?: ReactNode;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    onPageChange: (page: number) => void;
  };
  toolbar?: ReactNode;
  className?: string;
  cardClassName?: string;
  minTableWidth?: string;
  ariaLabel?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  rowClassName,
  rowAriaLabel,
  rowTestId,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  emptyState,
  pagination,
  toolbar,
  className,
  cardClassName,
  minTableWidth = '780px',
  ariaLabel,
}: DataTableProps<T>) {
  const handleKeyDown = (item: T, e: KeyboardEvent<HTMLTableRowElement>) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(item, e as unknown as React.MouseEvent<HTMLTableRowElement>);
    }
  };

  const totalCols = columns.length;

  return (
    <div className={cn('data-table-container w-full', className)}>
      {/* 16px Toolbar above table */}
      {toolbar}

      {/* Table Card: white, 1px border (#E3E3EC), 12px radius, overflow clipped, full width */}
      <div
        className={cn(
          'data-table-card rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden shadow-none w-full',
          cardClassName
        )}
      >
        <div className="overflow-x-auto w-full scrollbar-thin">
          <Table
            className="w-full text-left border-collapse"
            style={{ minWidth: minTableWidth }}
            aria-label={ariaLabel}
          >
            {/* Header row: ~48px, pale lavender-grey (#F0F0F8), 14px weight 600 near-black, sentence case, 16px padding */}
            <TableHeader className="border-b border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-800/80">
              <TableRow className="border-b-0 hover:bg-transparent h-[48px] min-h-[48px]">
                {columns.map((col, colIdx) => {
                  const isLast = colIdx === totalCols - 1;
                  const align = col.align || (isLast ? 'right' : 'left');
                  const alignClass =
                    align === 'right'
                      ? 'text-right'
                      : align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  return (
                    <TableHead
                      key={col.id}
                      className={cn(
                        'h-[48px] px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case select-none whitespace-nowrap',
                        alignClass,
                        col.headerClassName
                      )}
                      style={{
                        minWidth: col.minWidth || '120px',
                      }}
                    >
                      {col.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* Loading State: 5 skeleton rows inside card with real header visible, mirroring columns, light bars (#F4F4FA, 8px radius), no spinner */}
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <TableRow
                    key={`loading-row-${rIdx}`}
                    className="h-[64px] min-h-[64px] border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 hover:bg-transparent"
                  >
                    {columns.map((col, cIdx) => {
                      const isLast = cIdx === totalCols - 1;
                      const align = col.align || (isLast ? 'right' : 'left');
                      const alignClass =
                        align === 'right'
                          ? 'justify-end'
                          : align === 'center'
                          ? 'justify-center'
                          : 'justify-start';

                      return (
                        <TableCell key={`loading-cell-${cIdx}`} className="px-4 py-3.5">
                          <div className={cn('flex items-center', alignClass)}>
                            <div
                              className="h-[18px] rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800/80 animate-pulse"
                              style={{
                                width:
                                  cIdx === 0
                                    ? '65%'
                                    : cIdx === 1
                                    ? '85%'
                                    : cIdx === totalCols - 1
                                    ? '50%'
                                    : '70%',
                                minWidth: '40px',
                              }}
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : isError ? (
                /* Error State: One row with message and Retry */
                <TableRow className="h-[80px]">
                  <TableCell
                    colSpan={totalCols}
                    className="px-4 py-6 text-center text-[#DC2626] dark:text-rose-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="flex items-center gap-2 text-[13.5px] font-medium">
                        <AlertCircle size={16} />
                        <span>{errorMessage || 'Failed to load table records.'}</span>
                      </div>
                      {onRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onRetry}
                          className="mt-1 h-8 rounded-[8px] border-[#E3E3EC] text-xs gap-1.5 cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>Retry</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                /* Empty State: header stays, centered muted message (different for no data vs no results) */
                <TableRow className="h-[140px]">
                  <TableCell
                    colSpan={totalCols}
                    className="px-4 py-8 text-center text-[#6B7280] dark:text-neutral-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">
                        {emptyState?.isFiltered
                          ? emptyState.noResultsTitle || 'No results found'
                          : emptyState?.noDataTitle || 'No records yet'}
                      </p>
                      <p className="text-[13px] text-[#6B7280] dark:text-neutral-400">
                        {emptyState?.isFiltered
                          ? emptyState.noResultsMessage || 'Try adjusting your search terms or filters.'
                          : emptyState?.noDataMessage || 'Records will appear here once created.'}
                      </p>
                      {emptyState?.action && (
                        <div className="mt-2">{emptyState.action}</div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                /* Real Data Rows */
                data.map((item, index) => {
                  const key = keyExtractor(item, index);
                  const isClickable = Boolean(onRowClick);
                  const customClass = rowClassName ? rowClassName(item, index) : '';
                  const ariaLabelText = rowAriaLabel ? rowAriaLabel(item, index) : undefined;
                  const testId = rowTestId ? rowTestId(item, index) : undefined;

                  return (
                    <TableRow
                      key={key}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={ariaLabelText}
                      data-testid={testId}
                      onKeyDown={(e) => handleKeyDown(item, e)}
                      onClick={(e) => {
                        // Avoid triggering row click if interactive element inside was clicked
                        if (
                          (e.target as HTMLElement).closest(
                            'a, button, input, select, textarea, [data-prevent-row-click]'
                          )
                        ) {
                          return;
                        }
                        if (onRowClick) onRowClick(item, e);
                      }}
                      className={cn(
                        'min-h-[64px] h-[64px] border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 transition-colors',
                        isClickable
                          ? 'cursor-pointer hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 focus:outline-none focus:bg-[#F9F9FC] dark:focus:bg-neutral-800/50'
                          : 'hover:bg-[#FAFAFC] dark:hover:bg-neutral-800/20',
                        customClass
                      )}
                    >
                      {columns.map((col, colIdx) => {
                        const isLast = colIdx === totalCols - 1;
                        const align = col.align || (isLast ? 'right' : 'left');
                        const alignClass =
                          align === 'right'
                            ? 'text-right'
                            : align === 'center'
                            ? 'text-center'
                            : 'text-left';

                        return (
                          <TableCell
                            key={col.id}
                            className={cn(
                              'px-4 py-3.5 text-[14px] text-[#111827] dark:text-neutral-100 align-middle',
                              alignClass,
                              col.className
                            )}
                          >
                            {col.cell(item, index)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer: keep existing pagination or load-more, restyled as a slim footer row inside card */}
        {pagination && pagination.totalCount > 0 && (
          <div className="data-table-footer border-t border-[#E8E8EE] dark:border-neutral-800 px-4 py-3 flex items-center justify-between text-[13px] text-[#6B7280] dark:text-neutral-400 bg-white dark:bg-neutral-900">
            <div>
              Showing{' '}
              <span className="font-medium text-[#111827] dark:text-neutral-200">
                {Math.min(
                  pagination.totalCount,
                  (pagination.page - 1) * pagination.pageSize + 1
                )}
              </span>
              {' – '}
              <span className="font-medium text-[#111827] dark:text-neutral-200">
                {Math.min(
                  pagination.totalCount,
                  pagination.page * pagination.pageSize
                )}
              </span>{' '}
              of{' '}
              <span className="font-medium text-[#111827] dark:text-neutral-200">
                {pagination.totalCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                className="h-8 px-2.5 rounded-[8px] border-[#E3E3EC] text-xs gap-1 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft size={13} />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pagination.page * pagination.pageSize >= pagination.totalCount
                }
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                className="h-8 px-2.5 rounded-[8px] border-[#E3E3EC] text-xs gap-1 cursor-pointer disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standard Cell Two-Line Content Helper:
 * Primary at 14px/500 near-black, secondary at 13px muted below it.
 */
export function DataTableCellTwoLine({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col min-w-0', className)}>
      <span className="text-[14px] font-medium text-[#111827] dark:text-neutral-100 truncate">
        {primary}
      </span>
      {secondary && (
        <span className="text-[13px] text-[#6B7280] dark:text-neutral-400 truncate mt-0.5">
          {secondary}
        </span>
      )}
    </div>
  );
}
