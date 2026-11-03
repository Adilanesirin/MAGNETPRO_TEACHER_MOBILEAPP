import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type NoNetworkScreenProps = {
  onTryAgain: () => void;
  retrying?: boolean;
};

export default function NoNetworkScreen({ onTryAgain, retrying = false }: NoNetworkScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialIcons name="wifi-off" size={50} color="#127B93" />
      </View>
      <Text style={styles.title}>Oops, no network</Text>
      <Text style={styles.message}>
        Check your Wi-Fi or mobile data connection, then try again.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Try connecting again"
        activeOpacity={0.85}
        disabled={retrying}
        onPress={onTryAgain}
        style={[styles.button, retrying && styles.buttonDisabled]}
      >
        {retrying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Try Again</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F7FBFC',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#DDF4F8',
    borderRadius: 56,
    height: 112,
    justifyContent: 'center',
    marginBottom: 24,
    width: 112,
  },
  title: {
    color: '#173B43',
    fontSize: 24,
    fontWeight: '700',
  },
  message: {
    color: '#57737A',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 300,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#127B93',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 30,
    minHeight: 50,
    paddingHorizontal: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
