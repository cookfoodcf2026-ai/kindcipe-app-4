import { useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface UseRecipeSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  cookTimeMax?: number;
  popularChips?: string[];
  ingredientCategory?: string;
  source?: "all" | "official" | "user" | "kol";
  limit?: number;
}

export function useRecipeSearch(options: UseRecipeSearchOptions = {}) {
  const {
    query,
    category,
    tags,
    cookTimeMax,
    popularChips,
    ingredientCategory,
    source,
    limit = 20,
  } = options;

  const result = trpc.recipes.search.useInfiniteQuery(
    {
      query: query || undefined,
      category: category === "all" ? undefined : category,
      tags: tags || undefined,
      cookTimeMax: cookTimeMax || undefined,
      popularChips: popularChips || undefined,
      ingredientCategory: ingredientCategory || undefined,
      source: source || undefined,
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

  const officialCount = useMemo(() => {
    return result.data?.pages[0]?.officialCount ?? 0;
  }, [result.data]);

  const customCount = useMemo(() => {
    return result.data?.pages[0]?.customCount ?? 0;
  }, [result.data]);

  const kolCount = useMemo(() => {
    return result.data?.pages[0]?.kolCount ?? 0;
  }, [result.data]);

  const fetchNextPage = useCallback(() => {
    if (result.hasNextPage && !result.isFetchingNextPage) {
      result.fetchNextPage();
    }
  }, [result.hasNextPage, result.isFetchingNextPage, result.fetchNextPage]);

  return {
    recipes,
    total,
    officialCount,
    customCount,
    kolCount,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: !!result.hasNextPage,
    fetchNextPage,
    refetch: result.refetch,
    isError: result.isError,
    error: result.error,
  };
}
