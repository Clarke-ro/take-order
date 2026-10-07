import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type AttentionCardKey =
  | 'orders_to_ship'
  | 'low_stock'
  | 'unpaid_orders'
  | 'missing_costs'
  | 'orders'
  | 'recent_transactions';

export interface CardAttention {
  count: number;
  newCount: number;
  newItemIds: number[];
}

export interface AttentionSummary {
  cards: {
    orders_to_ship: CardAttention;
    low_stock: CardAttention;
    unpaid_orders: CardAttention;
    missing_costs: CardAttention;
    recent_transactions?: CardAttention;
  };
  unreadOrderIds?: number[];
  sidebarOrders: {
    count: number;
    newCount: number;
  };
}

export const ATTENTION_QUERY_KEY = ['attention-summary'];

const READ_ORDERS_STORAGE_KEY = 'takeorder_read_order_ids';

export function getLocalReadOrderIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_ORDERS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    }
  } catch {}
  return new Set();
}

export function saveLocalReadOrderId(orderId: number) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalReadOrderIds();
    current.add(orderId);
    localStorage.setItem(READ_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(current)));
    window.dispatchEvent(new CustomEvent('takeorder_order_read', { detail: { orderId } }));
  } catch {}
}

/**
 * Hook providing reactive set of order IDs that have been read in this client.
 * Updates instantly on local click or cross-tab storage change.
 */
export function useReadOrders(): Set<number> {
  const [readOrderIds, setReadOrderIds] = useState<Set<number>>(() => getLocalReadOrderIds());

  useEffect(() => {
    const handler = () => {
      setReadOrderIds(getLocalReadOrderIds());
    };
    window.addEventListener('takeorder_order_read', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('takeorder_order_read', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return readOrderIds;
}

/**
 * Evaluates whether a given order is unread:
 * 1. False if marked read locally in localStorage.
 * 2. False if order carries a readAt timestamp.
 * 3. If backend supplied an explicit unreadOrderIds list, checks membership.
 * 4. Otherwise (default when new or unread on remote backend), true.
 */
export function isOrderUnread(
  order: { id: number; readAt?: string | Date | null },
  readOrderIds: Set<number>,
  backendUnreadIds?: number[]
): boolean {
  if (readOrderIds.has(order.id)) return false;
  if (order.readAt != null) return false;
  if (Array.isArray(backendUnreadIds)) {
    return backendUnreadIds.includes(order.id);
  }
  return true;
}

/**
 * Reads live attention summary as the single source of truth for Dashboard Recent Updates
 * and the sidebar Orders badge.
 * Live updates without reload: refetches on window focus and every 45 seconds while visible.
 */
export function useAttentionSummary() {
  return useQuery<AttentionSummary>({
    queryKey: ATTENTION_QUERY_KEY,
    queryFn: async () => {
      return await customFetch<AttentionSummary>('/api/attention');
    },
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
    staleTime: 10_000,
  });
}

/**
 * Idempotent mutation to mark a card/category as seen on destination view.
 */
export function useMarkCardSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardKey: AttentionCardKey | string) => {
      return await customFetch<{ success: boolean; cardKey: string; seenAt: string }>('/api/attention/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEY });
    },
  });
}

/**
 * Idempotent mutation to mark an individual order as read when opened/clicked.
 * Optimistically removes the order ID from unreadOrderIds and decrements attention newCount.
 */
export function useMarkOrderRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: number) => {
      try {
        return await customFetch<{ success: boolean; orderId: number; readAt: string }>('/api/attention/read-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
      } catch {
        // Tolerate gracefully if remote API server is in flight
        return { success: true, orderId, readAt: new Date().toISOString() };
      }
    },
    onMutate: async (orderId: number) => {
      // 1. Immediately persist locally and notify components
      saveLocalReadOrderId(orderId);

      // 2. Optimistically update React Query attention cache
      await queryClient.cancelQueries({ queryKey: ATTENTION_QUERY_KEY });
      const prev = queryClient.getQueryData<AttentionSummary>(ATTENTION_QUERY_KEY);
      if (prev) {
        queryClient.setQueryData<AttentionSummary>(ATTENTION_QUERY_KEY, {
          ...prev,
          unreadOrderIds: prev.unreadOrderIds ? prev.unreadOrderIds.filter((id) => id !== orderId) : [],
          cards: {
            ...prev.cards,
            orders_to_ship: {
              ...prev.cards.orders_to_ship,
              newCount: Math.max(0, prev.cards.orders_to_ship.newItemIds?.includes(orderId) ? prev.cards.orders_to_ship.newCount - 1 : prev.cards.orders_to_ship.newCount),
              newItemIds: prev.cards.orders_to_ship.newItemIds?.filter((id) => id !== orderId) ?? [],
            },
            unpaid_orders: {
              ...prev.cards.unpaid_orders,
              newCount: Math.max(0, prev.cards.unpaid_orders.newItemIds?.includes(orderId) ? prev.cards.unpaid_orders.newCount - 1 : prev.cards.unpaid_orders.newCount),
              newItemIds: prev.cards.unpaid_orders.newItemIds?.filter((id) => id !== orderId) ?? [],
            },
            recent_transactions: prev.cards.recent_transactions ? {
              ...prev.cards.recent_transactions,
              newCount: Math.max(0, prev.cards.recent_transactions.newItemIds?.includes(orderId) ? prev.cards.recent_transactions.newCount - 1 : prev.cards.recent_transactions.newCount),
              newItemIds: prev.cards.recent_transactions.newItemIds?.filter((id) => id !== orderId) ?? [],
            } : prev.cards.recent_transactions,
          },
          sidebarOrders: {
            ...prev.sidebarOrders,
            newCount: Math.max(0, prev.cards.orders_to_ship.newItemIds?.includes(orderId) ? prev.sidebarOrders.newCount - 1 : prev.sidebarOrders.newCount),
          },
        });
      }
      return { prev };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEY });
    },
  });
}
