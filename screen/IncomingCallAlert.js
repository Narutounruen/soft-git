import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const IncomingCallAlert = ({ visible, callerNumber, onAccept, onDecline }) => {
  const [scaleValue] = useState(new Animated.Value(0));
  const [fadeValue] = useState(new Animated.Value(0));
  const [pulseValue] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      // เปิด animation
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animation กระพริบของปุ่ม
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      statusBarTranslucent={true}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeValue }
        ]}
      >
        <LinearGradient
          colors={['rgba(20,30,50,0.95)', 'rgba(0,0,0,0.98)']}
          style={styles.gradientBackground}
        >
          <Animated.View
            style={[
              styles.container,
              {
                transform: [{ scale: scaleValue }]
              }
            ]}
          >
            {/* Header with icon */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon name="call" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.headerText}>สายเรียกเข้า</Text>
            </View>

            {/* Avatar */}
            <Animated.View 
              style={[
                styles.avatarContainer,
                { transform: [{ scale: pulseValue }] }
              ]}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {callerNumber ? callerNumber.charAt(0) : '?'}
                </Text>
              </LinearGradient>
              <View style={styles.ripple1} />
              <View style={styles.ripple2} />
            </Animated.View>

            {/* Caller Info */}
            <View style={styles.callerInfo}>
              <Text style={styles.callerNumber}>
                {callerNumber || 'ไม่ระบุหมายเลข'}
              </Text>
              <Text style={styles.callerStatus}>📱 Mobile Call</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {/* Decline Button */}
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onDecline}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#ff4757', '#ff3838']}
                  style={styles.buttonGradient}
                >
                  <Icon name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </LinearGradient>
                <Text style={styles.buttonLabel}>ปฏิเสธ</Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2ed573', '#1dd1a1']}
                  style={styles.buttonGradient}
                >
                  <Icon name="call" size={28} color="#fff" />
                </LinearGradient>
                <Text style={styles.buttonLabel}>รับสาย</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom hint */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>แตะเพื่อรับสายหรือปฏิเสธ</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 25,
  },
  iconContainer: {
    marginRight: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 25,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 3,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
  },
  ripple1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    top: -10,
    left: -10,
    zIndex: 1,
  },
  ripple2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    top: -20,
    left: -20,
    zIndex: 0,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 35,
  },
  callerNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerStatus: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  declineButton: {
    alignItems: 'center',
  },
  acceptButton: {
    alignItems: 'center',
  },
  buttonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
    marginBottom: 8,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
  },
  hintContainer: {
    marginTop: 15,
  },
  hintText: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default IncomingCallAlert;