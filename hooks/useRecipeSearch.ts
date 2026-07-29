import { useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface UseRecipeSearchOptions {
  query?: string;
  category?: string;
  tag?: string;
  cookTimeMax?: number;
  popularChip?: string;
  limit?: number;
}

export function useRecipeSearch(options: UseRecipeSearchOptions = {}) {
  const {
    query,
    category,
    tag,
    cookTimeMax,
    popularChip,
    limit = 20,
  } = options;

  const result = trpc.recipes.search.useInfiniteQuery(
    {
      query: query || undefined,
      category: category === "all" ? undefined : category,
      tag: tag || undefined,
      cookTimeMax: cookTimeMax || undefined,
      popularChip: popularChip || undefined,
      limit,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 30000,
    }
  );

  const recipes = useMemo(() => {
    return result.data?.pages.flatMap((p) => p.recipes) ?? [];
  }, [result.data]);

  const total = useMemo(() => {
    return result.data?.pages[0]?.total ?? 0;
  }, [result.data]);

  const fetchNextPage = useCallback(() => {
    if (result.hasNextPage && !result.isFetchingNextPage) {
      result.fetchNextPage();
    }
  }, [result.hasNextPage, result.isFetchingNextPage, result.fetchNextPage]);

  return {
    recipes,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: !!result.hasNextPage,
    fetchNextPage,
    refetch: result.refetch,
  };
}
