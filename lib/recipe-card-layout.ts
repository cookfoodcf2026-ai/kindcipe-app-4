export function getRecipeCardImageRatio(screenHeight: number) {
  if (screenHeight < 700) return 0.6;
  if (screenHeight < 870) return 0.65;
  return 0.72;
}
