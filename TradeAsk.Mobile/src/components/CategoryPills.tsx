import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

const CATEGORIES = ['All', 'Import/Export', 'Tariffs & Duties', 'Sanctions', 'Licensing', 'Customs', 'FTZ', 'Compliance'];

interface Props {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryPills({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {CATEGORIES.map(cat => (
        <TouchableOpacity
          key={cat}
          style={[styles.pill, selected === cat && styles.pillActive]}
          onPress={() => onSelect(cat)}
        >
          <Text style={[styles.pillText, selected === cat && styles.pillTextActive]}>{cat}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#1a73e8' },
  pillText: { fontSize: 13, color: '#555' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
});
