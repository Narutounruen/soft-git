import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, FlatList, TextInput } from 'react-native';
import { AudioManager } from './AudioManager';

// ConferenceCallManager Component
const ConferenceCallManager = forwardRef(({
  endpointRef,
  accountRef,
  currentCallRef,
  config,
  isInCall,
  setIsInCall,
  setCallStatus,
  setCurrentCallRef,
  navigation
}, ref) => {
  // State สำหรับจัดการ conference
  const [isInConference, setIsInConference] = useState(false);
  const [conferenceParticipants, setConferenceParticipants] = useState([]);
  const [conferenceCallRef, setConferenceCallRef] = useState(null);
  const [showConferenceModal, setShowConferenceModal] = useState(false);
  const [newParticipantNumber, setNewParticipantNumber] = useState('');

  // Ref สำหรับเก็บ call ที่จะเพิ่มใน conference
  const pendingCallRef = useRef(null);

  // helper to resolve ref or plain object
  const resolve = (maybeRef) => (maybeRef && (maybeRef.current || maybeRef)) || null;

  // helper to try to unhold a call (many endpoints provide call.unhold() or ep.unholdCall)
  const tryUnhold = async (callObj) => {
    try {
      const ep = resolve(endpointRef);
      const call = callObj || resolve(currentCallRef);
      if (!call) return;

      if (typeof call.unhold === 'function') {
        await call.unhold();
        console.log('ℹ️ unhold via call.unhold()');
        return;
      }

      if (ep && typeof ep.unholdCall === 'function') {
        await ep.unholdCall(call);
        console.log('ℹ️ unhold via endpoint.unholdCall()');
        return;
      }

      // Some call objects use hold(false) or mute pattern
      if (typeof call.hold === 'function') {
        try {
          await call.hold(false);
          console.log('ℹ️ attempted call.hold(false) to unhold');
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.log('⚠️ tryUnhold failed:', e.message || e);
    }
  };

  // ฟังก์ชันสำหรับการทำงานร่วมกับ Conference Bridge
  const bridgeConferenceMode = async () => {
    try {
      console.log('🎯 เปิดใช้ Bridge Conference Mode...');
      
      // ตั้งค่าโหมด conference สำหรับทุก call
      const calls = [...conferenceParticipants, currentCallRef].filter(Boolean);
      
      for (const participant of calls) {
        const call = participant.callRef || participant;
        if (call) {
          // ตรวจสอบว่า call ไม่ได้ถูกพัก
          await tryUnhold(call);
          
          // ตั้งค่าให้เสียงผ่านไปยัง speaker
          const ep = resolve(endpointRef);
          if (ep && ep.setCallAudioRoute && typeof ep.setCallAudioRoute === 'function') {
            try {
              await ep.setCallAudioRoute(call, 'speaker');
            } catch (error) {
              console.log('ไม่สามารถตั้งค่า audio route ได้:', error.message);
            }
          }
        }
      }
      
      // เปิดโหมด speaker สำหรับ conference
      try {
        await AudioManager.enableSpeaker();
        console.log('✅ เปิด Speaker สำหรับ Conference สำเร็จ');
      } catch (error) {
        console.log('❌ ไม่สามารถเปิด Speaker ได้:', error.message);
      }
      
      setCallStatus('📞 Conference Bridge Mode เปิดใช้งานแล้ว');
      return true;
      
    } catch (error) {
      console.error('❌ Error enabling bridge conference mode:', error);
      setCallStatus('❌ ไม่สามารถเปิด Conference Bridge Mode ได้');
      return false;
    }
  };
  const startConference = async () => {
    // Resolve the actual call object (support both ref objects and plain values)
    const currentCall = resolve(currentCallRef);
    if (!currentCall) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return false;
    }

    try {
      console.log('🔄 เริ่ม Conference Call...');
      setCallStatus('กำลังเริ่ม Conference...');

      // สร้าง conference call ใหม่จากสายปัจจุบัน
      const ep = resolve(endpointRef);
      const acc = resolve(accountRef);

      if (!ep) throw new Error('Endpoint ไม่พร้อมใช้งาน');

      let conferenceCall = null;

      if (typeof ep.createConferenceCall === 'function') {
        // try to call with an explicit no-hold option if supported
        try {
          conferenceCall = await ep.createConferenceCall(acc, currentCall, { hold: false });
        } catch (e) {
          conferenceCall = await ep.createConferenceCall(acc, currentCall);
        }
      } else if (typeof ep.createConference === 'function') {
        try {
          conferenceCall = await ep.createConference(acc, currentCall, { hold: false });
        } catch (e) {
          conferenceCall = await ep.createConference(acc, currentCall);
        }
      } else {
        // Fallback: endpoint doesn't provide a conference creation API.
        // Use the current call as the 'conference root' and mark conference active.
        console.log('ℹ️ Endpoint ไม่มี createConference API — ใช้สายปัจจุบันเป็น conference root (fallback)');
        conferenceCall = currentCall;
      }

      if (conferenceCall) {
        setConferenceCallRef(conferenceCall);
        setIsInConference(true);

        // เพิ่มสายปัจจุบันเป็น participant แรก (ใช้ resolved currentCall)
        const getCurrentNumber = () => {
          try {
            // ลองดึงหมายเลขจากหลายแหล่ง
            if (currentCall && currentCall.getRemoteUri) {
              const remoteUri = currentCall.getRemoteUri();
              return remoteUri.split('@')[0].replace('sip:', '');
            }
            if (currentCallRef && currentCallRef.getRemoteUri) {
              const remoteUri = currentCallRef.getRemoteUri();
              return remoteUri.split('@')[0].replace('sip:', '');
            }
            if (currentCall && currentCall.remoteNumber) {
              return currentCall.remoteNumber;
            }
            if (currentCall && currentCall.remoteContact) {
              return currentCall.remoteContact.split('@')[0].replace('sip:', '');
            }
            if (currentCallRef && currentCallRef.remoteNumber) {
              return currentCallRef.remoteNumber;
            }
            // ถ้าไม่พบหมายเลข ใช้ค่าจาก call ID
            const callId = currentCall._callId || currentCall.id || (currentCallRef && (currentCallRef._callId || currentCallRef.id));
            return callId ? `Call-${callId}` : 'หมายเลขปัจจุบัน';
          } catch (error) {
            console.log('⚠️ ไม่สามารถดึงหมายเลขได้:', error.message);
            return 'หมายเลขปัจจุบัน';
          }
        };

        const participants = [{
          id: currentCall._callId || currentCall.id || (currentCallRef && (currentCallRef._callId || currentCallRef.id)) || String(Date.now()),
          number: getCurrentNumber(),
          callRef: currentCall || currentCallRef
        }];

        setConferenceParticipants(participants);
        setCallStatus('Conference เริ่มแล้ว');

        console.log('✅ Conference เริ่มสำเร็จ (fallback if needed)');
        return true;
      } else {
        throw new Error('ไม่สามารถสร้าง Conference ได้');
      }
    } catch (error) {
      console.error('❌ Error starting conference:', error);
      setCallStatus('ไม่สามารถเริ่ม Conference ได้');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเริ่ม Conference ได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันเพิ่มสายใหม่ใน conference
  const addToConference = async (participantNumber) => {
    if (!participantNumber || !participantNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการเพิ่ม');
      return false;
    }

    if (!isInConference || !conferenceCallRef) {
      Alert.alert('ข้อผิดพลาด', 'ยังไม่ได้เริ่ม Conference');
      return false;
    }

    try {
      console.log(`🔄 เพิ่มสาย ${participantNumber} ใน Conference...`);
      setCallStatus(`กำลังเพิ่ม ${participantNumber}...`);

      // สร้าง URI สำหรับสายใหม่
      const domain = config.domain || 'your-sip-domain.com';
      const targetUri = participantNumber.includes('@') 
        ? participantNumber 
        : `sip:${participantNumber.trim()}@${domain}`;

  // โทรไปหาหมายเลขใหม่
  const ep = resolve(endpointRef);
  const acc = resolve(accountRef);
  if (!ep) throw new Error('Endpoint ไม่พร้อมใช้งาน');

  const makeCallFn = ep.makeCall || ep.call || ep.startCall;
  if (!makeCallFn) throw new Error('Endpoint ไม่มีฟังก์ชันสำหรับโทรออก');

  const newCall = await makeCallFn.call(ep, acc, targetUri);
      
      if (newCall) {
        // รอให้สายใหม่เชื่อมต่อ
        const checkConnection = () => {
          if (newCall.state === 'PJSIP_INV_STATE_CONFIRMED') {
            // เชื่อมต่อสายใหม่กับ conference
            const epConnect = ep.conferenceConnect || ep.connectConference || ep.addToConference;
            if (!epConnect) throw new Error('Endpoint ไม่มีฟังก์ชันเชื่อมต่อ conference');

            // try non-hold connect options first
            const tryConnect = async () => {
              try {
                if (epConnect.length >= 3) {
                  // some implementations accept options as third arg
                  return await epConnect.call(ep, conferenceCallRef, newCall, { hold: false });
                }
                return await epConnect.call(ep, conferenceCallRef, newCall);
              } catch (e) {
                // fallback to basic call
                return await epConnect.call(ep, conferenceCallRef, newCall);
              }
            };

                tryConnect()
                  .then(async () => {
                    console.log('✅ เชื่อมต่อสายใหม่กับ Conference สำเร็จ');

                    // เพิ่มในรายชื่อ participants
                    const newParticipant = {
                      id: newCall._callId || newCall.id || Date.now().toString(),
                      number: participantNumber.trim(),
                      callRef: newCall
                    };

                    setConferenceParticipants(prev => [...prev, newParticipant]);
                    setCallStatus(`📞 ${participantNumber} เข้าร่วม Conference แล้ว - รวม ${conferenceParticipants.length + 1} สาย`);

                    // พยายาม unhold สายเดิมและสายใหม่ ถ้า endpoint/SDK ทำการ hold อัตโนมัติ
                    try {
                      await tryUnhold(newCall);
                      await tryUnhold(conferenceCallRef || resolve(currentCallRef));
                    } catch (e) {
                      console.log('⚠️ Failed to unhold after connect:', e);
                    }

                    // เคลียร์ pending call
                    pendingCallRef.current = null;
                  })
              .catch((error) => {
                console.error('❌ Error connecting to conference:', error);
                setCallStatus('ไม่สามารถเพิ่มสายใน Conference ได้');
                Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเพิ่มสายใน Conference ได้');
                
                // วางสายใหม่ถ้าเชื่อมต่อไม่ได้
                if (newCall && typeof newCall.hangup === 'function') {
                  newCall.hangup();
                }
              });
          } else if (newCall.state === 'PJSIP_INV_STATE_DISCONNECTED') {
            // สายใหม่ถูกปฏิเสธหรือไม่รับสาย
            console.log('❌ สายใหม่ถูกตัดหรือไม่รับสาย');
            setCallStatus(`${participantNumber} ไม่รับสาย`);
            Alert.alert('ไม่รับสาย', `${participantNumber} ไม่รับสาย`);
            pendingCallRef.current = null;
          } else {
            // ยังรออยู่ ตรวจสอบอีกครั้งใน 1 วินาที
            setTimeout(checkConnection, 1000);
          }
        };

        // เริ่มตรวจสอบการเชื่อมต่อ
        setTimeout(checkConnection, 1000);
        
        // เก็บ reference ของสายใหม่
        pendingCallRef.current = newCall;
        
        return true;
      } else {
        throw new Error('ไม่สามารถโทรไปหาหมายเลขใหม่ได้');
      }
    } catch (error) {
      console.error('❌ Error adding to conference:', error);
      setCallStatus('ไม่สามารถเพิ่มสายใน Conference ได้');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเพิ่มสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันลบสายออกจาก conference
  const removeFromConference = async (participant) => {
    if (!participant || !participant.callRef) {
      Alert.alert('ข้อผิดพลาด', 'ไม่พบสายที่ต้องการลบ');
      return false;
    }

    try {
      console.log(`🔄 ลบสาย ${participant.number} ออกจาก Conference...`);
      setCallStatus(`กำลังลบ ${participant.number}...`);

      // ถอดสายออกจาก conference
      const ep = resolve(endpointRef);
      const epDisconnect = ep && (ep.conferenceDisconnect || ep.disconnectConference || ep.removeFromConference);
      if (epDisconnect) {
        await epDisconnect.call(ep, conferenceCallRef, participant.callRef);
      }

      // วางสายของ participant
      if (participant.callRef && typeof participant.callRef.hangup === 'function') {
        await participant.callRef.hangup();
      }

      // ลบออกจากรายชื่อ
      setConferenceParticipants(prev => 
        prev.filter(p => p.id !== participant.id)
      );

      setCallStatus(`${participant.number} ออกจาก Conference แล้ว`);
      console.log('✅ ลบสายออกจาก Conference สำเร็จ');
      
      return true;
    } catch (error) {
      console.error('❌ Error removing from conference:', error);
      setCallStatus('ไม่สามารถลบสายออกจาก Conference ได้');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถลบสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันสิ้นสุด conference
  const endConference = async () => {
    try {
      console.log('🔄 สิ้นสุด Conference...');
      setCallStatus('กำลังสิ้นสุด Conference...');

      // วางสายทั้งหมดใน conference
      for (const participant of conferenceParticipants) {
        if (participant.callRef && typeof participant.callRef.hangup === 'function') {
          try {
            await participant.callRef.hangup();
          } catch (error) {
            console.log(`⚠️ Error hanging up ${participant.number}:`, error);
          }
        }
      }

      // วางสาย conference หลัก
      if (conferenceCallRef && typeof conferenceCallRef.hangup === 'function') {
        await conferenceCallRef.hangup();
      }

      // รีเซ็ต state
      setIsInConference(false);
      setConferenceParticipants([]);
      setConferenceCallRef(null);
      setIsInCall(false);
      setCurrentCallRef(null);
      
      // รีเซ็ต audio mode
      AudioManager.resetAudioMode();
      
      setCallStatus('Conference สิ้นสุดแล้ว');
      
      // กลับไปหน้า Softphone
      if (navigation) {
        navigation.navigate('Softphone');
      }
      
      console.log('✅ Conference สิ้นสุดสำเร็จ');
      return true;
    } catch (error) {
      console.error('❌ Error ending conference:', error);
      setCallStatus('เกิดข้อผิดพลาดในการสิ้นสุด Conference');
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสิ้นสุด Conference');
      return false;
    }
  };

  // เปิดให้ parent เรียกใช้งานผ่าน ref
  useImperativeHandle(ref, () => ({
    startConference,
    addToConference,
    removeFromConference,
    endConference,
    bridgeConferenceMode,
    get isInConference() { return isInConference; },
    get conferenceParticipants() { return conferenceParticipants; }
  }), [startConference, addToConference, removeFromConference, endConference, bridgeConferenceMode, isInConference, conferenceParticipants]);

  // ฟังก์ชันเปิด modal เพิ่มสาย
  const openAddParticipantModal = () => {
    setShowConferenceModal(true);
  };

  // ฟังก์ชันปิด modal
  const closeModal = () => {
    setShowConferenceModal(false);
    setNewParticipantNumber('');
  };

  // ฟังก์ชันยืนยันเพิ่มสาย
  const confirmAddParticipant = () => {
    if (newParticipantNumber.trim()) {
      addToConference(newParticipantNumber.trim());
      closeModal();
    } else {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลข');
    }
  };

  // ฟังก์ชันจัดการเมื่อสายใน conference ถูกตัด
  const handleParticipantDisconnected = (callId) => {
    console.log(`🔄 สาย ${callId} ถูกตัดออกจาก Conference`);
    
    // ลบออกจากรายชื่อ
    setConferenceParticipants(prev => 
      prev.filter(p => p.id !== callId)
    );
    
    // ถ้าไม่มีสายเหลือแล้ว สิ้นสุด conference
    if (conferenceParticipants.length <= 1) {
      console.log('⚠️ ไม่มีสายเหลือใน Conference สิ้นสุดอัตโนมัติ');
      endConference();
    }
  };

  // Effect สำหรับจัดการ event ของสายใน conference
  useEffect(() => {
    const ep = resolve(endpointRef);
    if (!ep || !ep.on) return;

    const handleCallChanged = (call) => {
      const callInfo = call?._callInfo || call;
      const state = callInfo?.state || call?.state;
      const callId = call?._callId || call?.id || call?.callId || 'unknown';

      if (state === 'PJSIP_INV_STATE_DISCONNECTED' || state === 'DISCONNECTED') {
        // ตรวจสอบว่าสายนี้อยู่ใน conference หรือไม่
        const participant = conferenceParticipants.find(p => p.id === callId);
        if (participant) {
          handleParticipantDisconnected(callId);
        }
      }
    };

    // เพิ่ม event listener
    ep.on('call_changed', handleCallChanged);

    // Cleanup
    return () => {
      if (ep && ep.removeListener) {
        ep.removeListener('call_changed', handleCallChanged);
      }
    };
  }, [endpointRef, conferenceParticipants]);

  // ถ้าไม่ได้อยู่ใน conference ไม่แสดงอะไร
  if (!isInConference) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Conference Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusInfo}>
          <Text style={styles.statusText}>
            Conference ({conferenceParticipants.length} สาย)
          </Text>
          <Text style={styles.participantNumbers}>
            หมายเลข: {conferenceParticipants.map(p => p.number).join(', ')}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.endConferenceButton}
          onPress={() => {
            Alert.alert(
              'สิ้นสุด Conference',
              'ต้องการสิ้นสุด Conference หรือไม่?',
              [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'สิ้นสุด', onPress: endConference }
              ]
            );
          }}
        >
          <Text style={styles.endConferenceText}>สิ้นสุด</Text>
        </TouchableOpacity>
      </View>

      {/* Participants List */}
      <FlatList
        data={conferenceParticipants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantNumber}>📞 {item.number}</Text>
              <Text style={styles.participantStatus}>
                {item.callRef && item.callRef.state ? 
                  (item.callRef.state === 'PJSIP_INV_STATE_CONFIRMED' ? '🟢 เชื่อมต่อแล้ว' : '🟡 กำลังเชื่อมต่อ') : 
                  '🟢 ในการประชุม'
                }
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => {
                Alert.alert(
                  'ลบสาย',
                  `ต้องการลบ ${item.number} ออกจาก Conference หรือไม่?`,
                  [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'ลบ', onPress: () => removeFromConference(item) }
                  ]
                );
              }}
            >
              <Text style={styles.removeButtonText}>❌</Text>
            </TouchableOpacity>
          </View>
        )}
        style={styles.participantsList}
      />

      {/* Add Participant Button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={openAddParticipantModal}
      >
        <Text style={styles.addButtonText}>➕ เพิ่มสาย</Text>
      </TouchableOpacity>

      {/* Add Participant Modal */}
      {showConferenceModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เพิ่มสายใน Conference</Text>
            
            <TextInput
              style={styles.input}
              placeholder="หมายเลขที่ต้องการเพิ่ม"
              value={newParticipantNumber}
              onChangeText={setNewParticipantNumber}
              keyboardType="phone-pad"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>ยกเลิก</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmAddParticipant}
              >
                <Text style={styles.confirmButtonText}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1B1E',
    padding: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#2A2B2E',
    padding: 15,
    borderRadius: 10,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  participantNumbers: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '500',
  },
  endConferenceButton: {
    backgroundColor: '#E63946',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endConferenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  participantsList: {
    flex: 1,
    marginBottom: 20,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2B2E',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  participantInfo: {
    flex: 1,
  },
  participantNumber: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  participantStatus: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  participantText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  removeButton: {
    padding: 5,
  },
  removeButtonText: {
    fontSize: 16,
    color: '#E63946',
  },
  addButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2A2B2E',
    borderRadius: 15,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#3A3B3E',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  cancelButton: {
    backgroundColor: '#6C757D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConferenceCallManager;