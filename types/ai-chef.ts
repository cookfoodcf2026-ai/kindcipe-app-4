export type MsgContent = string | Array<
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
>;

export type Message = { 
  role: "user" | "assistant"; 
  content: MsgContent; 
};

export type BackendMessage = { 
  role: "user" | "assistant"; 
  content: MsgContent; 
};

export type AIRecipe = {
  name: string;
  description: string;
  cookTime: number;
  servings: number;
  difficulty: string;
  recipeCategory?: string;
  ingredients: { name: string; quantity: string; unit: string; category?: string }[];
  steps: string[];
  tags: string[];
  source?: "official" | "custom" | "ai";
  officialId?: number;
  customId?: number;
};
