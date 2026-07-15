import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, Dimensions, Pressable,
} from 'react-native';
import { useChat } from '../contexts/ChatContext';
import { timeAgo } from '../utils/timeAgo';
import type { ChatSession } from '../types/chat';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function SessionSidebar({ visible, onClose, onSelectSession, onNewSession }: Props) {
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const { sessions, currentSessionId, deleteSession } = useChat();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: visible ? 0 : -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: visible ? 0.4 : 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const renderItem = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={[styles.sessionItem, item.id === currentSessionId && styles.sessionActive]}
      onPress={() => { onSelectSession(item.id); onClose(); }}
    >
      <View style={styles.sessionContent}>
        <Text style={styles.sessionTopic} numberOfLines={1}>
          {item.topic || item.category}
        </Text>
        <Text style={styles.sessionDate}>{timeAgo(item.updated_at)}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteSession(item.id)}>
        <Text style={styles.deleteText}>x</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sidebar, { transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Sessions</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => { onNewSession(); onClose(); }}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#222' },
  newBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { paddingTop: 8 },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sessionActive: { backgroundColor: '#e8f0fe' },
  sessionContent: { flex: 1 },
  sessionTopic: { fontSize: 14, fontWeight: '500', color: '#333' },
  sessionDate: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteText: { fontSize: 16, color: '#999', fontWeight: '600' },
});
