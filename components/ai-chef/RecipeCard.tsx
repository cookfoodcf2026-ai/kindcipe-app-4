import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIRecipe } from '@/types/ai-chef';

interface RecipeCardProps {
  recipe: AIRecipe;
  index: number;
  onAddToPlan?: (recipe: AIRecipe) => void;
  onAddToCart?: (recipe: AIRecipe) => void;
  onFavorite?: (recipe: AIRecipe) => void;
  onSwap?: (index: number) => void;
}

const BRAND = '#013E77';
const SUB = '#6B7280';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';

export function RecipeCard({
  recipe,
  index,
  onAddToPlan,
  onAddToCart,
  onFavorite,
  onSwap,
}: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const sourceColor = recipe.source === 'ai' ? '#7C3AED' : BRAND;
  const sourceLabel = recipe.source === 'ai' ? 'AI' : recipe.source === 'official' ? '官方' : '自訂';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Ionicons name="restaurant-outline" size={14} color={BRAND} />
          <Text style={styles.cardCategory}>{recipe.recipeCategory || '其他'}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardDiff}>{recipe.difficulty}</Text>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20' }]}>
          <Text style={[styles.sourceTxt, { color: sourceColor }]}>{sourceLabel}</Text>
        </View>
      </View>

      <Text style={styles.cardName} numberOfLines={2}>
        {recipe.name}
      </Text>

      <View style={styles.cardStats}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={12} color={SUB} />
          <Text style={styles.statTxt}>{recipe.cookTime}分鐘</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={12} color={SUB} />
          <Text style={styles.statTxt}>{recipe.servings}人</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛒 食材</Text>
            {recipe.ingredients.slice(0, 5).map((ing, i) => (
              <Text key={i} style={styles.ingItem}>
                {ing.name} {ing.quantity}
                {ing.unit}
              </Text>
            ))}
            {recipe.ingredients.length > 5 && (
              <Text style={styles.moreTxt}>仲有 {recipe.ingredients.length - 5} 項食材...</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍳 步驟</Text>
            {recipe.steps.slice(0, 3).map((step, i) => (
              <Text key={i} style={styles.stepItem}>
                {i + 1}. {step}
              </Text>
            ))}
            {recipe.steps.length > 3 && (
              <Text style={styles.moreTxt}>仲有 {recipe.steps.length - 3} 個步驟...</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onAddToPlan?.(recipe)}
          disabled={!onAddToPlan}
        >
          <Ionicons name="calendar-outline" size={18} color={BRAND} />
          <Text style={styles.actionTxt}>排餐</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onAddToCart?.(recipe)}
          disabled={!onAddToCart}
        >
          <Ionicons name="cart-outline" size={18} color={SUCCESS} />
          <Text style={styles.actionTxt}>購物車</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onFavorite?.(recipe)}
          disabled={!onFavorite}
        >
          <Ionicons name="heart-outline" size={18} color={WARNING} />
          <Text style={styles.actionTxt}>收藏</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setExpanded(!expanded)}
        >
          <Ionicons
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={18}
            color={SUB}
          />
          <Text style={styles.actionTxt}>{expanded ? '收起' : '食材'}</Text>
        </TouchableOpacity>

        {onSwap && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onSwap(index)}>
            <Ionicons name="refresh-outline" size={18} color={SUB} />
            <Text style={styles.actionTxt}>換</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardCategory: {
    fontSize: 12,
    color: SUB,
  },
  cardDot: {
    fontSize: 12,
    color: SUB,
  },
  cardDiff: {
    fontSize: 12,
    color: SUB,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceTxt: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statTxt: {
    fontSize: 12,
    color: SUB,
  },
  expandedContent: {
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ingItem: {
    fontSize: 12,
    color: SUB,
    marginBottom: 2,
  },
  stepItem: {
    fontSize: 12,
    color: SUB,
    marginBottom: 4,
    lineHeight: 18,
  },
  moreTxt: {
    fontSize: 11,
    color: SUB,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  actionTxt: {
    fontSize: 11,
    color: SUB,
  },
});
