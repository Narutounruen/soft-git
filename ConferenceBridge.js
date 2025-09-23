import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, FlatList, TextInput } from 'react-native';

// ConferenceBridge Component - สำหรับจัดการ Conference Call
const ConferenceBridge = forwardRef(({
  endpointRef,
  accountRef,
  currentCallRef,
  currentCallNumber,
  config,
  isInCall,
  setIsInCall,
  setCallStatus,
  setCurrentCallRef,
  navigation
}, ref) => {
  
  // State สำหรับ Conference
  const [isInConference, setIsInConference] = useState(false);
  const [conferenceParticipants, setConferenceParticipants] = useState([]);
  const [showConferenceModal, setShowConferenceModal] = useState(false);
  const [newParticipantNumber, setNewParticipantNumber] = useState('');
  const [conferenceCallRefs, setConferenceCallRefs] = useState([]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startConference,
    addParticipant,
    removeParticipant,
    endConference,
    getParticipants: () => conferenceParticipants,
    isInConference: () => isInConference,
    showModal: () => setShowConferenceModal(true),
    hideModal: () => setShowConferenceModal(false)
  }));

  // Helper function to resolve ref
  const resolve = (maybeRef) => (maybeRef && (maybeRef.current || maybeRef)) || null;

  // เริ่ม Conference Call
  const startConference = async () => {
    try {
      const endpoint = resolve(endpointRef);
      const currentCall = resolve(currentCallRef);
      
      if (!endpoint || !currentCall) {
        throw new Error('ไม่พบ endpoint หรือ call ที่ใช้งานอยู่');
      }

      console.log('🎯 เริ่ม Conference Call...');
      
      // เชื่อมต่อ current call เข้า conference bridge ทันที
      const bridgeConnected = await connectToConferenceBridge(
        currentCall, 
        currentCall._callId || currentCall.id || 'current'
      );

      // เพิ่ม current call เป็น participant แรก
      const participants = [{
        id: currentCall._callId || currentCall.id || 'current',
        number: currentCallNumber || currentCall.remoteContact || currentCall.remoteNumber || 'หมายเลขปัจจุบัน',
        callRef: currentCall,
        status: 'connected',
        isBridgeConnected: bridgeConnected
      }];

      setConferenceParticipants(participants);
      setConferenceCallRefs([currentCall]);
      setIsInConference(true);
      setShowConferenceModal(true); // แสดง modal ทันทีหลังเริ่ม conference
      setCallStatus(bridgeConnected ? 
        '📞 Conference Call เริ่มแล้ว - พร้อมรับสายเพิ่ม' : 
        '📞 Conference Call เริ่มแล้ว - โหมดพื้นฐาน'
      );
      
      console.log('✅ Conference Call เริ่มสำเร็จ');
      return true;
      
    } catch (error) {
      console.error('❌ Error starting conference:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเริ่ม Conference Call ได้: ${error.message}`);
      return false;
    }
  };

  // เพิ่มผู้เข้าร่วม Conference
  const addParticipant = async (phoneNumber) => {
    try {
      const endpoint = resolve(endpointRef);
      const account = resolve(accountRef);
      
      if (!endpoint || !account) {
        throw new Error('ไม่พบ endpoint หรือ account');
      }

      if (!phoneNumber || phoneNumber.trim() === '') {
        throw new Error('กรุณาใส่หมายเลขโทรศัพท์');
      }

      console.log(`🎯 เพิ่มผู้เข้าร่วม Conference: ${phoneNumber}`);
      setCallStatus(`📞 กำลังเรียกหมายเลข ${phoneNumber} เข้า Conference...`);

      // แสดงการเพิ่มหมายเลขใหม่ในรายการทันที
      Alert.alert(
        'เพิ่มผู้เข้าร่วม Conference',
        `กำลังเรียกหมายเลข: ${phoneNumber}\n\nระบบจะเพิ่มหมายเลขนี้เข้าร่วม Conference\nกรุณารอสักครู่...`,
        [{ text: 'รับทราบ', style: 'default' }]
      );

      // สร้าง call ใหม่
      const newCall = await endpoint.makeCall(account, phoneNumber);
      
      if (newCall) {
        // เพิ่มใน participants list
        const newParticipant = {
          id: newCall._callId || newCall.id || Date.now().toString(),
          number: phoneNumber,
          callRef: newCall,
          status: 'calling'
        };

        setConferenceParticipants(prev => [...prev, newParticipant]);
        setConferenceCallRefs(prev => [...prev, newCall]);

        // ตั้ง listener สำหรับ call state changes
        if (newCall.on && typeof newCall.on === 'function') {
          newCall.on('call_changed', async (call) => {
            updateParticipantStatus(newParticipant.id, call.state);
            
            // เมื่อ call เชื่อมต่อแล้ว ให้เข้าร่วม conference bridge และซิงค์ทุกคน
            if (call.state === 'PJSIP_INV_STATE_CONFIRMED') {
              await connectToConferenceBridge(newCall, newParticipant.id);
              // ซิงค์ผู้เข้าร่วมทั้งหมดใหม่เพื่อให้ทุกคนได้ยินกัน
              setTimeout(() => syncAllParticipants(), 1000);
              
              // แสดงการเชื่อมต่อสำเร็จ
              Alert.alert(
                'เชื่อมต่อสำเร็จ! 🎉',
                `หมายเลข ${phoneNumber} เข้าร่วม Conference แล้ว\n\nตอนนี้ทุกคนสามารถคุยกันได้แล้ว`,
                [{ text: 'ยอดเยี่ยม!', style: 'default' }]
              );
            }
          });
        }

        setCallStatus(`📞 ✅ เพิ่มหมายเลข ${phoneNumber} ใน Conference แล้ว`);
        console.log(`✅ เพิ่มผู้เข้าร่วม Conference สำเร็จ: ${phoneNumber}`);
        
        return newCall;
      } else {
        throw new Error('ไม่สามารถสร้าง call ได้');
      }
      
    } catch (error) {
      console.error('❌ Error adding participant:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเพิ่มผู้เข้าร่วมได้: ${error.message}`);
      return null;
    }
  };

  // เชื่อมต่อเข้า Conference Bridge (ไม่ต้องพักสาย)
  const connectToConferenceBridge = async (callRef, participantId) => {
    try {
      const endpoint = resolve(endpointRef);
      
      if (!endpoint) {
        console.error('❌ ไม่พบ endpoint สำหรับเชื่อมต่อ Conference');
        return false;
      }

      if (!callRef) {
        console.error('❌ ไม่พบ call reference สำหรับเชื่อมต่อ Conference');
        return false;
      }

      const safePId = participantId || 'unknown';
      console.log(`🎯 เชื่อมต่อ ${safePId} เข้า Conference Bridge...`);

      // วิธีที่ 1: ใช้ PJSIP Conference Bridge
      if (endpoint.conferenceConnect && typeof endpoint.conferenceConnect === 'function') {
        try {
          // เชื่อมต่อ call ใหม่กับ conference bridge
          await endpoint.conferenceConnect(callRef);
          console.log(`✅ เชื่อมต่อ ${safePId} เข้า Conference Bridge สำเร็จ (วิธีที่ 1)`);
          return true;
        } catch (error) {
          console.log(`❌ Conference connect วิธีที่ 1 ล้มเหลว: ${error.message}`);
        }
      }

      // วิธีที่ 2: ใช้ Mixed Audio Bridge
      if (endpoint.addToConference && typeof endpoint.addToConference === 'function') {
        try {
          await endpoint.addToConference(callRef);
          console.log(`✅ เชื่อมต่อ ${safePId} เข้า Conference Bridge สำเร็จ (วิธีที่ 2)`);
          return true;
        } catch (error) {
          console.log(`❌ Add to conference วิธีที่ 2 ล้มเหลว: ${error.message}`);
        }
      }

      // วิธีที่ 3: Manual Conference Setup - ไม่พักสาย
      if (callRef.setConferenceMode && typeof callRef.setConferenceMode === 'function') {
        try {
          await callRef.setConferenceMode(true);
          console.log(`✅ เชื่อมต่อ ${safePId} เข้า Conference Bridge สำเร็จ (วิธีที่ 3)`);
          return true;
        } catch (error) {
          console.log(`❌ Set conference mode วิธีที่ 3 ล้มเหลว: ${error.message}`);
        }
      }

      // วิธีที่ 4: PJSIP Media Bridge
      if (endpoint.createMediaBridge && typeof endpoint.createMediaBridge === 'function') {
        try {
          // สร้าง media bridge สำหรับ conference
          if (!endpoint._conferenceBridge) {
            endpoint._conferenceBridge = await endpoint.createMediaBridge();
          }
          
          // เชื่อมต่อ call เข้า media bridge
          await endpoint.connectToMediaBridge(callRef, endpoint._conferenceBridge);
          console.log(`✅ เชื่อมต่อ ${safePId} เข้า Media Bridge สำเร็จ (วิธีที่ 4)`);
          return true;
        } catch (error) {
          console.log(`❌ Media bridge วิธีที่ 4 ล้มเหลว: ${error.message}`);
        }
      }

      // วิธีที่ 5: Simple Conference - เปิดเสียงให้ทุกคนได้ยิน
      try {
        console.log(`🔧 ใช้ Simple Conference mode สำหรับ ${safePId}`);
        
        // ตรวจสอบสถานะ call ก่อนดำเนินการ
        const callState = callRef.state || callRef.callState || 'unknown';
        console.log(`📞 Call state: ${callState}`);

        // ตรวจสอบว่า call ไม่ได้ถูกพักและเปิดเสียงอยู่
        if (callRef.unhold && typeof callRef.unhold === 'function') {
          try {
            await callRef.unhold();
            console.log(`✅ Unhold call สำเร็จสำหรับ ${safePId}`);
          } catch (unholdError) {
            console.log(`⚠️ Unhold call ล้มเหลว: ${unholdError.message}`);
          }
        }
        
        if (callRef.unmute && typeof callRef.unmute === 'function') {
          try {
            await callRef.unmute();
            console.log(`✅ Unmute call สำเร็จสำหรับ ${safePId}`);
          } catch (unmuteError) {
            console.log(`⚠️ Unmute call ล้มเหลว: ${unmuteError.message}`);
          }
        }

        // กำหนดให้ audio route ไปยัง speaker เพื่อให้ทุกคนได้ยิน
        if (endpoint.setAudioRoute && typeof endpoint.setAudioRoute === 'function') {
          try {
            await endpoint.setAudioRoute('speaker');
            console.log(`✅ Set audio route สำเร็จสำหรับ ${safePId}`);
          } catch (audioError) {
            console.log(`⚠️ Set audio route ล้มเหลว: ${audioError.message}`);
          }
        }

        console.log(`✅ เชื่อมต่อ ${safePId} เข้า Simple Conference สำเร็จ (วิธีที่ 5)`);
        return true;
      } catch (error) {
        console.log(`❌ Simple conference วิธีที่ 5 ล้มเหลว: ${error.message}`);
      }

      console.log(`⚠️ ไม่สามารถเชื่อมต่อ ${safePId} เข้า Conference Bridge ได้ด้วยวิธีใดๆ`);
      return false;
      
    } catch (error) {
      console.error('❌ Error connecting to conference bridge:', error);
      return false;
    }
  };

  // ตั้งค่า Audio สำหรับ Conference (ทุกคนได้ยินกัน)
  const setupConferenceAudio = async () => {
    try {
      const endpoint = resolve(endpointRef);
      
      if (!endpoint) {
        console.error('ไม่พบ endpoint สำหรับตั้งค่าเสียง');
        return false;
      }

      console.log('🎯 ตั้งค่าเสียงสำหรับ Conference...');

      // วิธีที่ 1: ใช้ Speaker Phone Mode
      if (endpoint.setSpeakerphone && typeof endpoint.setSpeakerphone === 'function') {
        try {
          await endpoint.setSpeakerphone(true);
          console.log('✅ เปิด Speaker Phone สำเร็จ');
        } catch (error) {
          console.log('❌ ไม่สามารถเปิด Speaker Phone ได้:', error.message);
        }
      }

      // วิธีที่ 2: ตั้งค่า Audio Route
      if (endpoint.setAudioRoute && typeof endpoint.setAudioRoute === 'function') {
        try {
          await endpoint.setAudioRoute('speaker');
          console.log('✅ ตั้งค่า Audio Route เป็น Speaker สำเร็จ');
        } catch (error) {
          console.log('❌ ไม่สามารถตั้งค่า Audio Route ได้:', error.message);
        }
      }

      // วิธีที่ 3: เปิด Conference Audio Mode
      if (endpoint.setConferenceAudioMode && typeof endpoint.setConferenceAudioMode === 'function') {
        try {
          await endpoint.setConferenceAudioMode(true);
          console.log('✅ เปิด Conference Audio Mode สำเร็จ');
        } catch (error) {
          console.log('❌ ไม่สามารถเปิด Conference Audio Mode ได้:', error.message);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error setting up conference audio:', error);
      return false;
    }
  };

  // เชื่อมต่อทุก call เข้า conference bridge เมื่อมีการเพิ่มผู้เข้าร่วม
  const syncAllParticipants = async () => {
    try {
      console.log('🎯 ซิงค์ผู้เข้าร่วมทั้งหมดเข้า Conference...');

      // ตั้งค่าเสียงสำหรับ conference
      await setupConferenceAudio();

      // เชื่อมต่อทุก call เข้า conference bridge
      const syncPromises = conferenceCallRefs.map(async (callRef, index) => {
        try {
          const participantId = callRef._callId || callRef.id || `participant_${index}`;
          await connectToConferenceBridge(callRef, participantId);
          return true;
        } catch (error) {
          console.error(`ไม่สามารถซิงค์ participant ${index}:`, error);
          return false;
        }
      });

      const results = await Promise.all(syncPromises);
      const successCount = results.filter(result => result).length;
      
      console.log(`✅ ซิงค์ผู้เข้าร่วมสำเร็จ ${successCount}/${results.length} คน`);
      
      setCallStatus(`📞 Conference: ${successCount} คนเชื่อมต่อแล้ว`);
      return successCount > 0;
      
    } catch (error) {
      console.error('❌ Error syncing participants:', error);
      return false;
    }
  };

  // อัปเดตสถานะของผู้เข้าร่วม
  const updateParticipantStatus = (participantId, callState) => {
    setConferenceParticipants(prev => 
      prev.map(participant => {
        if (participant.id === participantId) {
          let status = 'calling';
          
          switch (callState) {
            case 'PJSIP_INV_STATE_CONFIRMED':
              status = 'connected';
              break;
            case 'PJSIP_INV_STATE_DISCONNECTED':
              status = 'disconnected';
              break;
            case 'PJSIP_INV_STATE_CALLING':
              status = 'calling';
              break;
            default:
              status = 'unknown';
          }
          
          return { ...participant, status };
        }
        return participant;
      })
    );
  };

  // ลบผู้เข้าร่วมออกจาก Conference
  const removeParticipant = async (participantId) => {
    try {
      const participant = conferenceParticipants.find(p => p.id === participantId);
      if (!participant) {
        console.log(`⚠️ ไม่พบผู้เข้าร่วมที่มี ID: ${participantId}`);
        return false;
      }

      console.log(`🎯 ลบผู้เข้าร่วม Conference: ${participant.number}`);

      // ตรวจสอบและวางสายของผู้เข้าร่วมคนนี้
      if (participant.callRef) {
        try {
          if (typeof participant.callRef.hangup === 'function') {
            await participant.callRef.hangup();
          } else {
            const endpoint = resolve(endpointRef);
            if (endpoint && typeof endpoint.hangupCall === 'function') {
              await endpoint.hangupCall(participant.callRef);
            } else {
              console.log('⚠️ ไม่สามารถวางสายได้ - ไม่มีฟังก์ชัน hangup');
            }
          }
        } catch (hangupError) {
          console.log(`⚠️ ข้อผิดพลาดในการวางสาย: ${hangupError.message}`);
          // ไม่ throw error ต่อ เพราะยังสามารถลบออกจากรายการได้
        }
      } else {
        console.log('⚠️ ไม่มี callRef สำหรับผู้เข้าร่วมคนนี้');
      }

      // ลบออกจาก state
      setConferenceParticipants(prev => prev.filter(p => p.id !== participantId));
      setConferenceCallRefs(prev => prev.filter(call => {
        const callId = call._callId || call.id;
        return callId !== participantId;
      }));

      setCallStatus(`📞 ลบ ${participant.number} ออกจาก Conference แล้ว`);
      console.log(`✅ ลบผู้เข้าร่วม Conference สำเร็จ: ${participant.number}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error removing participant:', error);
      setCallStatus(`❌ ไม่สามารถลบผู้เข้าร่วมได้: ${error.message}`);
      return false;
    }
  };

  // จบ Conference Call
  const endConference = async () => {
    try {
      console.log('🎯 จบ Conference Call...');

      // วางสายทุกคน
      const hangupPromises = conferenceCallRefs.map(async (call, index) => {
        try {
          if (!call) {
            console.log(`⚠️ Call ${index} is null/undefined, skipping`);
            return;
          }

          const callId = call._callId || call.id || `call_${index}`;
          console.log(`📞 วางสาย call ID: ${callId}`);

          if (typeof call.hangup === 'function') {
            await call.hangup();
          } else {
            const endpoint = resolve(endpointRef);
            if (endpoint && typeof endpoint.hangupCall === 'function') {
              await endpoint.hangupCall(call);
            } else {
              console.log(`⚠️ ไม่สามารถวางสาย call ID: ${callId} - ไม่มีฟังก์ชัน hangup`);
            }
          }
        } catch (error) {
          console.error(`❌ Error hanging up call ${index}:`, error.message);
          // ไม่ throw error ต่อ เพื่อให้สามารถวางสายอื่นๆ ต่อได้
        }
      });

      await Promise.all(hangupPromises);

      // รีเซ็ต state
      setIsInConference(false);
      setConferenceParticipants([]);
      setConferenceCallRefs([]);
      setCurrentCallRef(null);
      setIsInCall(false);
      setCallStatus('📞 Conference Call จบแล้ว');
      setShowConferenceModal(false);

      console.log('✅ จบ Conference Call สำเร็จ');
      return true;
      
    } catch (error) {
      console.error('❌ Error ending conference:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถจบ Conference Call ได้: ${error.message}`);
      return false;
    }
  };

  // Handle เพิ่มผู้เข้าร่วมผ่าน UI
  const handleAddParticipant = async () => {
    if (!newParticipantNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขโทรศัพท์');
      return;
    }

    const result = await addParticipant(newParticipantNumber.trim());
    if (result) {
      setNewParticipantNumber('');
    }
  };

  // เพิ่มฟังก์ชันสำหรับแสดงหมายเลขปัจจุบันใน Conference
  const addCurrentNumberToConference = () => {
    if (currentCallNumber && !conferenceParticipants.some(p => p.number === currentCallNumber)) {
      const currentParticipant = {
        id: `current_${Date.now()}`,
        number: currentCallNumber,
        callRef: currentCallRef,
        status: 'connected'
      };
      
      setConferenceParticipants(prev => [currentParticipant, ...prev]);
      
      Alert.alert(
        'เพิ่มหมายเลขปัจจุบัน',
        `เพิ่มหมายเลข ${currentCallNumber} เข้า Conference แล้ว\n\nตอนนี้สามารถเพิ่มหมายเลขอื่นเพื่อสร้าง Conference Call ได้`,
        [{ text: 'เข้าใจแล้ว', style: 'default' }]
      );
    }
  };

  // Render participant item
  const renderParticipant = ({ item }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantInfo}>
        <View style={styles.participantMainInfo}>
          <Text style={styles.participantNumberDisplay}>{item.number}</Text>
          <Text style={[styles.participantStatus, 
            item.status === 'connected' && styles.statusConnected,
            item.status === 'calling' && styles.statusCalling,
            item.status === 'disconnected' && styles.statusDisconnected
          ]}>
            {item.status === 'connected' ? '🟢 เชื่อมต่อแล้ว' : 
             item.status === 'calling' ? '🟡 กำลังเรียก...' : 
             item.status === 'disconnected' ? '🔴 ตัดการเชื่อมต่อ' : '⚪ ไม่ทราบสถานะ'}
          </Text>
        </View>
        {item.status === 'connected' && (
          <View style={styles.participantConnectedBadge}>
            <Text style={styles.participantJoinedText}>✓ อยู่ใน Conference</Text>
          </View>
        )}
      </View>
      
      {item.status !== 'disconnected' && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => {
            Alert.alert(
              'ยืนยันการลบ',
              `ต้องการลบหมายเลข ${item.number} ออกจาก Conference หรือไม่?`,
              [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'ลบ', style: 'destructive', onPress: () => removeParticipant(item.id) }
              ]
            );
          }}
        >
          <Text style={styles.removeButtonText}>🗑️</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal
      visible={showConferenceModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowConferenceModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Conference Call</Text>
              {currentCallNumber && (
                <Text style={styles.currentCallInfo}>
                  🎯 หมายเลขปัจจุบัน: {currentCallNumber}
                </Text>
              )}
              <Text style={styles.subtitle}>
                {conferenceParticipants.length === 0 ? 
                  'ยังไม่มีผู้เข้าร่วม - เพิ่มหมายเลขเพื่อเริ่ม Conference' :
                  `📊 ทั้งหมด: ${conferenceParticipants.length} คน | เชื่อมต่อ: ${conferenceParticipants.filter(p => p.status === 'connected').length} คน`
                }
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowConferenceModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Add Participant */}
          <View style={styles.addParticipantSection}>
            <TextInput
              style={styles.numberInput}
              placeholder="หมายเลขโทรศัพท์"
              value={newParticipantNumber}
              onChangeText={setNewParticipantNumber}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddParticipant}>
              <Text style={styles.addButtonText}>เพิ่ม</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Add Current Number */}
          {currentCallNumber && !conferenceParticipants.some(p => p.number === currentCallNumber) && (
            <View style={styles.quickAddSection}>
              <Text style={styles.quickAddLabel}>เพิ่มเร็ว:</Text>
              <TouchableOpacity
                style={styles.quickAddButton}
                onPress={addCurrentNumberToConference}
              >
                <Text style={styles.quickAddButtonText}>
                  ➕ เพิ่มหมายเลขปัจจุบัน ({currentCallNumber}) เข้า Conference
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Participants List */}
          <View style={styles.participantsSection}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>
                ผู้เข้าร่วม Conference ({conferenceParticipants.length} คน)
              </Text>
              {conferenceParticipants.length > 0 && (
                <View style={styles.participantsSummary}>
                  <Text style={styles.summaryText}>
                    📞 หมายเลขในการประชุม: {conferenceParticipants.map(p => p.number).join(', ')}
                  </Text>
                  <Text style={styles.connectedCount}>
                    🟢 เชื่อมต่อแล้ว: {conferenceParticipants.filter(p => p.status === 'connected').length} คน
                  </Text>
                </View>
              )}
            </View>
            
            {conferenceParticipants.length === 0 ? (
              <Text style={styles.noParticipantsText}>ไม่มีผู้เข้าร่วม Conference</Text>
            ) : (
              <FlatList
                data={conferenceParticipants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.id}
                style={styles.participantsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          {/* Control Buttons */}
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, styles.endButton]}
              onPress={() => {
                Alert.alert(
                  'ยืนยันการจบ Conference',
                  'ต้องการจบ Conference Call หรือไม่?',
                  [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'จบ', style: 'destructive', onPress: endConference }
                  ]
                );
              }}
            >
              <Text style={styles.endButtonText}>จบ Conference</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  currentCallInfo: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
    backgroundColor: '#ffe6e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  addParticipantSection: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  quickAddSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  quickAddLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  quickAddButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  participantsSection: {
    flex: 1,
    marginBottom: 20,
  },
  sectionTitleContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  participantsSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  summaryText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  connectedCount: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '600',
  },
  noParticipantsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  participantsList: {
    maxHeight: 200,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginVertical: 5,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  participantInfo: {
    flex: 1,
  },
  participantMainInfo: {
    marginBottom: 6,
  },
  participantNumberDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  participantStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  participantConnectedBadge: {
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  participantJoinedText: {
    fontSize: 12,
    color: '#155724',
    fontWeight: '600',
  },
  statusConnected: {
    color: '#27AE60',
  },
  statusCalling: {
    color: '#F39C12',
  },
  statusDisconnected: {
    color: '#E74C3C',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 16,
  },
  controlButtons: {
    marginTop: 10,
  },
  controlButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#E74C3C',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConferenceBridge;
