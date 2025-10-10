import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Vibration,
  Modal,
  AppState,
} from 'react-native';
import 'react-native-gesture-handler';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ConvergenceScreen from './screen/SoftphoneScreen';
import SIPSettingsScreen from './screen/SIPSettingsScreen';
import CallingScreen from './screen/CallingScreen';
import TransferKeypad from './TransferKeypad';
import ConferenceCallManager from './utils/ConferenceCallManager';
import ContactScreen from './screen/ContactScreen';
import AddContactScreen from './screen/AddContactScreen';
import AttendedTransferScreen from './screen/AttendedTransferScreen';
import ConferenceBridge from './ConferenceBridge';
import ConferenceCallScreen from './screen/ConferenceCallScreen';
import { saveCallHistory } from './services/callHistoryService';
import { CallManager } from './utils/CallManager';
import { AudioManager } from './utils/AudioManager';
import { TransferManager } from './utils/TransferManager';



const Stack = createStackNavigator();

const styles = StyleSheet.create({
  // Incoming Call Modal Styles
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingCallContainer: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  incomingCallHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  incomingCallTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  incomingCallNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
  },
  incomingCallButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  acceptButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    minWidth: 100,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    minWidth: 100,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default function App() {
  // State ส่วนกลาง
  const [status, setStatus] = useState('ยังไม่เชื่อมต่อ');
  const [isConnected, setIsConnected] = useState(false);
  const [accountRef, setAccountRef] = useState(null);
  const [endpointRef, setEndpointRef] = useState(null);
  const [currentCallRef, setCurrentCallRef] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [currentCallNumber, setCurrentCallNumber] = useState('');
  const [isHold, setIsHold] = useState(false);
  const callTimer = useRef(null);

  // State สำหรับ Transfer Keypad
  const [showTransferKeypad, setShowTransferKeypad] = useState(false);
  const [transferType, setTransferType] = useState('unattended'); // 'unattended' หรือ 'attended'

  // เก็บหมายเลขปลายทางสำหรับการโอนสาย (แยกจาก currentCallNumber)
  const [transferTargetNumber, setTransferTargetNumber] = useState('');

  // State สำหรับ Attended Transfer
  const [attendedTransferState, setAttendedTransferState] = useState({
    originalCallRef: null, // สายเดิมที่ต้องการโอน
    consultCallRef: null, // สายใหม่ที่โทรไปปรึกษา
    targetNumber: '', // หมายเลขที่จะโอนไป
    step: 'idle', // 'idle', 'consulting', 'ready_to_transfer'
    isConsulting: false, // กำลังปรึกษาหรือไม่
  });

  // เก็บ navigation reference สำหรับใช้ใน transfer functions
  const [navigationRef, setNavigationRef] = useState(null);

  // State สำหรับ custom incoming call alert
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCallNumber, setIncomingCallNumber] = useState('');
  const [incomingCallRef, setIncomingCallRef] = useState(null);

  // Ref สำหรับ ringtone ที่ใช้ร่วมกัน
  const ringtoneRef = useRef(null);

  // Effect สำหรับทำความสะอาดเมื่อ component unmount
  useEffect(() => {
    return () => {
      // หยุดเสียงเรียกเข้าทุกแหล่งเมื่อ component ถูก unmount
      console.log('🧹 Component unmounting - cleaning up ringtones');
      AudioManager.stopAllRingtones(ringtoneRef);

      // ปลดปล่อย ringtone resource
      if (ringtoneRef.current) {
        try {
          ringtoneRef.current.release();
        } catch (error) {}
      }
    };
  }, []);

  // Effect สำหรับจัดการ AppState เพื่อหยุดเสียงเรียกเข้าเมื่อแอปเข้า background
  useEffect(() => {
    const handleAppStateChange = nextAppState => {
      console.log('App state changed to:', nextAppState);

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // หยุดเสียงเรียกเข้าเมื่อแอปเข้า background
        console.log('📱 App going to background - stopping all ringtones');
        AudioManager.stopAllRingtones(ringtoneRef);
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  const [config, setConfig] = useState({
    username: '1004',
    domain: '192.168.0.5',
    password: 'con1004',
    port: '5060',
  });

  // ref for ConferenceCallManager
  const conferenceRef = useRef(null);

  // ref for ConferenceBridge
  const conferenceBridgeRef = useRef(null);

  // Helper function for safe alerts
  const safeAlert = (title, message) => {
    try {
      Alert.alert(title, message);
    } catch (error) {
      console.log('Alert error:', error);
      console.log(`${title}: ${message}`);
    }
  };

  // ฟังก์ชันจัดการปุ่มรับสาย
  const handleAcceptCall = async () => {
    try {
      const call = incomingCallRef;

      // หยุดเสียงเรียกเข้าทุกแหล่งทันที
      AudioManager.stopAllRingtones(ringtoneRef);

      // ใช้ timeout เป็นการยืนยันให้หยุดเสียงแน่นอน
      setTimeout(() => {
        AudioManager.stopAllRingtones(ringtoneRef);
      }, 100);

      // ซ่อน custom alert
      setShowIncomingCall(false);

      // ตั้งค่า audio mode ก่อนรับสาย
      AudioManager.setCallAudioMode();

      // ใช้ CallManager รับสาย
      const answered = await CallManager.answerCall(call, endpointRef);

      if (!answered) {
        throw new Error('ไม่สามารถรับสายได้ - ลองทุกวิธีแล้ว');
      }

      // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
      try {
        await CallManager.setMute(call, false);
      } catch (muteError) {}

      setIsInCall(true);
      setCurrentCallRef(call);
      setCurrentCallNumber(incomingCallNumber);
      navigationRef?.navigate('Calling');
    } catch (error) {
      console.error('Error answering call:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถรับสายได้');
      setCallStatus('❌ ไม่สามารถรับสาย');
      setTimeout(() => setCallStatus(''), 2000);
    }
  };

  // ฟังก์ชันจัดการปุ่มปฏิเสธสาย
  const handleDeclineCall = async () => {
    try {
      const call = incomingCallRef;

      // หยุดเสียงเรียกเข้าทุกแหล่งทันที
      AudioManager.stopAllRingtones(ringtoneRef);

      // ใช้ timeout เป็นการยืนยันให้หยุดเสียงแน่นอน
      setTimeout(() => {
        AudioManager.stopAllRingtones(ringtoneRef);
      }, 100);

      // ซ่อน custom alert
      setShowIncomingCall(false);

      console.log('กำลังปฏิเสธสาย...');
      setCallStatus('📞 กำลังปฏิเสธสาย...');

      // ใช้ CallManager แทนโค้ดเดิม
      const rejected = await CallManager.hangupCall(call, endpointRef);

      setCallStatus('📞 ปฏิเสธสายแล้ว');
      setTimeout(() => setCallStatus(''), 2000);

      

      // รีเซ็ตสถานะ
      setCurrentCallRef(null);
      setCurrentCallNumber('');
      setIncomingCallNumber('');
      setIncomingCallRef(null);
    } catch (error) {
      console.error('Error declining call:', error);
      setCallStatus('❌ ไม่สามารถปฏิเสธสาย');
      setTimeout(() => setCallStatus(''), 2000);
    }
  };

  // Function to start call timer
  const startCallTimer = () => {
    // Clear existing timer if any
    if (callTimer.current) {
      clearInterval(callTimer.current);
    }

    // Start new timer
    callTimer.current = setInterval(() => {
      // Timer logic can be added here if needed
      console.log('Call timer tick');
    }, 1000);
  };

  // ฟังก์ชันโทรออก
  const makeCall = async callNumber => {
    if (!callNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการโทร');
      return;
    }

    if (!isConnected || !accountRef) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเชื่อมต่อ SIP ก่อน');
      return;
    }

    try {
      setCallStatus('📞 เริ่มโทร...');
      setCurrentCallNumber(callNumber);
      setIsInCall(true); // ตั้งสถานะให้เป็น in call เมื่อเริ่มโทร

      // ตั้งค่า audio mode ก่อนโทร
      AudioManager.setCallAudioMode();

      const callUri = `sip:${callNumber}@${config.domain}`;
      console.log('📞 โทรออกไปยัง:', callUri);

      const call = await CallManager.makeCall(endpointRef, accountRef, callUri);
      // เมื่อ call เชื่อมต่อแล้ว library จะจัดการส่งเสียงระหว่างอุปกรณ์ให้เอง
      setCurrentCallRef(call);
      setIsHold(false); // รีเซ็ต hold state เมื่อเริ่มโทรใหม่
      setCallStatus('📞 กำลังเชื่อมต่อ...');

     

      // เพิ่มการตรวจสอบไมค์หลังจากโทรออก
      if (call) {
        setTimeout(() => {
          AudioManager.forceMicrophoneEnable(call);
        }, 2000); // รอ 2 วินาทีหลังจากโทรออกแล้วค่อยตรวจสอบ
      }
    } catch (error) {
      setCallStatus('❌ โทรไม่สำเร็จ');
      setIsInCall(false); // รีเซ็ตสถานะเมื่อโทรไม่สำเร็จ
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโทรได้: ${error.message}`);
      setTimeout(() => setCallStatus(''), 3000);
    }
  };

  // ฟังก์ชันวางสาย
  const hangupCall = async () => {
    try {
      // ตรวจสอบว่ามีสายที่กำลังใช้งานอยู่หรือไม่
      if (!currentCallRef) {
        console.log('ไม่พบสายที่กำลังใช้งาน');
        setCallStatus('❌ ไม่มีสายที่ต้องวาง');
        setTimeout(() => setCallStatus(''), 2000);
        return;
      }

      console.log('กำลังวางสาย...');
      setCallStatus('📞 กำลังวางสาย...');

      // รีเซ็ต audio mode ก่อนวางสาย
      AudioManager.resetAudioMode();

      // ใช้ CallManager แทนโค้ดเดิม
      const success = await CallManager.hangupCall(currentCallRef, endpointRef);

      if (success) {
        console.log('วางสายสำเร็จ');
      } else {
        console.log('⚠️ ไม่สามารถวางสายได้แต่จะรีเซ็ตสถานะ');
      }

      // บันทึกประวัติการโทรทุกกรณีหลังวางสาย
      try {
        if (currentCallNumber) {
          await saveCallHistory({
            number: currentCallNumber,
            type: isInCall ? 'outgoing' : 'incoming',
            status: 'ended',
            timestamp: new Date().toISOString(),
          }, 'default_user');
        }
      } catch (error) {
        console.error('❌ ไม่สามารถบันทึกประวัติการโทรหลังวางสาย:', error);
      }

      // อัพเดทสถานะและรีเซ็ต state หลังวางสายสำเร็จ
      setCallStatus('📞 วางสายแล้ว');
      setIsInCall(false);
      setIsHold(false);
      setCurrentCallRef(null);
      setCurrentCallNumber('');

      // เคลียร์ call timer
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }

      // เคลียร์สถานะหลังจาก 2 วินาที
      setTimeout(() => setCallStatus(''), 2000);

      return true;
    } catch (error) {
      // จัดการ error
      console.error('เกิดข้อผิดพลาดในการวางสาย:', error);

      // แสดงข้อความ error ให้ผู้ใช้เห็น
      setCallStatus(`❌ ${error.message || 'เกิดข้อผิดพลาดในการวางสาย'}`);

      // บังคับรีเซ็ตสถานะในกรณีที่เกิด error
      setIsInCall(false);
      setIsHold(false);
      setCurrentCallRef(null);
      setCurrentCallNumber('');

      // เคลียร์ call timer
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }

      // เคลียร์ข้อความ errorหลังจาก 3 วินาที
      setTimeout(() => setCallStatus(''), 3000);

      // ส่ง error กลับไปให้ component ที่เรียกใช้จัดการต่อ
      throw error;
    }
  };

  // ฟังก์ชัน Hold สาย (สำหรับ Transfer)
  const holdCall = async (callRef = null) => {
    const targetCall = callRef || currentCallRef;

    try {
      const success = await CallManager.holdCall(targetCall, endpointRef);

      if (success && targetCall === currentCallRef) {
        setIsHold(true);
        setCallStatus('สายถูก Hold แล้ว');
      }

      return success;
    } catch (error) {
      console.error('Hold call error:', error);
      throw error;
    }
  };


  // ฟังก์ชัน Unhold สาย (สำหรับ Transfer)
  const unholdCall = async (callRef = null) => {
    const targetCall = callRef || currentCallRef;

    try {
      const success = await CallManager.unholdCall(targetCall, endpointRef);

      if (success && targetCall === currentCallRef) {
        setIsHold(false);
        setCallStatus('เชื่อมต่อแล้ว');
      }

      return success;
    } catch (error) {
      console.error('Unhold call error:', error);
      Alert.alert('Unhold call error', `Error: ${error.message || error}`);
      return false;
    }
  };

  // ฟังก์ชัน Hold/Unhold สาย
  const toggleHold = async () => {
    if (!currentCallRef) {
      safeAlert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return;
    }
    try {
      const call = currentCallRef;
      if (!isHold) {
        // Hold call
        try {
          const success = await CallManager.holdCall(call, endpointRef);
          if (success) {
            setIsHold(true);
            setCallStatus('สายถูก Hold แล้ว');
            // หยุด call timer ชั่วคราว
            if (callTimer.current) {
              clearInterval(callTimer.current);
              callTimer.current = null;
            }
          } else {
            safeAlert('ข้อผิดพลาด', 'ไม่สามารถ Hold สายได้');
          }
        } catch (error) {
          console.log('Hold failed:', error);
          safeAlert('ข้อผิดพลาด', 'ไม่สามารถ Hold สายได้');
        }
      } else {
        // Unhold call
        try {
          const success = await CallManager.unholdCall(call, endpointRef);
          if (success) {
            setIsHold(false);
            setCallStatus('สายถูก Unhold แล้ว - กลับมาคุยได้');
            // เริ่ม call timer ใหม่
            startCallTimer();
          } else {
            safeAlert('ข้อผิดพลาด', 'ไม่สามารถ Unhold สายได้');
          }
        } catch (error) {
          console.log('Unhold failed:', error);
          safeAlert('ข้อผิดพลาด', 'ไม่สามารถ Unhold สายได้');
        }
      }
    } catch (error) {
      console.log('Toggle hold error:', error);
      safeAlert(
        'ข้อผิดพลาด',
        `ไม่สามารถ ${isHold ? 'Unhold' : 'Hold'} สายได้: ${error.message}`,
      );
    }
  };

  // ฟังก์ชันไปยังหน้า CallingScreen
  const navigateToCalling = navigation => {
    if (isInCall) {
      navigation.navigate('Calling');
    }
  };

  // แสดง Transfer Keypad แบบ Unattended
  const showUnattendedTransferDialog = () => {
    if (!currentCallRef || !isInCall) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return;
    }

    if (!endpointRef || !accountRef) {
      Alert.alert('ข้อผิดพลาด', 'ระบบ SIP ยังไม่พร้อม กรุณาเชื่อมต่อใหม่');
      return;
    }

    setTransferType('unattended');
    setShowTransferKeypad(true);
  };

  // แสดง Transfer Keypad แบบ Attended
  const showAttendedTransferDialog = () => {
    if (!currentCallRef || !isInCall) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return;
    }

    if (!endpointRef || !accountRef) {
      Alert.alert('ข้อผิดพลาด', 'ระบบ SIP ยังไม่พร้อม กรุณาเชื่อมต่อใหม่');
      return;
    }

    setTransferType('attended');
    setShowTransferKeypad(true);
  };

  // ฟังก์ชันที่เรียกจาก TransferKeypad เมื่อกดโอนสาย
  const handleTransferFromKeypad = async (targetNumber, type) => {
    try {
      setTransferTargetNumber(targetNumber);

      if (type === 'unattended') {
        return await TransferManager.performUnattendedTransfer({
          endpointRef,
          accountRef,
          currentCallRef,
          targetNumber,
          config,
        });
      } else if (type === 'attended') {
        return await TransferManager.performAttendedTransfer({
          endpointRef,
          accountRef,
          originalCallRef: currentCallRef,
          consultCallRef: null,
          targetNumber,
          config,
        });
      }
      return false;
    } catch (error) {
      console.error('Transfer from keypad error:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
      return false;
    }
  };

  // ปิด TransferKeypad
  const closeTransferKeypad = () => {
    setShowTransferKeypad(false);
    setTransferType('unattended');
  };


  // Wrapper component สำหรับ CallingScreen เพื่อจัดการ navigationRef
  const CallingScreenWrapper = props => {
    useFocusEffect(
      React.useCallback(() => {
        if (!navigationRef && props.navigation) {
          setNavigationRef(props.navigation);
        }
      }, [props.navigation]),
    );

    return (
      <CallingScreen
        {...props}
        hangupCall={hangupCall}
        toggleHold={toggleHold}
        callStatus={callStatus}
        isInCall={isInCall}
        isHold={isHold}
        currentCallNumber={currentCallNumber}
        setCurrentCallNumber={setCurrentCallNumber}
        setCurrentCallRef={setCurrentCallRef}
        setIsInCall={setIsInCall}
        currentCallRef={currentCallRef}
        endpointRef={endpointRef}
        accountRef={accountRef}
        config={config}
        showUnattendedTransferDialog={showUnattendedTransferDialog}
        showAttendedTransferDialog={showAttendedTransferDialog}
        conference={
          conferenceRef.current ? conferenceRef.current.startConference : null
        }
        addToConference={
          conferenceRef.current ? conferenceRef.current.addToConference : null
        }
        removeFromConference={
          conferenceRef.current
            ? conferenceRef.current.removeFromConference
            : null
        }
        conferenceParticipants={
          conferenceRef.current
            ? conferenceRef.current.conferenceParticipants
            : []
        }
        isInConference={
          conferenceRef.current ? conferenceRef.current.isInConference : false
        }
        conferenceBridge={conferenceBridgeRef.current}
        showConferenceBridge={() => {
          if (conferenceBridgeRef.current) {
            conferenceBridgeRef.current.showModal();
          }
        }}
        startConferenceBridge={() => {
          if (conferenceBridgeRef.current) {
            return conferenceBridgeRef.current.startConference();
          }
          return false;
        }}
      />
    );
  };

  // ส่ง props ไปทั้งสองหน้า
  return (
    <NavigationContainer ref={setNavigationRef}>
      <Stack.Navigator initialRouteName="DialPad">
        <Stack.Screen name="DialPad" component={ConvergenceScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Conference"
          component={ConferenceCallScreen}
          options={{ title: 'Conference Call' }}
        />
        <Stack.Screen name="Softphone" options={{ headerShown: false }}>
          {props => (
            <ConvergenceScreen
              {...props}
              status={status}
              isConnected={isConnected}
              isInCall={isInCall}
              isHold={isHold}
              callStatus={callStatus}
              accountRef={accountRef}
              endpointRef={endpointRef}
              config={config}
              makeCall={makeCall}
              hangupCall={hangupCall}
              toggleHold={toggleHold}
              setCurrentCallNumber={setCurrentCallNumber}
              navigateToCalling={navigateToCalling}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Calling"
          options={{
            title: 'กำลังโทร',
            headerShown: false,
            gestureEnabled: false,
          }}
          component={CallingScreenWrapper}
        />
        <Stack.Screen
          name="Contacts"
          options={{
            headerShown: false,
          }}
        >
          {props => (
            <ContactScreen
              {...props}
              makeCall={makeCall}
              setCurrentCallNumber={setCurrentCallNumber}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="AddContact"
          component={AddContactScreen}
          options={{ title: 'เพิ่มผู้ติดต่อ' }}
        />
        <Stack.Screen
          name="AttendedTransfer"
          options={{
            title: 'การโอนสายแบบปรึกษา',
            headerShown: false,
            gestureEnabled: false,
          }}
        >
          {props => <AttendedTransferScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen
          name="SIPConnector"
          options={{
            title: 'การตั้งค่า SIP',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#007AFF',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {props => (
            <SIPSettingsScreen
              {...props}
              status={status}
              setStatus={setStatus}
              isConnected={isConnected}
              setIsConnected={setIsConnected}
              setAccountRef={setAccountRef}
              setEndpointRef={setEndpointRef}
              setCurrentCallRef={setCurrentCallRef}
              setIsInCall={setIsInCall}
              setCallStatus={setCallStatus}
              setCurrentCallNumber={setCurrentCallNumber}
              config={config}
              setConfig={setConfig}
              setIncomingCallNumber={setIncomingCallNumber}
              setIncomingCallRef={setIncomingCallRef}
              setShowIncomingCall={setShowIncomingCall}
              incomingCallRef={incomingCallRef}
              incomingCallNumber={incomingCallNumber}
              ringtoneRef={ringtoneRef}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>

      {/* Transfer Keypad Modal */}
      <TransferKeypad
        visible={showTransferKeypad}
        onClose={closeTransferKeypad}
        onTransfer={handleTransferFromKeypad}
        transferType={transferType}
        currentNumber=""
      />

      <ConferenceCallManager
        ref={conferenceRef}
        endpointRef={endpointRef}
        accountRef={accountRef}
        currentCallRef={currentCallRef}
        config={config}
        isInCall={isInCall}
        setIsInCall={setIsInCall}
        setCallStatus={setCallStatus}
        setCurrentCallRef={setCurrentCallRef}
        navigation={navigationRef}
        
      />

      <ConferenceBridge
        ref={conferenceBridgeRef}
        endpointRef={endpointRef}
        accountRef={accountRef}
        currentCallRef={currentCallRef}
        currentCallNumber={currentCallNumber}
        config={config}
        isInCall={isInCall}
        setIsInCall={setIsInCall}
        setCallStatus={setCallStatus}
        setCurrentCallRef={setCurrentCallRef}
        navigation={navigationRef}
      />

      {/* Custom Incoming Call Alert */}
      {showIncomingCall && (
        <Modal
          transparent={true}
          visible={showIncomingCall}
          animationType="fade"
        >
          <View style={styles.incomingCallOverlay}>
            <View style={styles.incomingCallContainer}>
              <Text style={styles.incomingCallTitle}>📞 สายเรียกเข้า</Text>
              <Text style={styles.incomingCallNumber}>
                {incomingCallNumber}
              </Text>

              <View style={styles.incomingCallButtons}>
                <TouchableOpacity
                  style={[styles.incomingCallButton, styles.declineButton]}
                  onPress={handleDeclineCall}
                >
                  <Text style={styles.buttonText}>❌ ปฏิเสธ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.incomingCallButton, styles.acceptButton]}
                  onPress={handleAcceptCall}
                >
                  <Text style={styles.buttonText}>✅ รับสาย</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </NavigationContainer>
  );
}
