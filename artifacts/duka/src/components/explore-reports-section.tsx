import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/segmented-control";
import {
  REPORT_CATALOG,
  REPORT_ICONS,
  type ReportConfig,
  type ReportCategory,
} from "@/lib/report-catalog";
import { useSubscription } from "@/hooks/use-subscription";

export const HUB_STATE_STORAGE_KEY = "takeorder_analytics_hub_state";

export interface HubSavedState {
  tab: string;
  search: string;
  scrollY: number;
}

export function saveHubState(state: Partial<HubSavedState>) {
  try {
    const existing: HubSavedState = JSON.parse(
      sessionStorage.getItem(HUB_STATE_STORAGE_KEY) || "{}"
    ) || { tab: "all", search: "", scrollY: 0 };
    sessionStorage.setItem(
      HUB_STATE_STORAGE_KEY,
      JSON.stringify({ ...existing, ...state })
    );
  } catch {
    // ignore
  }
}

export function readHubState(): HubSavedState {
  try {
    return (
      JSON.parse(sessionStorage.getItem(HUB_STATE_STORAGE_KEY) || "{}") || {
        tab: "all",
        search: "",
        scrollY: 0,
      }
    );
  } catch {
    return { tab: "all", search: "", scrollY: 0 };
  }
}

export function ExploreReportsSection() {
  const [, setLocation] = useLocation();
  const subscription = useSubscription();

  const savedState = useMemo(() => readHubState(), []);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    savedState.tab || "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>(savedState.search || "");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Restore scroll position if previously saved
  useEffect(() => {
    if (savedState.scrollY > 0) {
      window.scrollTo({ top: savedState.scrollY, behavior: "instant" as ScrollBehavior });
      saveHubState({ scrollY: 0 });
    }
  }, [savedState.scrollY]);

  // Fetch favorites on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/favorites", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { favorites: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.favorites)) {
          setFavorites(new Set(data.favorites));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = async (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Optimistic toggle
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

    try {
      const res = await fetch(`/api/analytics/favorites/${slug}/toggle`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.favorites)) {
          setFavorites(new Set(data.favorites));
        }
      }
    } catch {
      // Revert if error
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    }
  };

  const handleCardClick = (slug: string) => {
    saveHubState({
      tab: selectedCategory,
      search: searchQuery,
      scrollY: window.scrollY,
    });
    setLocation(`/analytics/reports/${slug}`);
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return REPORT_CATALOG.filter((report) => {
      // Category filter
      if (selectedCategory === "favorites") {
        if (!favorites.has(report.slug)) return false;
      } else if (selectedCategory !== "all") {
        if (report.category !== selectedCategory) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = report.title.toLowerCase().includes(q);
        const matchDesc = report.description.toLowerCase().includes(q);
        const matchCat = report.category.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat) return false;
      }

      return true;
    });
  }, [selectedCategory, searchQuery, favorites]);

  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {
      all: REPORT_CATALOG.length,
      favorites: favorites.size,
      sales: 0,
      orders: 0,
      customers: 0,
      channels: 0,
      inventory: 0,
      finance: 0,
    };

    REPORT_CATALOG.forEach((r) => {
      if (r.category in counts) counts[r.category]++;
    });

    return [
      { value: "all", label: "All", count: counts.all },
      {
        value: "favorites",
        label: (
          <span className="inline-flex items-center gap-1">
            <Star size={12} className={favorites.size > 0 ? "fill-amber-400 text-amber-400" : ""} />
            <span>Favorites</span>
          </span>
        ),
        count: counts.favorites,
      },
      { value: "sales", label: "Sales", count: counts.sales },
      { value: "orders", label: "Orders", count: counts.orders },
      { value: "customers", label: "Customers", count: counts.customers },
      { value: "channels", label: "Channels", count: counts.channels },
      { value: "inventory", label: "Inventory", count: counts.inventory },
      { value: "finance", label: "Finance", count: counts.finance },
    ];
  }, [favorites.size]);

  return (
    <section aria-label="Explore analytics reports" className="space-y-4">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))] tracking-tight">
              Explore analytics
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
              {REPORT_CATALOG.length}
            </span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Deep-dive reports for sales, operational velocity, cash flows, and customer cohorts.
          </p>
        </div>

        {/* Search input with rounded container */}
        <div className="relative w-full sm:w-[260px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              saveHubState({ search: e.target.value });
            }}
            placeholder="Search reports..."
            className="w-full h-9 pl-9 pr-8 rounded-full border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-neutral-900/15 dark:focus:ring-white/20 transition shadow-2xs"
          />
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] pointer-events-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                saveHubState({ search: "" });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <SegmentedControl
          size="sm"
          value={selectedCategory}
          onChange={(val) => {
            setSelectedCategory(val);
            saveHubState({ tab: val });
          }}
          options={categoryOptions}
        />
      </div>

      {/* ── Two-Column Reports Grid (1 column on mobile, 16-20px gaps) ── */}
      {filteredReports.length === 0 ? (
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {selectedCategory === "favorites"
            ? "No favorite reports yet. Click the star on any report to pin it here."
            : "No reports match your search query."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-4.5">
          {filteredReports.map((report) => {
            const isFavorited = favorites.has(report.slug);
            const iconConfig = REPORT_ICONS[report.slug] || REPORT_ICONS["sales-summary"];
            const IconComponent = iconConfig.icon;
            const isLocked = report.minPlan === "pro" && !subscription.isPro;

            return (
              <div
                key={report.slug}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(report.slug)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(report.slug);
                  }
                }}
                className={cn(
                  "group relative flex items-start gap-3.5 rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-4 sm:p-4.5",
                  "hover:border-neutral-400 dark:hover:border-neutral-700 hover:shadow-xs transition-all duration-150 cursor-pointer outline-none select-none"
                )}
              >
                {/* 44px rounded grey icon tile with colored line icon */}
                <div
                  className="w-11 h-11 min-w-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  aria-hidden="true"
                >
                  <IconComponent size={20} style={{ color: iconConfig.color }} strokeWidth={2} />
                </div>

                {/* Card Content */}
                <div className="flex-1 min-w-0 pr-12">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] leading-tight truncate">
                      {report.title}
                    </h3>
                    {report.minPlan === "pro" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2 leading-relaxed">
                    {report.description}
                  </p>
                </div>

                {/* Right Action: Star Favorite Toggle Button */}
                <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(report.slug, e)}
                    className={cn(
                      "p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer",
                      isFavorited && "text-amber-500 hover:text-amber-600"
                    )}
                    title={isFavorited ? "Remove from favorites" : "Favorite this report"}
                    aria-label={`Favorite ${report.title}`}
                  >
                    <Star
                      size={16}
                      className={cn(
                        "transition-transform active:scale-125",
                        isFavorited ? "fill-amber-400 text-amber-500" : "fill-none"
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
