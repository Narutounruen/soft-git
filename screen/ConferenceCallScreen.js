import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ConferenceCallScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conference Call</Text>
      <Text style={styles.subtitle}>This is a placeholder screen.</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation?.goBack?.()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});


