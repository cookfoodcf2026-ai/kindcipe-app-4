import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import type { Message } from '@/types/ai-chef';

interface ChatMessageBubbleProps {
  message: Message;
  isBot: boolean;
}

const BRAND = '#013E77';
const SUB = '#6B7280';
const BG_USER = '#E5E7EB';
const BG_BOT = '#F3F4F6';

export function ChatMessageBubble({ message, isBot }: ChatMessageBubbleProps) {
  const renderContent = () => {
    if (typeof message.content === 'string') {
      return <Text style={styles.bubbleTxt}>{message.content}</Text>;
    }

    if (Array.isArray(message.content)) {
      return message.content.map((block, idx) => {
        if (block.type === 'text') {
          return <Text key={idx} style={styles.bubbleTxt}>{block.text}</Text>;
        }
        if (block.type === 'image_url') {
          return (
            <Image
              key={idx}
              source={{ uri: block.image_url.url }}
              style={styles.bubbleImg}
              resizeMode="cover"
            />
          );
        }
        return null;
      });
    }

    return null;
  };

  return (
    <View style={[styles.msgRow, isBot ? styles.msgRowBot : styles.msgRowUser]}>
      {isBot && (
        <View style={styles.avatar}>
          <Text style={styles.avatarIcon}>🤖</Text>
        </View>
      )}
      <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
        {renderContent()}
      </View>
      {!isBot && (
        <View style={styles.avatar}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  msgRowBot: {
    justifyContent: 'flex-start',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  avatarIcon: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleBot: {
    backgroundColor: BG_BOT,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: BG_USER,
    borderBottomRightRadius: 4,
  },
  bubbleTxt: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  bubbleImg: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
});
