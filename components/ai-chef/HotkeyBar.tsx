import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HotkeyAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

interface HotkeyBarProps {
  actions: HotkeyAction[];
  onActionPress: (id: string) => void;
  disabled?: boolean;
}

const BRAND = '#013E77';

export function HotkeyBar({ actions, onActionPress, disabled = false }: HotkeyBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => onActionPress(action.id)}
          disabled={disabled}
        >
          <Ionicons name={action.icon} size={16} color={BRAND} />
          <Text style={styles.chipTxt}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipTxt: {
    fontSize: 13,
    color: BRAND,
    fontWeight: '500',
  },
});
