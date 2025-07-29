import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

const DIAL_BUTTONS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['*','0','#'],
];

const SoftphoneScreen = ({ 
  navigation, 
  status, 
  isConnected, 
  isInCall, 
  callStatus, 
  makeCall, 
  hangupCall 
}) => {
  const [number, setNumber] = useState('');

  const handlePress = (value) => {
    setNumber(prev => prev + value);
  };

  const handleDelete = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!isConnected) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเชื่อมต่อ SIP ก่อน');
      return;
    }

    if (!number.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการโทร');
      return;
    }

    if (isInCall) {
      // ถ้ากำลังโทรอยู่ ให้วางสาย
      await hangupCall();
    } else {
      // ถ้ายังไม่ได้โทร ให้โทรออก
      await makeCall(number);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Softphone</Text>
      
      {/* แสดงสถานะการเชื่อมต่อ */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>สถานะ:</Text>
        <Text style={[
          styles.status,
          status.includes('สำเร็จ') ? styles.success : 
          status.includes('❌') ? styles.error : styles.default
        ]}>
          {status}
        </Text>
      </View>

      {/* แสดงสถานะการโทร */}
      {callStatus && (
        <View style={styles.callStatusContainer}>
          <Text style={styles.callStatusText}>{callStatus}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        value={number}
        editable={false}
        textAlign="center"
        placeholder="กรอกหมายเลข"
        placeholderTextColor="#bbb"
      />
      <View style={styles.dialPad}>
        {DIAL_BUTTONS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.dialRow}>
            {row.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.dialButton}
                onPress={() => handlePress(item)}
                disabled={isInCall}
              >
                <Text style={styles.dialButtonText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.dialRow}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleDelete}
            disabled={isInCall}
          >
            <Text style={styles.actionButtonText}>⌫</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.callButton, 
              isInCall ? styles.hangupButton : null
            ]} 
            onPress={handleCall}
          >
            <Text style={styles.callButtonText}>
              {isInCall ? '📞' : '📞'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={{
          marginTop: 40,
          backgroundColor: '#0984e3',
          paddingVertical: 16,
          borderRadius: 10,
          alignItems: 'center',
          elevation: 2,
        }}
        onPress={() => navigation.navigate('SIPConnector')}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>SIP Config</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#2d3436' },
  statusContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  status: {
    fontSize: 16,
  },
  default: {
    color: '#666',
  },
  success: {
    color: '#27AE60',
    fontWeight: 'bold',
  },
  error: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  callStatusContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  callStatusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  input: { fontSize: 32, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, marginBottom: 25, padding: 15, backgroundColor: '#fff', color: '#222', elevation: 2 },
  dialPad: { alignItems: 'center', justifyContent: 'center' },
  dialRow: { flexDirection: 'row', marginBottom: 15 },
  dialButton: {
    width: 70, height: 70, marginHorizontal: 10, borderRadius: 35,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  dialButtonText: { fontSize: 28, color: '#333', fontWeight: 'bold' },
  actionButton: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#ff7675',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 3,
  },
  actionButtonText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  callButton: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#00b894',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 3,
  },
  hangupButton: {
    backgroundColor: '#f44336',
  },
  callButtonText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
});

export default SoftphoneScreen;
