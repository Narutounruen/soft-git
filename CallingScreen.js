import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Animated,
  Alert
} from 'react-native';

const { width, height } = Dimensions.get('window');

const CallingScreen = ({ 
  navigation, 
  route,
  hangupCall,
  callStatus,
  isInCall,
  currentCallNumber
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));

  // เริ่มการนับเวลาการโทร
  useEffect(() => {
    let interval;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall]);

  // Animation สำหรับ pulse effect
  useEffect(() => {
    if (isInCall) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [isInCall, pulseAnim]);

  // แปลงเวลาจากวินาทีเป็นรูปแบบ HH:MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHangup = async () => {
    await hangupCall();
    // รอให้ state อัปเดต (ถ้าจำเป็น)
    setTimeout(() => {
      navigation.goBack();
    }, 300); // รอ 300ms หรือจนแน่ใจว่าสายถูกตัด
  };
  const handleMute = () => {
    // เพิ่มฟังก์ชันปิดเสียงที่นี่
    Alert.alert('ปิดเสียง', 'ฟีเจอร์ปิดเสียงจะเพิ่มในภายหลัง');
  };

  const handleSpeaker = () => {
    // เพิ่มฟังก์ชันเปิดลำโพงที่นี่
    Alert.alert('เปิดลำโพง', 'ฟีเจอร์เปิดลำโพงจะเพิ่มในภายหลัง');
  };

  const handleKeypad = () => {
    // เพิ่มฟังก์ชันคีย์แพดที่นี่
    Alert.alert('คีย์แพด', 'ฟีเจอร์คีย์แพดจะเพิ่มในภายหลัง');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>กำลังโทร</Text>
      </View>

      {/* Call Info */}
      <View style={styles.callInfoContainer}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.avatarText}>
            {currentCallNumber ? currentCallNumber.charAt(0).toUpperCase() : '?'}
          </Text>
        </Animated.View>
        
        <Text style={styles.callerName}>
          {currentCallNumber || 'ไม่ทราบหมายเลข'}
        </Text>
        
        <Text style={styles.callStatus}>
          {callStatus || 'กำลังเชื่อมต่อ...'}
        </Text>
        
        {isInCall && (
          <Text style={styles.callDuration}>
            {formatTime(callDuration)}
          </Text>
        )}
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlButton} onPress={handleMute}>
            <View style={styles.controlIcon}>
              <Text style={styles.controlIconText}>🔇</Text>
            </View>
            <Text style={styles.controlLabel}>ปิดเสียง</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={handleSpeaker}>
            <View style={styles.controlIcon}>
              <Text style={styles.controlIconText}>🔊</Text>
            </View>
            <Text style={styles.controlLabel}>ลำโพง</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={handleKeypad}>
            <View style={styles.controlIcon}>
              <Text style={styles.controlIconText}>⌨️</Text>
            </View>
            <Text style={styles.controlLabel}>คีย์แพด</Text>
          </TouchableOpacity>
        </View>

        {/* Hangup Button */}
        <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
          <View style={styles.hangupIcon}>
            <Text style={styles.hangupIconText}>📞</Text>
          </View>
          <Text style={styles.hangupLabel}>วางสาย</Text>
        </TouchableOpacity>
      </View>

      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← กลับ</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  callInfoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  callerName: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    textAlign: 'center',
  },
  callDuration: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '600',
  },
  controlsContainer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  controlButton: {
    alignItems: 'center',
    flex: 1,
  },
  controlIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  controlIconText: {
    fontSize: 24,
  },
  controlLabel: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
  },
  hangupButton: {
    alignItems: 'center',
  },
  hangupIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  hangupIconText: {
    fontSize: 32,
    color: '#fff',
  },
  hangupLabel: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default CallingScreen; 