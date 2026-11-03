import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

export default function ForceUpdateModal({ visible, message, onUpdate, onLater }: {
  visible: boolean;
  message: string;
  onUpdate: () => void;
  onLater: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialIcons name="system-update" size={48} color={theme.colors.primary} />
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onUpdate} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={onLater} activeOpacity={0.7}>
            <Text style={styles.laterText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  title: { fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 8, color: '#111' },
  message: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  laterBtn: { marginTop: 12, paddingVertical: 6 },
  laterText: { color: '#999', fontSize: 13, fontWeight: '600' },
});