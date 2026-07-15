import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface Props {
  content: string;
  isStreaming: boolean;
}

export function StreamingBubble({ content, isStreaming }: Props) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isStreaming) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      blink.start();
      return () => blink.stop();
    } else {
      cursorOpacity.setValue(0);
    }
  }, [isStreaming]);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text}>
          {content || 'Thinking...'}
          {isStreaming && (
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}> |</Animated.Text>
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, marginVertical: 4, alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, backgroundColor: '#f1f3f4' },
  text: { fontSize: 15, lineHeight: 21, color: '#222' },
  cursor: { color: '#1a73e8', fontWeight: '700' },
});
