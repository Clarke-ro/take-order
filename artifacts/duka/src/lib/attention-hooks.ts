import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type AttentionCardKey =
  | 'orders_to_ship'
  | 'low_stock'
  | 'unpaid_orders'
  | 'missing_costs'
  | 'orders';

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
  };
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
