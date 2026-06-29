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

  const result = trpc.recipes.search.useQuery(
    {
      query: query || undefined,
      category: category === "all" ? undefined : category,
      tag,
      cookTimeMax,
      limit,
      offset: 0,
    },
    {
      staleTime: 30000,
    }
  );

  const recipes = useMemo(() => {
    return result.data?.recipes ?? [];
  }, [result.data]);

  const total = useMemo(() => {
    return result.data?.total ?? 0;
  }, [result.data]);

  return {
    recipes,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    refetch: result.refetch,
    // Infinite scroll not yet implemented - using simple query for now
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: () => {},
  };
}
