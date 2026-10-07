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
      return await customFetch<{ success: boolean; orderId: number; readAt: string }>('/api/attention/read-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
    },
    onMutate: async (orderId: number) => {
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
    onError: (_err, _orderId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(ATTENTION_QUERY_KEY, context.prev);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENTION_QUERY_KEY });
    },
  });
}
