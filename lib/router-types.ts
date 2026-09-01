/**
 * Kindcipe Backend API Contract
 * 
 * This file defines the complete API contract between frontend and backend.
 * It is derived from actual app usage to ensure type safety without requiring
 * the backend sibling repo for standalone frontend typechecking.
 * 
 * For production use, these types should be auto-generated from the backend schema
 * or published as a shared @kindcipe/contracts package to prevent API drift.
 * 
 * Last updated: 2026-08-28
 * Based on: Actual tRPC usage scan across app/ directory
 */

// ============================================================================
// AppRouter - Root Contract
// ============================================================================

export interface AppRouter {
  auth: AuthRouter;
  family: FamilyRouter;
  mealPlan: MealPlanRouter;
  pantry: PantryRouter;
  shopping: ShoppingRouter;
  recipes: RecipesRouter;
  aiRecipe: AiRecipeRouter;
  weeklyMenu: WeeklyMenuRouter;
  eatOut: EatOutRouter;
  recipeNotes: RecipeNotesRouter;
  priceWatch: PriceWatchRouter;
  purchaseHistory: PurchaseHistoryRouter;
  commonIngredient: CommonIngredientRouter;
}

// ============================================================================
// Auth Router
// ============================================================================

export interface AuthRouter {
  me: { input: void; output: UserProfile };
  logout: { input: void; output: void };
  emailLogin: { input: EmailLoginInput; output: AuthOutput };
  emailRegister: { input: EmailRegisterInput; output: AuthOutput };
}

export interface EmailLoginInput {
  email: string;
  password: string;
}

export interface EmailRegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface AuthOutput {
  user: UserProfile;
  token: string;
}

// ============================================================================
// Family Router
// ============================================================================

export interface FamilyRouter {
  create: { input: CreateFamilyInput; output: Family };
  get: { input: void; output: Family | null };
  list: { input: void; output: Family[] };
  join: { input: JoinFamilyInput; output: Family };
  leave: { input: void; output: void };
  removeMember: { input: RemoveFamilyMemberInput; output: void };
  rename: { input: RenameFamilyInput; output: Family };
  subscription: { input: void; output: FamilySubscription | null };
  usage: { input: void; output: FamilyUsageSummary | null };
  usageHistory: { input: UsageHistoryInput | undefined; output: FamilyUsageHistoryRow[] };
  usageHistoryByMember: { input: UsageHistoryInput | undefined; output: FamilyUsageHistoryMonthRow[] };
  usageByMember: { input: void; output: FamilyUsageMemberRow[] };
  transferOwnership: { input: TransferOwnershipInput; output: Family };
  updateMemberRole: { input: UpdateMemberRoleInput; output: void };
  updateSettings: { input: UpdateFamilySettingsInput; output: Family };
  dissolve: { input: void; output: void };
}

export interface CreateFamilyInput {
  name: string;
}

export interface JoinFamilyInput {
  code: string;
}

export interface RemoveFamilyMemberInput {
  memberId: string;
}

export interface RenameFamilyInput {
  name: string;
}

export interface TransferOwnershipInput {
  newOwnerId: string;
}

export interface UpdateMemberRoleInput {
  memberId: string;
  role: 'owner' | 'admin' | 'member';
}

export interface UpdateFamilySettingsInput {
  settings: FamilySettings;
}

export interface Family {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  members: FamilyMember[];
  settings: FamilySettings;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  familyId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user?: UserProfile;
}

export interface FamilySettings {
  maxMembers?: number;
  allowMealPlanSharing?: boolean;
  allowShoppingListSharing?: boolean;
  [key: string]: any;
}

export interface FamilySubscription {
  id: string;
  familyId: string;
  plan: 'free' | 'premium' | 'family';
  status: 'active' | 'cancelled' | 'expired';
  expiresAt?: string;
}

export interface FamilyUsageSummary {
  imports: { used: number; limit: number };
  customRecipes: { used: number; limit: number | null };
  aiChat: { used: number; limit: number };
}

export interface UsageHistoryInput {
  months?: number;
}

export interface FamilyUsageHistoryRow {
  yearMonth: string;
  imports: number;
  aiChat: number;
}

export interface FamilyUsageHistoryMonthRow extends FamilyUsageHistoryRow {
  members: FamilyUsageMemberRow[];
}

export interface FamilyUsageMemberRow {
  userId: string;
  name: string;
  familyRole: 'owner' | 'admin' | 'helper' | 'member';
  imports: number;
  aiChat: number;
}

// ============================================================================
// MealPlan Router
// ============================================================================

export interface MealPlanRouter {
  add: { input: AddMealPlanInput; output: MealPlan };
  addBatch: { input: AddMealPlanBatchInput; output: MealPlan[] };
  confirm: { input: ConfirmMealPlanInput; output: MealPlan };
  delete: { input: DeleteMealPlanInput; output: void };
  list: { input: void; output: MealPlan[] };
  listByDateRange: { input: ListMealPlanByDateInput; output: MealPlan[] };
  reject: { input: RejectMealPlanInput; output: void };
  updateDate: { input: UpdateMealPlanDateInput; output: MealPlan };
}

export interface AddMealPlanInput {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipeId: string;
  servings?: number;
}

export interface AddMealPlanBatchInput {
  meals: AddMealPlanInput[];
}

export interface ConfirmMealPlanInput {
  id: string;
}

export interface DeleteMealPlanInput {
  id: string;
}

export interface ListMealPlanByDateInput {
  startDate: string;
  endDate: string;
}

export interface RejectMealPlanInput {
  id: string;
}

export interface UpdateMealPlanDateInput {
  id: string;
  newDate: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  familyId?: string;
  recipeId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  confirmed: boolean;
  recipe?: Recipe;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Pantry Router
// ============================================================================

export interface PantryRouter {
  list: { input: void; output: PantryItem[] };
  add: { input: AddPantryItemInput; output: PantryItem };
  addFromShopping: { input: AddFromShoppingInput; output: PantryItem };
  delete: { input: DeletePantryItemInput; output: void };
  toggleInStock: { input: TogglePantryInStockInput; output: PantryItem };
  toggleLow: { input: TogglePantryLowInput; output: PantryItem };
}

export interface AddPantryItemInput {
  name: string;
  quantity?: number;
  unit?: string;
  location?: string;
  expiryDate?: string;
}

export interface AddFromShoppingInput {
  shoppingItemId: string;
}

export interface DeletePantryItemInput {
  id: string;
}

export interface TogglePantryInStockInput {
  id: string;
}

export interface TogglePantryLowInput {
  id: string;
}

export interface PantryItem {
  id: string;
  userId: string;
  familyId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  location?: string;
  expiryDate?: string;
  inStock: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Shopping Router
// ============================================================================

export interface ShoppingRouter {
  list: { input: void; output: ShoppingListItem[] };
  add: { input: AddShoppingItemInput; output: ShoppingListItem };
  addBatch: { input: AddShoppingItemBatchInput; output: ShoppingListItem[] };
  approve: { input: ApproveShoppingItemInput; output: ShoppingListItem };
  delete: { input: DeleteShoppingItemInput; output: void };
  reject: { input: RejectShoppingItemInput; output: void };
  toggleBought: { input: ToggleShoppingBoughtInput; output: ShoppingListItem };
  updateItem: { input: UpdateShoppingItemInput; output: ShoppingListItem };
}

export interface AddShoppingItemInput {
  name: string;
  quantity?: number;
  unit?: string;
  recipeId?: string;
  notes?: string;
}

export interface AddShoppingItemBatchInput {
  items: AddShoppingItemInput[];
}

export interface ApproveShoppingItemInput {
  id: string;
}

export interface DeleteShoppingItemInput {
  id: string;
}

export interface RejectShoppingItemInput {
  id: string;
}

export interface ToggleShoppingBoughtInput {
  id: string;
}

export interface UpdateShoppingItemInput {
  id: string;
  name?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

export interface ShoppingListItem {
  id: string;
  userId: string;
  familyId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  bought: boolean;
  approved: boolean;
  rejected: boolean;
  recipeId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Recipes Router
// ============================================================================

export interface RecipesRouter {
  getById: { input: GetRecipeByIdInput; output: Recipe };
  listOfficial: { input: ListRecipesInput; output: Recipe[] };
  listUser: { input: ListRecipesInput; output: Recipe[] };
  search: { input: SearchRecipesInput; output: Recipe[] };
  importUser: { input: ImportRecipeInput; output: Recipe };
  createBlank: { input: CreateBlankRecipeInput; output: Recipe };
  updateUser: { input: UpdateRecipeInput; output: Recipe };
  deleteRecipeImage: { input: DeleteRecipeImageInput; output: void };
  deleteUser: { input: DeleteRecipeInput; output: void };
  deleteOfficial: { input: DeleteRecipeInput; output: void };
  parseUrl: { input: ParseUrlInput; output: ParsedRecipe };
  parseText: { input: ParseTextInput; output: ParsedRecipe };
  parseImage: { input: ParseImageInput; output: ParsedRecipe };
  uploadRecipeImage: { input: UploadRecipeImageInput; output: RecipeImageUrl };
  getDraft: { input: GetDraftInput; output: Recipe | null };
  adminListPending: { input: void; output: Recipe[] };
  adminApprove: { input: AdminApproveInput; output: Recipe };
  adminReject: { input: AdminRejectInput; output: void };
  adminCreateOfficial: { input: CreateOfficialRecipeInput; output: Recipe };
  adminUpdateOfficial: { input: UpdateRecipeInput; output: Recipe };
}

export interface GetRecipeByIdInput {
  id: string;
}

export interface ListRecipesInput {
  limit?: number;
  offset?: number;
  search?: string;
  cuisine?: string;
  difficulty?: string;
  tags?: string[];
}

export interface SearchRecipesInput {
  query: string;
  limit?: number;
  tags?: string[];
  cuisine?: string;
}

export interface ImportRecipeInput {
  name: string;
  description?: string;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  sourceUrl?: string;
}

export interface CreateBlankRecipeInput {
  name: string;
}

export interface UpdateRecipeInput {
  id: string;
  name?: string;
  description?: string;
  ingredients?: RecipeIngredientInput[];
  steps?: RecipeStepInput[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface DeleteRecipeImageInput {
  recipeId: string;
  imageUrl: string;
}

export interface DeleteRecipeInput {
  id: string;
}

export interface ParseUrlInput {
  url: string;
}

export interface ParseTextInput {
  text: string;
}

export interface ParseImageInput {
  imageUrl: string;
}

export interface UploadRecipeImageInput {
  recipeId: string;
  imageData: string;
}

export interface GetDraftInput {
  recipeId: string;
}

export interface AdminApproveInput {
  recipeId: string;
}

export interface AdminRejectInput {
  recipeId: string;
  reason?: string;
}

export interface CreateOfficialRecipeInput {
  name: string;
  description?: string;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  images?: string[];
  sourceUrl?: string;
  isOfficial: boolean;
  isFavorite: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

export interface RecipeIngredientInput {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  notes?: string;
  imageUrl?: string;
}

export interface RecipeStepInput {
  stepNumber: number;
  instruction: string;
  notes?: string;
  imageUrl?: string;
}

export interface ParsedRecipe {
  name?: string;
  description?: string;
  ingredients?: RecipeIngredientInput[];
  steps?: RecipeStepInput[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  imageUrl?: string;
  sourceUrl?: string;
}

export interface RecipeImageUrl {
  recipeId: string;
  imageUrl: string;
}

// ============================================================================
// AI Recipe Router
// ============================================================================

export interface AiRecipeRouter {
  chat: { input: AiRecipeChatInput; output: AiRecipeChatOutput };
  previewEdit: { input: AiRecipePreviewEditInput; output: AiRecipeEditPreview };
  saveEditedRecipe: { input: SaveEditedRecipeInput; output: Recipe };
}

export interface AiRecipeChatInput {
  prompt: string;
  ingredients?: string[];
  dietaryRestrictions?: string[];
  maxTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
  pantryItems?: string[];
  shoppingItems?: string[];
  mealPlanHistory?: MealPlan[];
}

export interface AiRecipeChatOutput {
  recipes: AiRecipeRecipe[];
  generatedAt: string;
  prompt: string;
}

export interface AiRecipePreviewEditInput {
  recipeId: string;
  changes: {
    name?: string;
    ingredients?: RecipeIngredientInput[];
    steps?: RecipeStepInput[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
  };
}

export interface AiRecipeEditPreview {
  originalRecipe: Recipe;
  editedRecipe: Recipe;
  changes: string[];
}

export interface SaveEditedRecipeInput {
  recipeId: string;
  editedRecipe: ImportRecipeInput;
}

export interface AiRecipeRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// ============================================================================
// Weekly Menu Router
// ============================================================================

export interface WeeklyMenuRouter {
  getWeek: { input: GetWeekInput; output: WeeklyMenu };
  setDay: { input: SetWeekDayInput; output: WeeklyMenuDay };
  aiSuggest: { input: AiSuggestWeekInput; output: WeeklyMenuSuggestion };
}

export interface GetWeekInput {
  weekStart: string;
}

export interface SetWeekDayInput {
  weekStart: string;
  dayOfWeek: number;
  recipeId: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
}

export interface AiSuggestWeekInput {
  weekStart: string;
  preferences?: string[];
  dietaryRestrictions?: string[];
  maxBudget?: number;
}

export interface WeeklyMenu {
  weekStart: string;
  days: WeeklyMenuDay[];
  userId: string;
  familyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyMenuDay {
  weekStart: string;
  dayOfWeek: number;
  recipeId?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
  recipe?: Recipe;
}

export interface WeeklyMenuSuggestion {
  weekStart: string;
  days: WeeklyMenuSuggestionDay[];
  totalCost?: number;
}

export interface WeeklyMenuSuggestionDay {
  dayOfWeek: number;
  recipeId: string;
  recipe?: Recipe;
  reason?: string;
}

// ============================================================================
// Eat Out Router
// ============================================================================

export interface EatOutRouter {
  listByDateRange: { input: ListEatOutByDateInput; output: EatOutDate[] };
  set: { input: SetEatOutInput; output: EatOutDate };
}

export interface ListEatOutByDateInput {
  startDate: string;
  endDate: string;
}

export interface SetEatOutInput {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
}

export interface EatOutDate {
  id: string;
  userId: string;
  familyId?: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  createdAt: string;
}

// ============================================================================
// Recipe Notes Router
// ============================================================================

export interface RecipeNotesRouter {
  list: { input: ListRecipeNotesInput; output: RecipeNote[] };
  add: { input: AddRecipeNoteInput; output: RecipeNote };
  delete: { input: DeleteRecipeNoteInput; output: void };
}

export interface ListRecipeNotesInput {
  recipeId: string;
}

export interface AddRecipeNoteInput {
  recipeId: string;
  note: string;
  isPrivate?: boolean;
}

export interface DeleteRecipeNoteInput {
  id: string;
}

export interface RecipeNote {
  id: string;
  recipeId: string;
  userId: string;
  note: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Price Watch Router
// ============================================================================

export interface PriceWatchRouter {
  search: { input: SearchPriceWatchInput; output: PriceWatchItem[] };
}

export interface SearchPriceWatchInput {
  itemName?: string;
  marketId?: string;
  limit?: number;
}

export interface PriceWatchItem {
  id: string;
  itemName: string;
  marketId: string;
  marketName: string;
  price: number;
  unit: string;
  date: string;
}

// ============================================================================
// Purchase History Router
// ============================================================================

export interface PurchaseHistoryRouter {
  list: { input: void; output: any[] };
  frequency: { input: GetPurchaseFrequencyInput; output: PurchaseFrequency[] };
  update: { input: UpdatePurchaseHistoryInput; output: any };
}

export interface UpdatePurchaseHistoryInput {
  id: string;
  actualPrice?: number | null;
  quantity?: string | null;
}

export interface GetPurchaseFrequencyInput {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface PurchaseFrequency {
  itemName: string;
  count: number;
  lastPurchased: string;
  averagePrice?: number;
}

// ============================================================================
// Common Ingredient Router
// ============================================================================

export interface CommonIngredientRouter {
  list: { input: void; output: CommonIngredient[] };
}

export interface CommonIngredient {
  id: string;
  name: string;
  category: string;
  synonyms: string[];
}

// ============================================================================
// Shared Types
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
