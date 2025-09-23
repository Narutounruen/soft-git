import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const AttendedTransferScreen = ({
  navigation,
  route,
  transferManager, // PJSIPCallTransfer instance
  AudioHelper,
}) => {
  const { transferId, originalCall, consultCall, targetNumber } = route.params || {};
  
  const [transferState, setTransferState] = useState('consulting'); // 'consulting', 'conference', 'completed'
  const [activeCall, setActiveCall] = useState('consult'); // 'original', 'consult'
  const [isConferenceActive, setIsConferenceActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // ตัวนับเวลาการโทร
  useEffect(() => {
    let interval;
    if (transferState === 'consulting' || transferState === 'conference') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [transferState]);

  // รีเซ็ต state เมื่อเข้าหน้าใหม่
  useEffect(() => {
    if (transferId) {
      const transfer = transferManager?.getTransferById(transferId);
      if (transfer) {
        setTransferState(transfer.status);
        setActiveCall(transfer.activeCall || 'consult');
      }
    }
  }, [transferId]);

  // แปลงเวลาจากวินาทีเป็นรูปแบบ MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // สลับระหว่างสายเดิมและสายปรึกษา
  const handleSwitchCall = async () => {
    try {
      if (!transferManager || !transferId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลการโอนสาย');
        return;
      }

      const newActiveCall = await transferManager.switchBetweenCalls(transferId);
      setActiveCall(newActiveCall);
      
      const callName = newActiveCall === 'original' ? 'สายเดิม' : 'สายปรึกษา';
      Alert.alert('สลับสาย', `กำลังคุยกับ${callName}แล้ว`);
      
    } catch (error) {
      console.error('Error switching calls:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถสลับสายได้: ${error.message}`);
    }
  };

  // สร้าง 3-way conference
  const handleCreateConference = async () => {
    try {
      if (!transferManager || !transferId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลการโอนสาย');
        return;
      }

      Alert.alert(
        'สร้าง Conference',
        'ต้องการสร้าง 3-way conference หรือไม่?\n\nทุกฝ่ายจะสามารถคุยกันได้พร้อมกัน',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'สร้าง Conference',
            onPress: async () => {
              const success = await transferManager.createThreeWayConference(transferId);
              if (success) {
                setTransferState('conference');
                setIsConferenceActive(true);
                Alert.alert('สำเร็จ', '3-way conference ถูกสร้างแล้ว');
              } else {
                Alert.alert('ข้อผิดพลาด', 'ไม่สามารถสร้าง conference ได้');
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error creating conference:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถสร้าง conference ได้: ${error.message}`);
    }
  };

  // เสร็จสิ้นการโอนสาย
  const handleCompleteTransfer = async () => {
    try {
      if (!transferManager || !transferId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลการโอนสาย');
        return;
      }

      Alert.alert(
        'เสร็จสิ้นการโอนสาย',
        `ต้องการโอนสายเดิมไป ${targetNumber} และออกจากการสนทนาหรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'โอนสาย',
            onPress: async () => {
              const success = await transferManager.completeAttendedTransfer(transferId);
              if (success) {
                setTransferState('completed');
                Alert.alert('สำเร็จ', 'โอนสายสำเร็จแล้ว', [
                  {
                    text: 'ตกลง',
                    onPress: () => navigation.navigate('Softphone')
                  }
                ]);
              } else {
                Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโอนสายได้');
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error completing transfer:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเสร็จสิ้นการโอนสายได้: ${error.message}`);
    }
  };

  // ยกเลิกการโอนสาย
  const handleCancelTransfer = async () => {
    try {
      if (!transferManager || !transferId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลการโอนสาย');
        return;
      }

      Alert.alert(
        'ยกเลิกการโอนสาย',
        'ต้องการยกเลิกการโอนสายและกลับไปคุยกับสายเดิมหรือไม่?',
        [
          { text: 'ไม่ยกเลิก', style: 'cancel' },
          {
            text: 'ยกเลิก',
            style: 'destructive',
            onPress: async () => {
              const success = await transferManager.cancelAttendedTransfer(transferId);
              if (success) {
                Alert.alert('ยกเลิกแล้ว', 'กลับไปคุยกับสายเดิมแล้ว', [
                  {
                    text: 'ตกลง',
                    onPress: () => navigation.navigate('Calling')
                  }
                ]);
              } else {
                Alert.alert('ข้อผิดพลาด', 'ไม่สามารถยกเลิกการโอนสายได้');
              }
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถยกเลิกการโอนสายได้: ${error.message}`);
    }
  };

  // กลับไปหน้าการโทร
  const handleBackToCall = () => {
    navigation.goBack();
  };

  const getStatusText = () => {
    switch (transferState) {
      case 'consulting':
        return activeCall === 'original' ? 'กำลังคุยกับสายเดิม' : `กำลังปรึกษากับ ${targetNumber}`;
      case 'conference':
        return '3-way Conference กำลังทำงาน';
      case 'completed':
        return 'โอนสายเสร็จสิ้นแล้ว';
      default:
        return 'กำลังโอนสาย...';
    }
  };

  const getActiveCallText = () => {
    if (isConferenceActive) {
      return 'Conference Call';
    }
    return activeCall === 'original' ? 'สายเดิม' : `${targetNumber}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToCall}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>การโอนสายแบบปรึกษา</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Call Info */}
      <View style={styles.callInfoContainer}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {targetNumber ? targetNumber.charAt(0) : '?'}
          </Text>
        </View>

        <Text style={styles.callerName}>
          {getActiveCallText()}
        </Text>

        <Text style={styles.callStatus}>{getStatusText()}</Text>

        {(transferState === 'consulting' || transferState === 'conference') && (
          <Text style={styles.callDuration}>{formatTime(callDuration)}</Text>
        )}

        {/* สถานะการโอนสาย */}
        <View style={styles.transferStatusContainer}>
          <View style={styles.transferStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.transferStatusText}>สายเดิม: {originalCall?.remoteUri || 'ไม่ทราบ'}</Text>
          </View>
          <View style={styles.transferStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.transferStatusText}>สายปรึกษา: {targetNumber}</Text>
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      {transferState === 'consulting' && (
        <View style={styles.controlsContainer}>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSwitchCall}
            >
              <View style={styles.controlIcon}>
                <MaterialIcons name="swap-calls" size={24} color="#666" />
              </View>
              <Text style={styles.controlLabel}>สลับสาย</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleCreateConference}
            >
              <View style={styles.controlIcon}>
                <MaterialCommunityIcons name="account-group" size={24} color="#666" />
              </View>
              <Text style={styles.controlLabel}>Conference</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.transferButton]}
              onPress={handleCompleteTransfer}
            >
              <View style={[styles.controlIcon, styles.transferIcon]}>
                <MaterialIcons name="call-made" size={24} color="#fff" />
              </View>
              <Text style={[styles.controlLabel, styles.transferLabel]}>โอนสาย</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.cancelButton]}
              onPress={handleCancelTransfer}
            >
              <View style={[styles.controlIcon, styles.cancelIcon]}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </View>
              <Text style={[styles.controlLabel, styles.cancelLabel]}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Conference Controls */}
      {transferState === 'conference' && (
        <View style={styles.controlsContainer}>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.transferButton]}
              onPress={handleCompleteTransfer}
            >
              <View style={[styles.controlIcon, styles.transferIcon]}>
                <MaterialIcons name="call-made" size={24} color="#fff" />
              </View>
              <Text style={[styles.controlLabel, styles.transferLabel]}>โอนสาย</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.cancelButton]}
              onPress={handleCancelTransfer}
            >
              <View style={[styles.controlIcon, styles.cancelIcon]}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </View>
              <Text style={[styles.controlLabel, styles.cancelLabel]}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        {transferState === 'consulting' && (
          <Text style={styles.instructionsText}>
            • ใช้ "สลับสาย" เพื่อเปลี่ยนระหว่างสายเดิมและสายปรึกษา{'\n'}
            • ใช้ "Conference" เพื่อให้ทุกฝ่ายคุยกันพร้อมกัน{'\n'}
            • ใช้ "โอนสาย" เพื่อโอนสายเดิมไปยังสายปรึกษาและออกจากการสนทนา{'\n'}
            • ใช้ "ยกเลิก" เพื่อยกเลิกการโอนสายและกลับไปคุยกับสายเดิม
          </Text>
        )}
        
        {transferState === 'conference' && (
          <Text style={styles.instructionsText}>
            กำลังอยู่ใน 3-way conference call{'\n'}
            ทุกฝ่ายสามารถคุยกันได้พร้อมกัน{'\n\n'}
            • ใช้ "โอนสาย" เพื่อโอนสายและออกจาก conference{'\n'}
            • ใช้ "ยกเลิก" เพื่อยกเลิกการโอนสาย
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  callInfoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  callDuration: {
    fontSize: 18,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 20,
  },
  transferStatusContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    width: '90%',
  },
  transferStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  transferStatusText: {
    fontSize: 14,
    color: '#333',
  },
  controlsContainer: {
    paddingHorizontal: 20,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 100,
  },
  controlIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  transferButton: {
    backgroundColor: '#4CAF50',
  },
  transferIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  transferLabel: {
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#f44336',
  },
  cancelIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelLabel: {
    color: '#fff',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default AttendedTransferScreen;
