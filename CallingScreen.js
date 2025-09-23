import React, { useState, useEffect, useLayoutEffect } from 'react';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { useContacts } from './useContacts';

const { width, height } = Dimensions.get('window');
const CallingScreen = ({
  navigation,
  hangupCall,
  toggleHold,
  callStatus,
  isInCall,
  isHold,
  currentCallNumber,
  AudioHelper,
  showUnattendedTransferDialog,
  showAttendedTransferDialog,
  conference,
  addToConference,
  removeFromConference,
  conferenceParticipants = [],
  isInConference = false,
  // Conference Bridge props
  conferenceBridge,
  showConferenceBridge,
  startConferenceBridge,
}) => {
  const { contacts } = useContacts(); // เพิ่มเพื่อค้นหาข้อมูล contact
  
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showConferenceModal, setShowConferenceModal] = useState(false);

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

  // แปลงเวลาจากวินาทีเป็นรูปแบบ HH:MM:SS
  const formatTime = seconds => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ฟังก์ชันค้นหาข้อมูล contact จากหมายเลขโทรศัพท์
  const getCurrentContact = () => {
    if (!currentCallNumber || !contacts.length) return null;
    return contacts.find(contact => contact.phone === currentCallNumber);
  };

  // ฟังก์ชันสร้างสี avatar เหมือนกับใน ContactScreen
  const getAvatarColor = (letter) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#A55EEA', '#26DE81', '#FD79A8', '#FDCB6E', '#6C5CE7'
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // ฟังก์ชันดึงชื่อที่จะแสดง
  const getDisplayName = () => {
    const contact = getCurrentContact();
    return contact ? contact.name : (currentCallNumber || 'ไม่ทราบหมายเลข');
  };

  // ฟังก์ชันดึงตัวอักษรสำหรับ avatar
  const getAvatarLetter = () => {
    const contact = getCurrentContact();
    if (contact) {
      return contact.name.charAt(0).toUpperCase();
    }
    return currentCallNumber ? currentCallNumber.charAt(0) : '?';
  };

  const handleHangup = async () => {
    try {
      // รีเซ็ตสถานะลำโพงและไมค์ก่อนวางสาย
      if (isSpeakerOn && AudioHelper) {
        await AudioHelper.disableSpeaker();
        setIsSpeakerOn(false);
      }

      if (isMuted && AudioHelper) {
        await AudioHelper.unmuteMicrophone();
        setIsMuted(false);
      }

      await hangupCall(); // รอให้การวางสายเสร็จสมบูรณ์
      // เคลียร์ timer การนับเวลา
      setCallDuration(0);
      navigation.goBack();
    } catch (error) {
      console.error('Error hanging up:', error);
      // ถ้าเกิดข้อผิดพลาด ก็ยังต้องกลับไปหน้าก่อนหน้า
      navigation.goBack();
    }
  };

  const handleMute = async () => {
    try {
      // ตรวจสอบว่ามี AudioHelper หรือไม่
      if (!AudioHelper) {
        console.log('❌ AudioHelper ไม่พร้อมใช้งาน');
        Alert.alert('ข้อผิดพลาด', 'ระบบเสียงไม่พร้อมใช้งาน');
        return;
      }

      if (isMuted) {
        // เปิดไมค์ (unmute)
        const success = await AudioHelper.unmuteMicrophone();
        if (success) {
          setIsMuted(false);
          console.log('✅ เปิดไมค์แล้ว');
        } else {
          console.log('❌ ไม่สามารถเปิดไมค์ได้');
          Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเปิดไมค์ได้');
        }
      } else {
        // ปิดไมค์ (mute)
        const success = await AudioHelper.muteMicrophone();
        if (success) {
          setIsMuted(true);
          console.log('✅ ปิดไมค์แล้ว');
        } else {
          console.log('❌ ไม่สามารถปิดไมค์ได้');
          Alert.alert('ข้อผิดพลาด', 'ไม่สามารถปิดไมค์ได้');
        }
      }
    } catch (error) {
      console.error('Mute control error:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการควบคุมไมค์');
    }
  };

  const handleSpeaker = async () => {
    try {
      // ตรวจสอบว่ามี AudioHelper หรือไม่
      if (!AudioHelper) {
        console.log('❌ AudioHelper ไม่พร้อมใช้งาน');
        return;
      }

      if (isSpeakerOn) {
        // ปิดลำโพง
        const success = await AudioHelper.disableSpeaker();
        if (success) {
          setIsSpeakerOn(false);
          console.log('✅ ปิดลำโพงแล้ว');
        } else {
          console.log('❌ ไม่สามารถปิดลำโพงได้');
        }
      } else {
        // เปิดลำโพง
        const enableSuccess = await AudioHelper.enableSpeaker();
        if (enableSuccess) {
          setIsSpeakerOn(true);
          console.log('✅ เปิดลำโพงแล้ว');
        } else {
          console.log('❌ ไม่สามารถเปิดลำโพงได้');
        }
      }
    } catch (error) {
      console.error('Speaker control error:', error);
    }
  };

  const handleKeypad = () => {
    // เพิ่มฟังก์ชันคีย์แพดที่นี่
    Alert.alert('คีย์แพด', 'ฟีเจอร์คีย์แพดจะเพิ่มในภายหลัง');
  };

  const handleHold = () => {
    if (toggleHold) {
      toggleHold();
    } else {
      Alert.alert('Hold', 'ฟีเจอร์ Hold ยังไม่พร้อมใช้งาน');
    }
  };

  // เพิ่มฟังก์ชันจัดการการโอนสาย
  const handleTransfer = () => {
    Alert.alert('เลือกประเภทการโอนสาย', 'เลือกประเภทการโอนสายที่ต้องการ', [
      {
        text: 'ยกเลิก',
        style: 'cancel',
      },
      {
        text: 'โอนสายทันที',
        onPress: () => showUnattendedTransferDialog(),
      },
      {
        text: 'โอนสายแบบปรึกษา',
        onPress: () => showAttendedTransferDialog(),
      },
    ]);
  };

  // เพิ่มฟังก์ชันจัดการ conference
  const handleConference = async () => {
    try {
      if (showConferenceBridge && startConferenceBridge) {
        // เริ่ม Conference Bridge
        const success = await startConferenceBridge();
        if (success) {
          // แสดง Conference Bridge Modal
          showConferenceBridge();
        } else {
          Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเริ่ม Conference ได้');
        }
      } else if (conference) {
        // ใช้ Conference เดิม (fallback)
        conference();
      } else {
        Alert.alert('Conference', 'ฟีเจอร์ Conference ยังไม่พร้อมใช้งาน');
      }
    } catch (error) {
      console.error('Conference error:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเริ่ม Conference');
    }
  };

  // เพิ่มฟังก์ชันเพิ่มสายใน conference
  const handleAddToConference = () => {
    if (showConferenceBridge) {
      // แสดง Conference Bridge เพื่อเพิ่มผู้เข้าร่วม
      showConferenceBridge();
    } else if (addToConference) {
      addToConference();
    } else {
      Alert.alert('เพิ่มสาย', 'ฟีเจอร์เพิ่มสายยังไม่พร้อมใช้งาน');
    }
  };

  // เพิ่มฟังก์ชันออกจาก conference
  const handleLeaveConference = () => {
    Alert.alert('ออกจาก Conference', 'ต้องการออกจาก conference หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออก',
        onPress: () => {
          if (removeFromConference) {
            removeFromConference();
          } else {
            Alert.alert(
              'ออกจาก Conference',
              'ฟีเจอร์ออกจาก conference ยังไม่พร้อมใช้งาน',
            );
          }
        },
      },
    ]);
  };

  // เพิ่มฟังก์ชันเปิด modal จัดการ conference
  const handleConferenceManagement = () => {
    if (showConferenceBridge) {
      // แสดง Conference Bridge
      showConferenceBridge();
    } else {
      // Fallback เดิม
      setShowConferenceModal(true);
    }
  };

  const handleRecord = () => {
    Alert.alert('อัดเสียง', 'ฟีเจอร์อัดเสียงจะเพิ่มในภายหลัง');
  };

  // กำหนดสถานะการแสดงผลปกติ
  const getCallStatusText = () => {
    // ถ้ามีสถานะจาก callStatus ให้ใช้ค่านั้น แต่ถ้าไม่มีให้แสดงว่ากำลังเชื่อมต่อ
    return callStatus || 'กำลังเชื่อมต่อ...';
  };

  const getAvatarStyle = () => {
    return styles.avatarContainer;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {isInConference ? 'Conference Call' : 'กำลังโทร'}
        </Text>
        {isInConference && (
          <Text style={styles.conferenceCount}>
            {conferenceParticipants.length} สาย
          </Text>
        )}
      </View>

      {/* Call Info */}
      <View style={styles.callInfoContainer}>
        <View style={styles.avatarSection}>
          <View style={[getAvatarStyle(), { backgroundColor: getAvatarColor(getAvatarLetter()) }]}>
            <Text style={styles.avatarText}>
              {getAvatarLetter()}
            </Text>
          </View>
        </View>

        <View style={styles.callerInfoSection}>
          <Text style={styles.callerName}>
            {isInConference 
              ? `Conference Call (${conferenceParticipants.length} คน)`
              : getDisplayName()
            }
          </Text>

          {/* แสดงหมายเลขโทรแยกต่างหากถ้ามี contact */}
          {getCurrentContact() && (
            <Text style={styles.callerPhone}>{currentCallNumber}</Text>
          )}

          <Text style={styles.callStatus}>{getCallStatusText()}</Text>

          {isInCall && (
            <Text style={styles.callDuration}>{formatTime(callDuration)}</Text>
          )}
        </View>

        {/* แสดงรายชื่อสายใน conference พร้อมหมายเลขที่ชัดเจน */}
        {isInConference && conferenceParticipants.length > 0 && (
          <View style={styles.conferenceParticipants}>
            <Text style={styles.participantsTitle}>
              📞 หมายเลขใน Conference ({conferenceParticipants.length} คน):
            </Text>
            <View style={styles.participantsList}>
              {conferenceParticipants.map((participant, index) => (
                <View key={index} style={styles.participantItem}>
                  <Text style={styles.participantNumber}>
                    {participant.number}
                  </Text>
                  <Text style={styles.participantStatus}>
                    {participant.status === 'connected' ? '🟢' : 
                     participant.status === 'calling' ? '🟡' : '🔴'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* แสดงสถานะ Conference เพิ่มเติม */}
        {isInConference && (
          <View style={styles.conferenceInfo}>
            <Text style={styles.conferenceStatusText}>
              ✅ โหมด Conference เปิดใช้งาน - ทุกคนสามารถคุยกันได้
            </Text>
          </View>
        )}
      </View>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isMuted && styles.controlButtonActive,
            ]}
            onPress={handleMute}
          >
            <View
              style={[styles.controlIcon, isMuted && styles.controlIconActive]}
            >
              <FontAwesome
                name={isMuted ? 'microphone-slash' : 'microphone'}
                size={24}
                color="00000037"
              />
            </View>
            <Text style={styles.controlLabel}>
              {isMuted ? 'เปิดไมค์' : 'ปิดไมค์'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isSpeakerOn && styles.controlButtonActive,
            ]}
            onPress={handleSpeaker}
          >
            <View
              style={[
                styles.controlIcon,
                isSpeakerOn && styles.controlIconActive,
              ]}
            >
              <FontAwesome
                name={isSpeakerOn ? 'volume-up' : 'volume-off'}
                size={24}
                color="00000037"
              />
            </View>
            <Text style={styles.controlLabel}>
              {isSpeakerOn ? 'ปิดลำโพง' : 'เปิดลำโพง'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleTransfer}
          >
            <View style={styles.controlIcon}>
              <MaterialIcons name="transform" size={24} color="00000037" />
            </View>
            <Text style={styles.controlLabel}>โอนสาย</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.controlButton} onPress={handleRecord}>
            <View style={styles.controlIcon}>
              <MaterialCommunityIcons name="record" size={24} color="00000037" />
            </View>
            <Text style={styles.controlLabel}>อัดเสียง</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isHold && styles.controlButtonActive]}
            onPress={handleHold}
          >
            <View
              style={[styles.controlIcon, isHold && styles.controlIconActive]}
            >
              <MaterialIcons
                name={isHold ? 'play-arrow' : 'pause'}
                size={24}
                color="00000037"
              />
            </View>
            <Text style={styles.controlLabel}>
              {isHold ? 'ปลดพัก' : 'พักสาย'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isInConference && styles.controlButtonActive,
            ]}
            onPress={
              isInConference ? handleConferenceManagement : handleConference
            }
          >
            <View
              style={[
                styles.controlIcon,
                isInConference && styles.controlIconActive,
              ]}
            >
              <MaterialIcons name="people" size={24} color="00000037" />
            </View>
            <Text style={styles.controlLabel}>
              {isInConference ? 'จัดการ Conference' : 'Conference'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ปุ่มเพิ่มเติมสำหรับ conference */}
        {isInConference && (
          <View style={styles.conferenceControls}>
            <TouchableOpacity
              style={styles.conferenceButton}
              onPress={handleAddToConference}
            >
              <Text style={styles.conferenceButtonText}>➕ เพิ่มสาย</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.conferenceButton}
              onPress={handleLeaveConference}
            >
              <Text style={styles.conferenceButtonText}>
                ➖ ออกจาก Conference
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hangup Button */}
        <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
          <View style={styles.hangupIcon}>
            <MaterialCommunityIcons
              name="phone-hangup"
              size={36}
              color="#fff"
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Conference Management Modal */}
      {showConferenceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>จัดการ Conference</Text>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                สายที่เข้าร่วม ({conferenceParticipants.length})
              </Text>
              {conferenceParticipants.map((participant, index) => (
                <View key={index} style={styles.participantRow}>
                  <Text style={styles.participantText}>
                    {participant.number || participant}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      Alert.alert(
                        'ลบสาย',
                        `ต้องการลบ ${
                          participant.number || participant
                        } ออกจาก conference หรือไม่?`,
                        [
                          { text: 'ยกเลิก', style: 'cancel' },
                          {
                            text: 'ลบ',
                            onPress: () => {
                              // เรียกฟังก์ชันลบสาย (ต้อง implement ใน App.js)
                              if (removeFromConference) {
                                removeFromConference(participant);
                              }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={styles.removeButtonText}>❌</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addParticipantButton}
                onPress={handleAddToConference}
              >
                <Text style={styles.addParticipantText}>➕ เพิ่มสายใหม่</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowConferenceModal(false)}
            >
              <Text style={styles.closeModalText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 18,
    color: '#1A1B1E',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  callInfoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  avatarText: {
    fontSize: 64,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callerInfoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  callerName: {
    fontSize: 28,
    color: '#1A1B1E',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  callerPhone: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 15,
    textAlign: 'center',
  },
  callDuration: {
    fontSize: 20,
    color: '#4A90E2',
    fontWeight: '600',
    marginBottom: 10,
  },
  controlsContainer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
    backgroundColor: '#FFFFFF',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  controlButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10, // <-- เว้นขอบซ้าย-ขวาแต่ละปุ่ม
    marginVertical: 12, // <-- เว้นขอบบน-ล่างแต่ละปุ่ม
  },
  controlIcon: {
    marginBottom: 16, // เว้นระยะกับข้อความ
  },
  controlLabel: {
    fontSize: 13,
    color: '#1A1B1E',
    textAlign: 'center',
    fontWeight: '500',
  },
  controlButtonActive: {
    opacity: 0.85,
  },
  controlIconActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  hangupButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  hangupIcon: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 6,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#F08080',
  },
  hangupLabel: {
    fontSize: 15,
    color: '#E63946',
    fontWeight: '600',
    marginTop: 4,
  },
  conferenceCount: {
    fontSize: 14,
    color: '#4A90E2',
    marginTop: 4,
  },
  conferenceParticipants: {
    marginTop: 20,
    alignItems: 'center',
  },
  participantsTitle: {
    fontSize: 16,
    color: '#1A1B1E',
    marginBottom: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  participantsList: {
    alignItems: 'center',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  participantNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  participantStatus: {
    fontSize: 12,
  },
  conferenceInfo: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  conferenceStatusText: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '500',
    textAlign: 'center',
  },
  participant: {
    fontSize: 14,
    color: '#444',
    marginBottom: 5,
  },
  conferenceControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    marginBottom: 10,
  },
  conferenceButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  conferenceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    color: '#1A1B1E',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    fontWeight: '600',
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  participantText: {
    fontSize: 16,
    color: '#1A1B1E',
    flex: 1,
  },
  removeButtonText: {
    fontSize: 16,
    color: '#E63946',
  },
  addParticipantButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  addParticipantText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#E63946',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CallingScreen;
