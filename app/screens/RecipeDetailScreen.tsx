import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Pressable,
} from 'react-native';
import { Icon } from '../components/Icon';
import { colors } from '../styles/colors';
import { theme } from '../styles/theme';
import { typography } from '../styles/typography';

interface Recipe {
  id: string;
  title: string;
  description: string;
  image: string;
  cookingTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  ingredients: {
    category: string;
    items: {
      name: string;
      quantity: number;
      unit: string;
    }[];
  }[];
  steps: {
    number: number;
    description: string;
    time: number;
    tip?: string;
  }[];
  tags: string[];
  remarks?: string;
}

interface RecipeDetailScreenProps {
  recipe: Recipe;
  onSaveRemarks?: (remarks: string) => void;
  onAddToMealPlan?: () => void;
  onAddToShoppingList?: () => void;
}

export const RecipeDetailScreen: React.FC<RecipeDetailScreenProps> = ({
  recipe,
  onSaveRemarks,
  onAddToMealPlan,
  onAddToShoppingList,
}) => {
  const [servings, setServings] = useState(recipe.servings);
  const [remarks, setRemarks] = useState(recipe.remarks || '');
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [expandedIngredients, setExpandedIngredients] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState(true);

  const handleSaveRemarks = () => {
    onSaveRemarks?.(remarks);
    setIsEditingRemarks(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return colors.status.success;
      case 'medium':
        return colors.primary.copper;
      case 'hard':
        return colors.status.error;
      default:
        return colors.primary.navy;
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '簡單';
      case 'medium':
        return '中等';
      case 'hard':
        return '困難';
      default:
        return difficulty;
    }
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: colors.primary.cream,
      }}
    >
      {/* 頂部區域 - 食譜圖片 */}
      <View
        style={{
          position: 'relative',
          width: '100%',
          height: 300,
          backgroundColor: colors.neutral.lightGray,
        }}
      >
        <Image
          source={{ uri: recipe.image }}
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
          }}
        />

        {/* 浮動按鈕 - 返回、收藏、分享 */}
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.lg,
            left: theme.spacing.lg,
            right: theme.spacing.lg,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon name="home" size={20} color={colors.primary.navy} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <TouchableOpacity
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon name="favorites" size={20} color={colors.primary.navy} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon name="share-recipe" size={20} color={colors.primary.navy} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 食譜名稱和描述 */}
      <View style={{ padding: theme.spacing.lg, backgroundColor: colors.primary.cream }}>
        <Text
          style={{
            ...typography.h2,
            color: colors.primary.navy,
            marginBottom: theme.spacing.md,
          }}
        >
          {recipe.title}
        </Text>

        <Text
          style={{
            ...typography.body,
            color: colors.neutral.mediumGray,
            marginBottom: theme.spacing.lg,
          }}
        >
          {recipe.description}
        </Text>

        {/* 烹飪時間和難度等級 */}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.borderRadius.full,
              backgroundColor: colors.neutral.lightGray,
            }}
          >
            <Icon name="cooking-time" size={16} color={colors.primary.navy} />
            <Text
              style={{
                ...typography.bodySmall,
                color: colors.primary.navy,
              }}
            >
              {recipe.cookingTime} 分鐘
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.borderRadius.full,
              backgroundColor: colors.neutral.lightGray,
            }}
          >
            <Icon name="difficulty" size={16} color={getDifficultyColor(recipe.difficulty)} />
            <Text
              style={{
                ...typography.bodySmall,
                color: getDifficultyColor(recipe.difficulty),
              }}
            >
              {getDifficultyLabel(recipe.difficulty)}
            </Text>
          </View>
        </View>
      </View>

      {/* 份量調整 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.primary.cream,
        }}
      >
        <Text
          style={{
            ...typography.h3,
            color: colors.primary.navy,
            marginBottom: theme.spacing.md,
          }}
        >
          份量調整
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor: colors.neutral.white,
            borderWidth: 1,
            borderColor: colors.neutral.lightGray,
          }}
        >
          <Text
            style={{
              ...typography.body,
              color: colors.neutral.mediumGray,
            }}
          >
            食材用量自動換算
          </Text>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={() => setServings(Math.max(1, servings - 1))}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.primary.navy,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 20,
                color: colors.primary.navy,
                fontWeight: 'bold',
              }}
            >
              −
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              ...typography.h3,
              color: colors.primary.navy,
              minWidth: 40,
              textAlign: 'center',
            }}
          >
            {servings}
          </Text>

          <TouchableOpacity
            onPress={() => setServings(servings + 1)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.primary.navy,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 20,
                color: colors.primary.navy,
                fontWeight: 'bold',
              }}
            >
              +
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              ...typography.body,
              color: colors.neutral.mediumGray,
            }}
          >
            人份
          </Text>
        </View>
      </View>

      {/* 食材清單 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.primary.cream,
        }}
      >
        <Pressable
          onPress={() => setExpandedIngredients(!expandedIngredients)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="ingredients" size={20} color={colors.primary.navy} />
            <Text
              style={{
                ...typography.h3,
                color: colors.primary.navy,
              }}
            >
              食材清單 ({recipe.ingredients.reduce((acc, cat) => acc + cat.items.length, 0)} 項)
            </Text>
          </View>
          <Icon
            name={expandedIngredients ? 'cooking-steps' : 'import-recipe'}
            size={20}
            color={colors.primary.navy}
          />
        </Pressable>

        {expandedIngredients && (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.neutral.white,
              borderWidth: 1,
              borderColor: colors.neutral.lightGray,
            }}
          >
            {recipe.ingredients.map((category, categoryIndex) => (
              <View key={categoryIndex} style={{ marginBottom: theme.spacing.lg }}>
                <Text
                  style={{
                    ...typography.bodySmall,
                    color: colors.primary.copper,
                    fontWeight: '600',
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  {category.category}
                </Text>

                {category.items.map((item, itemIndex) => (
                  <View
                    key={itemIndex}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: theme.spacing.sm,
                      borderBottomWidth: itemIndex < category.items.length - 1 ? 1 : 0,
                      borderBottomColor: colors.neutral.lightGray,
                    }}
                  >
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.primary.navy,
                        flex: 1,
                      }}
                    >
                      {item.name}
                    </Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.body,
                          color: colors.primary.copper,
                          fontWeight: '600',
                        }}
                      >
                        {(item.quantity * servings) / recipe.servings}
                      </Text>
                      <Text
                        style={{
                          ...typography.bodySmall,
                          color: colors.neutral.mediumGray,
                        }}
                      >
                        {item.unit}
                      </Text>
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: theme.spacing.sm,
                          paddingVertical: theme.spacing.xs,
                          borderRadius: theme.borderRadius.md,
                          backgroundColor: colors.neutral.lightGray,
                        }}
                      >
                        <Text
                          style={{
                            ...typography.caption,
                            color: colors.primary.navy,
                          }}
                        >
                          比價
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* 食材清單按鈕 */}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              borderWidth: 2,
              borderColor: colors.primary.navy,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon name="ingredients" size={20} color={colors.primary.navy} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAddToMealPlan}
            style={{
              flex: 4,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.primary.navy,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.md,
            }}
          >
            <Icon name="planner" size={20} color={colors.neutral.white} />
            <Text
              style={{
                ...typography.body,
                color: colors.neutral.white,
                fontWeight: '600',
              }}
            >
              加入排餐
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAddToShoppingList}
            style={{
              flex: 1,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.primary.navy,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon name="shopping" size={20} color={colors.neutral.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 烹飪步驟 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.primary.cream,
        }}
      >
        <Pressable
          onPress={() => setExpandedSteps(!expandedSteps)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="cooking-steps" size={20} color={colors.primary.navy} />
            <Text
              style={{
                ...typography.h3,
                color: colors.primary.navy,
              }}
            >
              烹飪步驟 ({recipe.steps.length} 步)
            </Text>
          </View>
          <Icon
            name={expandedSteps ? 'cooking-steps' : 'import-recipe'}
            size={20}
            color={colors.primary.navy}
          />
        </Pressable>

        {expandedSteps && (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.neutral.white,
              borderWidth: 1,
              borderColor: colors.neutral.lightGray,
            }}
          >
            {recipe.steps.map((step, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: index < recipe.steps.length - 1 ? 1 : 0,
                  borderBottomColor: colors.neutral.lightGray,
                }}
              >
                {/* 步驟編號 */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary.navy,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.neutral.white,
                      fontWeight: 'bold',
                    }}
                  >
                    {step.number}
                  </Text>
                </View>

                {/* 步驟內容 */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.primary.navy,
                      marginBottom: theme.spacing.sm,
                    }}
                  >
                    {step.description}
                  </Text>

                  {/* 時間提示 */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.xs,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: colors.neutral.lightGray,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Icon name="cooking-time" size={14} color={colors.primary.navy} />
                    <Text
                      style={{
                        ...typography.caption,
                        color: colors.primary.navy,
                      }}
                    >
                      {step.time} 分鐘 · 開始計時
                    </Text>
                  </View>

                  {/* 小貼士 */}
                  {step.tip && (
                    <View
                      style={{
                        marginTop: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        borderRadius: theme.borderRadius.md,
                        backgroundColor: '#FFF0D6',
                        borderLeftWidth: 3,
                        borderLeftColor: colors.primary.copper,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.caption,
                          color: colors.primary.copper,
                        }}
                      >
                        💡 {step.tip}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 加入排餐按鈕 */}
        <TouchableOpacity
          onPress={onAddToMealPlan}
          style={{
            marginTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            backgroundColor: colors.primary.navy,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.md,
          }}
        >
          <Icon name="planner" size={20} color={colors.neutral.white} />
          <Text
            style={{
              ...typography.body,
              color: colors.neutral.white,
              fontWeight: '600',
            }}
          >
            加入排餐
          </Text>
        </TouchableOpacity>
      </View>

      {/* 標籤 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.primary.cream,
        }}
      >
        <Text
          style={{
            ...typography.h3,
            color: colors.primary.navy,
            marginBottom: theme.spacing.md,
          }}
        >
          標籤
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {recipe.tags.map((tag, index) => (
            <View
              key={index}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.borderRadius.full,
                borderWidth: 1,
                borderColor: colors.primary.navy,
              }}
            >
              <Text
                style={{
                  ...typography.bodySmall,
                  color: colors.primary.navy,
                }}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 備註 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: colors.primary.cream,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.md,
          }}
        >
          <Text
            style={{
              ...typography.h3,
              color: colors.primary.navy,
            }}
          >
            備註
          </Text>

          {!isEditingRemarks && (
            <TouchableOpacity onPress={() => setIsEditingRemarks(true)}>
              <Icon name="import-recipe" size={20} color={colors.primary.navy} />
            </TouchableOpacity>
          )}
        </View>

        {isEditingRemarks ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.neutral.white,
              borderWidth: 1,
              borderColor: colors.neutral.lightGray,
            }}
          >
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="輸入你的筆記..."
              placeholderTextColor={colors.neutral.mediumGray}
              multiline
              numberOfLines={4}
              style={{
                ...typography.body,
                color: colors.primary.navy,
                marginBottom: theme.spacing.md,
              }}
            />

            <TouchableOpacity
              onPress={handleSaveRemarks}
              style={{
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                backgroundColor: colors.primary.navy,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.body,
                  color: colors.neutral.white,
                  fontWeight: '600',
                }}
              >
                保存備註
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.borderRadius.md,
              backgroundColor: colors.neutral.lightGray,
              minHeight: 60,
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                ...typography.body,
                color: remarks ? colors.primary.navy : colors.neutral.mediumGray,
              }}
            >
              {remarks || '暫無備註'}
            </Text>
          </View>
        )}
      </View>

      {/* 底部間距 */}
      <View style={{ height: theme.spacing.xxl }} />
    </ScrollView>
  );
};

export default function RecipeDetailRoute() { return null; }
