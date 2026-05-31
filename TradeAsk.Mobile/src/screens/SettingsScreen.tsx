import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <TouchableOpacity style={styles.item} onPress={() => Linking.openURL('https://tradeask.app/privacy')}>
        <Text style={styles.itemText}>Privacy Policy</Text>
        <Text style={styles.arrow}>&rsaquo;</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => Linking.openURL('https://tradeask.app/terms')}>
        <Text style={styles.itemText}>Terms of Service</Text>
        <Text style={styles.arrow}>&rsaquo;</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => Linking.openURL('https://tradeask.app/disclaimer')}>
        <Text style={styles.itemText}>Disclaimer</Text>
        <Text style={styles.arrow}>&rsaquo;</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.version}>TradeAsk v1.0.0</Text>
        <Text style={styles.footerText}>AI + Expert compliance answers for tradespeople</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 24 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  itemText: { fontSize: 16, color: '#374151' },
  arrow: { fontSize: 20, color: '#9ca3af' },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  version: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
  footerText: { fontSize: 12, color: '#9ca3af' },
});
