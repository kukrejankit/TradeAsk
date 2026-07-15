import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { timeAgo } from '../utils/timeAgo';
import type { ChatMessage } from '../types/chat';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser && styles.userText]}>{message.content}</Text>
        <View style={styles.meta}>
          {message.is_expert_reviewed && (
            <Text style={styles.reviewed}>Expert Reviewed</Text>
          )}
          <Text style={[styles.time, isUser && styles.userTime]}>{timeAgo(message.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, marginVertical: 4 },
  userContainer: { alignItems: 'flex-end' },
  assistantContainer: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  userBubble: { backgroundColor: '#1a73e8', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#f1f3f4', borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 21, color: '#222' },
  userText: { color: '#fff' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  time: { fontSize: 11, color: '#999' },
  userTime: { color: 'rgba(255,255,255,0.7)' },
  reviewed: { fontSize: 10, color: '#28a745', fontWeight: '600' },
  systemContainer: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  systemText: { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center' },
});
