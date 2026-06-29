import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

interface UseRecipeSearchOptions {
  query?: string;
  category?: string;
  tag?: string;
  cookTimeMax?: number;
  limit?: number;
}

export function useRecipeSearch(options: UseRecipeSearchOptions = {}) {
  const {
    query = "",
    category,
    tag,
    cookTimeMax,
    limit = 20,
  } = options;

  const result = trpc.recipes.search.useInfiniteQuery(
    {
      query: query || undefined,
      category: category === "all" ? undefined : category,
      tag,
      cookTimeMax,
      limit,
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.recipes.length < limit) return undefined;
        return allPages.length * limit;
      },
      staleTime: 30000,
    }
  );

  const recipes = useMemo(() => {
    return result.data?.pages.flatMap(page => page.recipes) ?? [];
  }, [result.data]);

  const total = useMemo(() => {
    return result.data?.pages.reduce((sum, page) => sum + page.total, 0) ?? 0;
  }, [result.data]);

  return {
    recipes,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
  };
}
