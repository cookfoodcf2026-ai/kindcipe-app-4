import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MealPlanQuestionnaireProps {
  step: 'people' | 'audience' | 'time' | 'dislike';
  stepNumber: number;
  onAnswer: (text: string) => void;
  onSkip: () => void;
  options?: Array<{ key: string; label: string }>;
  onOptionSelect?: (key: string) => void;
}

const BRAND = '#013E77';

export function MealPlanQuestionnaire({
  step,
  stepNumber,
  onAnswer,
  onSkip,
  options,
  onOptionSelect,
}: MealPlanQuestionnaireProps) {
  const getQuestion = () => {
    switch (step) {
      case 'people':
        return '今晚幾多人食？';
      case 'audience':
        return '有冇小朋友或老人家？';
      case 'time':
        return '想幾耐煮好？';
      case 'dislike':
        return '有咩唔食？';
      default:
        return '';
    }
  };

  const getPlaceholder = () => {
    switch (step) {
      case 'people':
        return '例如：4';
      case 'audience':
        return '例如：有小朋友';
      case 'time':
        return '例如：30 分鐘';
      case 'dislike':
        return '例如：唔食辣';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepTxt}>（步驟 {stepNumber}/4）</Text>
        <Text style={styles.questionTxt}>{getQuestion()}</Text>
      </View>

      {options && onOptionSelect && (
        <View style={styles.optionsContainer}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.optionChip}
              onPress={() => onOptionSelect(opt.key)}
            >
              <Text style={styles.optionTxt}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.inputHint}>
        <Text style={styles.hintTxt}>{getPlaceholder()}</Text>
      </View>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Ionicons name="play-skip-forward-outline" size={18} color={BRAND} />
        <Text style={styles.skipTxt}>跳過所有問題</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
  header: {
    marginBottom: 12,
  },
  stepTxt: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  questionTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionTxt: {
    fontSize: 13,
    color: '#111827',
  },
  inputHint: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  hintTxt: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  skipTxt: {
    fontSize: 13,
    color: BRAND,
    fontWeight: '500',
  },
});
