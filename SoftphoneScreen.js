import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  saveCallHistory,
  subscribeToCallHistory,
  deleteCallHistory,
} from './services/callHistoryService';

const DIAL_BUTTONS = [
  [
    { main: '1', sub: '@' },
    { main: '2', sub: 'ABC' },
    { main: '3', sub: 'DEF' },
  ],
  [
    { main: '4', sub: 'GHI' },
    { main: '5', sub: 'JKL' },
    { main: '6', sub: 'MNO' },
  ],
  [
    { main: '7', sub: 'PQRS' },
    { main: '8', sub: 'TUV' },
    { main: '9', sub: 'WXYZ' },
  ],
  [
    { main: '*', sub: '' },
    { main: '0', sub: '+' },
    { main: '#', sub: '' },
  ],
];

const ConvergenceScreen = ({
  navigation,
  status,
  isConnected,
  isInCall,
  callStatus,
  makeCall,
  hangupCall,
  setCurrentCallNumber,
  navigateToCalling,
  config,
}) => {
  const [number, setNumber] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Subscribe to call history updates from Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCallHistory(
      'default_user', // You can make this dynamic based on user login
      (history, error) => {
        setLoading(false);
        if (error) {
          setError('ไม่สามารถโหลดประวัติการโทรได้');
          console.error('Call history error:', error);
        } else {
          setCallHistory(history);
          setError(null);
        }
      },
      50
    );

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handlePress = value => {
    setNumber(prev => prev + value);
  };

  const handleDelete = () => {
    setNumber(prev => prev.slice(0, -1));
  };
  const handleClearNumber = () => {
  setNumber(''); // ลบทั้งหมด
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
      // นำกลับไปหน้าหลักทันที
      // navigation.navigate('Convergence'); // ลบออกเพื่อป้องกันการเด้งกลับ
    } else {
      // ถ้ายังไม่ได้โทร ให้โทรออก
      setCurrentCallNumber(number);
      
      // Save call history to Firestore
      try {
        const callData = {
          number: number,
          type: 'outgoing',
        };
        await saveCallHistory(callData, 'default_user');
      } catch (error) {
        console.error('Failed to save call history:', error);
        // Don't block the call if saving fails
      }
      
      await makeCall(number);
      // ไปยังหน้า CallingScreen ทันที
      navigation.navigate('Calling');
    }
  };

  const handleDeleteCallHistory = async (callId) => {
    try {
      await deleteCallHistory(callId);
      Alert.alert('สำเร็จ', 'ลบประวัติการโทรแล้ว');
    } catch (error) {
      console.error('Error deleting call history:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบประวัติการโทรได้');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Convergence Logo */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Convergence</Text>
            <Text style={styles.headerSubtitle}>SIP Softphone</Text>
          </View>
        </View>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            isConnected ? styles.statusOnline : styles.statusOffline
          ]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.topSection}>
        <View style={styles.numberInputContainer}>
          <TextInput
            style={styles.phoneInput}
            placeholder="Enter numbers"
            placeholderTextColor="#ccc"
            keyboardType="phone-pad"
            value={number}
            onChangeText={setNumber}
            editable={false}
            selectTextOnFocus={false}
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            onLongPress={handleClearNumber}
          >
            <Text style={styles.deleteButtonText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.centerSection}>
        <View style={styles.dialPad}>
          {DIAL_BUTTONS.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.dialRow}>
              {row.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dialButton}
                  onPress={() => handlePress(item.main)}
                  disabled={!!isInCall}
                >
                  <Text style={styles.dialMain}>{item.main}</Text>
                  {!!item.sub && <Text style={styles.dialSub}>{item.sub}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.sipContainer}>
            <TouchableOpacity style={styles.sipCallButton} onPress={handleCall}>
              <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>

            <View style={styles.sipStatusBox}>
              <Text style={styles.sipTitle}>Call with SIP</Text>
              <View style={styles.sipRow}>
                <Text style={styles.sipLabel}>
                  {isConnected && config?.username ? config.username : 'ไม่ได้เชื่อมต่อ'}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    isConnected ? styles.statusOnline : styles.statusOffline,
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Menu */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('Contacts')}
        >
          <Icon name="people-outline" size={24} color="#2665e4ff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setShowHistory(true);
          }}
        >
          <Icon name="time-outline" size={24} color="#2665e4ff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('SIPConnector')}
        >
          <Icon name="settings-outline" size={24} color="#2665e4ff" />
        </TouchableOpacity>
      </View>
      {/* Call History Modal */}
      <Modal
        visible={showHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.historyModalContainer}>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderContent}>
              <Text style={styles.historyTitle}>📞 ประวัติการโทร</Text>
              <Text style={styles.historySubtitle}>
                {callHistory.length > 0 ? `${callHistory.length} รายการ` : 'ไม่มีประวัติ'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {callHistory.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={() => {
                    Alert.alert(
                      'ล้างประวัติทั้งหมด',
                      'คุณต้องการลบประวัติการโทรทั้งหมดหรือไม่?',
                      [
                        { text: 'ยกเลิก', style: 'cancel' },
                        { 
                          text: 'ล้างทั้งหมด', 
                          style: 'destructive',
                          onPress: () => {
                            // ลบประวัติทั้งหมด
                            callHistory.forEach(call => handleDeleteCallHistory(call.id));
                          }
                        },
                      ]
                    );
                  }}
                >
                  <Icon name="trash" size={18} color="#E74C3C" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowHistory(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>กำลังโหลดประวัติการโทร...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Icon name="warning" size={48} color="#E74C3C" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                    // Re-subscribe will happen automatically due to useEffect
                  }}
                >
                  <Text style={styles.retryButtonText}>🔄 ลองใหม่</Text>
                </TouchableOpacity>
              </View>
            ) : callHistory.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Icon name="call-outline" size={64} color="#ccc" />
                <Text style={styles.noHistoryText}>ไม่มีประวัติการโทร</Text>
                <Text style={styles.noHistorySubtext}>ประวัติการโทรจะแสดงที่นี่</Text>
              </View>
            ) : (
              (() => {
                // จัดกลุ่มประวัติตามวันที่
                const groupedHistory = callHistory.reduce((groups, call) => {
                  const date = call.createdAt ? new Date(call.createdAt).toDateString() : 'Unknown Date';
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(call);
                  return groups;
                }, {});

                return Object.entries(groupedHistory).map(([date, calls]) => (
                  <View key={date}>
                    <View style={styles.dateHeader}>
                      <Text style={styles.dateHeaderText}>
                        {date === new Date().toDateString() 
                          ? 'วันนี้' 
                          : new Date(date).toLocaleDateString('th-TH', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                        }
                      </Text>
                      <Text style={styles.dateCount}>{calls.length} สาย</Text>
                    </View>
                    {calls.map((call, index) => (
                      <TouchableOpacity
                        key={call.id || `${date}-${index}`}
                        style={[styles.historyItem, {
                          borderLeftColor: call.type === 'outgoing' ? '#2196F3' : '#4CAF50'
                        }]}
                        onPress={() => {
                          setNumber(call.number);
                          setShowHistory(false);
                        }}
                      >
                        <View style={styles.historyItemLeft}>
                          <View style={[styles.callTypeIcon, {
                            backgroundColor: call.type === 'outgoing' ? '#2196F3' : '#4CAF50'
                          }]}>
                            <Icon 
                              name={call.type === 'outgoing' ? 'call' : 'call-outline'} 
                              size={16} 
                              color="#fff" 
                            />
                          </View>
                          <View style={styles.historyItemContent}>
                            <Text style={styles.historyNumber}>{call.number}</Text>
                            <Text style={styles.historyTime}>
                              {call.createdAt ? new Date(call.createdAt).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : 'ไม่ทราบเวลา'}
                            </Text>
                            <Text style={styles.historyType}>
                              {call.type === 'outgoing' ? 'โทรออก' : 'สายเข้า'} 
                              {call.duration && ` • ${call.duration} วินาที`}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.historyActions}>
                          <TouchableOpacity
                            style={styles.callAgainButton}
                            onPress={() => {
                              setNumber(call.number);
                              setShowHistory(false);
                              makeCall();
                            }}
                          >
                            <Icon name="call" size={16} color="#4CAF50" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteHistoryButton}
                            onPress={() => {
                              Alert.alert(
                                'ยืนยันการลบ',
                                'คุณต้องการลบประวัติการโทรนี้หรือไม่?',
                                [
                                  { text: 'ยกเลิก', style: 'cancel' },
                                  { 
                                    text: 'ลบ', 
                                    style: 'destructive',
                                    onPress: () => handleDeleteCallHistory(call.id)
                                  },
                                ]
                              );
                            }}
                          >
                            <Icon name="trash" size={16} color="#E74C3C" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ));
              })()
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  topSection: {
    paddingTop: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  menuItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '500',
  },
  statusContainer: {
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '50%',
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
    marginBottom: 15,
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
  numberDisplay: {
    fontSize: 35,
    marginBottom: 10,
    textAlign: 'center',
    color: '#2d3436',
    fontWeight: '600',
    letterSpacing: 2,
  },

  dialPad: { alignItems: 'center', justifyContent: 'center' },
  dialRow: { flexDirection: 'row', marginBottom: 15 },
  dialButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  dialMain: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },

  dialSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  dialButtonText: { fontSize: 28, color: '#333', fontWeight: 'bold' },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff7675',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  actionButtonText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  callButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#00b894',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  hangupButton: {
    backgroundColor: '#f44336',
  },
  callButtonText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  historyModalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  historyHeaderContent: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffebee',
    marginRight: 8,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  historySubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  historyList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  noHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 12,
  },
  noHistorySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  dateCount: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 2,
  },
  historyType: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callAgainButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    marginRight: 8,
  },
  deleteHistoryButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffebee',
  },
  deleteHistoryText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sipCallButton: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#176B87',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  callIcon: {
    fontSize: 30,
    color: '#e1e1e1ff',
  },

  sipStatusBox: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    width: 180,
    justifyContent: 'center',
  },

  sipTitle: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
    fontWeight: '600',
  },

  sipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sipLabel: {
    fontSize: 14,
    color: '#444',
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  statusOnline: {
    backgroundColor: '#00C851',
    

  },

  statusOffline: {
    backgroundColor: '#f40606ff',
  },

  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginHorizontal: 30,
    marginBottom: 1,
    paddingVertical: 4,
  },

  phoneInput: {
    flex: 1,
    fontSize: 20,
    color: '#333',
    letterSpacing: 4,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 25,
    fontWeight: 'bold',
    color: '#68696aff',
    marginLeft: 30,
  },
});

export default ConvergenceScreen;
