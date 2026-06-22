import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { colors } from '../styles/colors';
import { theme } from '../styles/theme';
import { typography } from '../styles/typography';

interface RemarksEditorProps {
  initialRemarks?: string;
  onSave: (remarks: string) => void;
  onCancel?: () => void;
}

export const RemarksEditor: React.FC<RemarksEditorProps> = ({
  initialRemarks = '',
  onSave,
  onCancel,
}) => {
  const [remarks, setRemarks] = useState(initialRemarks);

  return (
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
          編輯備註
        </Text>

        <TouchableOpacity onPress={onCancel}>
          <Icon name="settings" size={20} color={colors.primary.navy} />
        </TouchableOpacity>
      </View>

      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: colors.neutral.white,
          borderWidth: 1,
          borderColor: colors.neutral.lightGray,
          marginBottom: theme.spacing.md,
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
          }}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
        }}
      >
        <TouchableOpacity
          onPress={onCancel}
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            borderWidth: 2,
            borderColor: colors.primary.navy,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              ...typography.body,
              color: colors.primary.navy,
              fontWeight: '600',
            }}
          >
            取消
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSave(remarks)}
          style={{
            flex: 1,
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
            保存
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function RemarksEditorRoute() { return null; }
