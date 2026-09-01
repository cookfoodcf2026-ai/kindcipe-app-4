# Kindcipe Core 10 Scenarios

Use these first. If any of these fail, stop and file a bug before trying the full 100-scenario sweep.

## Reporting Format
- Scenario ID
- Steps
- Expected
- Actual
- Severity: P0, P1, P2, P3
- Screenshot or screen recording

## Scenarios

### 1. Email Login
- Open app
- Enter valid email/password
- Tap login
- Expected: user lands in home flow without error

### 2. Biometric Prompt Handling
- Complete login
- If biometric prompt appears, skip it
- If it does not appear, app should continue normally
- Expected: no dead end, no crash

### 3. AI Chef Prompt Generation
- Open AI Chef
- Enter a Chinese prompt for a quick recipe
- Send
- Expected: recipe cards appear within timeout

### 4. Recipe Card Render
- Inspect the first generated recipe card
- Expected: name, ingredients, steps count, first step, favorite button all visible

### 5. Add to Meal Plan
- From AI Chef or recipe detail, add a recipe to meal plan
- Expected: meal plan updates and item persists after refresh

### 6. Add to Shopping List
- Add recipe ingredients or a manual item to shopping
- Expected: shopping list updates immediately

### 7. Toggle Bought
- Mark a shopping item as bought, then un-bought
- Expected: state updates correctly and remains stable after reopen

### 8. Family Create/Join
- Create a family or join with a valid code
- Expected: family state loads and shared features work

### 9. Pantry Add / Add From Shopping
- Add pantry item manually
- Add one from shopping if available
- Expected: pantry reflects both actions correctly

### 10. Cold Relaunch / Deep Link
- Kill app
- Relaunch, and deep link into AI Chef if supported
- Expected: app restores state and deep link opens correct screen

## Stop Conditions
- Any crash
- Login failure
- AI Chef returns empty or malformed result
- Recipe card missing steps or ingredients
- Shopping / meal plan action does not persist
