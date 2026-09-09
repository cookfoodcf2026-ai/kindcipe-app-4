import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoadingIndicatorProps {
  step: number;
  isLibrary?: boolean;
}

const BRAND = '#013E77';
const SUB = '#6B7280';

const LOADING_STEPS = [
  'AI 正在分析你的需求...',
  '從食譜庫尋找合適建議...',
  '為你整理個人化結果...',
];

export function LoadingIndicator({ step, isLibrary = false }: LoadingIndicatorProps) {
  const currentStep = Math.min(step, LOADING_STEPS.length - 1);
  const message = isLibrary ? '🔍 正在搵食譜庫...' : LOADING_STEPS[currentStep];

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        {isLibrary ? (
          <Ionicons name="search" size={16} color={BRAND} />
        ) : (
          <Ionicons name="sparkles" size={16} color={BRAND} />
        )}
      </View>
      <View style={[styles.bubble, isLibrary && styles.bubbleLibrary]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={BRAND} />
          <Text style={[styles.loadingTxt, isLibrary && styles.loadingTxtLibrary]}>
            {message}
          </Text>
        </View>
        {!isLibrary && step < LOADING_STEPS.length - 1 && (
          <Text style={styles.progressTxt}>
            約 {Math.max(1, 6 - step * 2)} 秒
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  bubble: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '75%',
  },
  bubbleLibrary: {
    backgroundColor: '#F0F9FF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  loadingTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND,
  },
  loadingTxtLibrary: {
    color: '#0369A1',
  },
  progressTxt: {
    fontSize: 12,
    color: SUB,
  },
});
