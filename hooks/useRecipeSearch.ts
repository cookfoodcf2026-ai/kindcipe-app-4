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
    limit = 500,
  } = options;

  const result = trpc.recipes.listOfficial.useQuery(
    {
      limit,
      offset: 0,
    },
    {
      staleTime: 30000,
    }
  );

  const recipes = useMemo(() => {
    const allRecipes = result.data ?? [];
    
    // Apply filters client-side
    let filtered = allRecipes;
    
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    
    if (category && category !== "all") {
      filtered = filtered.filter(r => r.recipeCategory === category);
    }
    
    if (tag) {
      filtered = filtered.filter(r => r.tags?.includes(tag));
    }
    
    if (cookTimeMax) {
      filtered = filtered.filter(r => r.cookTime && r.cookTime <= cookTimeMax);
    }
    
    return filtered;
  }, [result.data, query, category, tag, cookTimeMax]);

  const total = useMemo(() => {
    return recipes.length;
  }, [recipes]);

  return {
    recipes,
    total,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    refetch: result.refetch,
  };
}
