import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { timeAgo } from '../utils/timeAgo';

interface Props {
  category: string;
  question: string;
  answer?: string | null;
  date: string;
  onPress?: () => void;
}

export function QuestionCard({ category, question, answer, date, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{category}</Text>
        </View>
        <Text style={styles.date}>{timeAgo(date)}</Text>
      </View>
      <Text style={styles.question} numberOfLines={2}>{question}</Text>
      {answer && <Text style={styles.answer} numberOfLines={3}>{answer}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, color: '#1a73e8', fontWeight: '600' },
  date: { fontSize: 12, color: '#999' },
  question: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 6 },
  answer: { fontSize: 13, color: '#555', lineHeight: 18 },
});
