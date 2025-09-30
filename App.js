import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  Vibration,
  NativeModules,
  Modal,
  AppState,
} from 'react-native';
import Sound from 'react-native-sound';
import { Endpoint } from 'react-native-pjsip';
import 'react-native-gesture-handler';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ConvergenceScreen from './screen/SoftphoneScreen';
import CallingScreen from './screen/CallingScreen';
import TransferKeypad from './TransferKeypad';
import ConferenceCallManager from './utils/ConferenceCallManager';
import ContactScreen from './screen/ContactScreen';
import AddContactScreen from './screen/AddContactScreen';
import AttendedTransferScreen from './screen/AttendedTransferScreen';
import ConferenceBridge from './ConferenceBridge';
import { saveCallHistory } from './services/callHistoryService';
import { CallManager } from './utils/CallManager';
import { AudioManager } from './utils/AudioManager';
import { TransferManager } from './utils/TransferManager';



function HomeScreen({
  navigation,
  status,
  setStatus,
  isConnected,
  setIsConnected,
  setAccountRef,
  setEndpointRef,
  setCurrentCallRef,
  setIsInCall,
  setCallStatus,
  setCurrentCallNumber,
  config,
  setConfig,
  setIncomingCallNumber,
  setIncomingCallRef,
  setShowIncomingCall,
  incomingCallRef,
  incomingCallNumber,
  ringtoneRef,
}) {
  // --- State และ ref สำหรับ HomeScreen เท่านั้น ---
  const [isConnecting, setIsConnecting] = useState(false);
  const endpointRef = useRef(null);
  const accountRef = useRef(null);
  const currentCallRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  // ฟังก์ชันจัดการปุ่มรับสาย
  const handleAcceptCall = async () => {
    try {
      const call = incomingCallRef;

      // หยุดเสียงเรียกเข้าแบบบังคับจนกว่าจะหยุดจริง
      AudioManager.stopAllRingtones(ringtoneRef);

      // ซ่อน custom alert
      setShowIncomingCall(false);

      // ตั้งค่า audio mode ก่อนรับสาย
      AudioManager.setCallAudioMode();

      // ตรวจสอบและรับสาย
      let answered = false;

      // วิธีที่ 1: call.answer()
      if (!answered && call && typeof call.answer === 'function') {
        try {
          await call.answer();
          answered = true;
        } catch (error) {}
      }

      // วิธีที่ 2: call.answerCall()
      if (!answered && call && typeof call.answerCall === 'function') {
        try {
          await call.answerCall();
          answered = true;
        } catch (error) {}
      }

      // วิธีที่ 3: endpoint.answerCall()
      if (!answered && endpointRef.current && endpointRef.current.answerCall) {
        try {
          await endpointRef.current.answerCall(call);
          answered = true;
        } catch (error) {}
      }

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

  // ทำความสะอาด
  const cleanup = async () => {
    try {
      console.log('เริ่มต้นกระบวนการ cleanup...');
      setIsConnecting(false);
      setIsConnected(false);
      setIsInCall(false);
      setCallStatus('');

      // รีเซ็ต audio mode
      AudioManager.resetAudioMode();

      // ยกเลิก timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
        console.log('ยกเลิก connection timeout');
      }

      // ยุติสายที่กำลังใช้งาน
      if (currentCallRef.current) {
        try {
          console.log('กำลังพยายามยุติสายที่กำลังใช้งาน...');
          await CallManager.hangupCall(currentCallRef.current, endpointRef.current);

          currentCallRef.current = null;
        } catch (callError) {
          console.error('Hangup call error:', callError);
          currentCallRef.current = null;
        }
      }

      if (endpointRef.current) {
        console.log('Starting cleanup...');

        // ลบ account ก่อน (สำคัญมาก!)
        if (accountRef.current) {
          try {
            console.log('Deleting account...');
            await endpointRef.current.deleteAccount(accountRef.current);
            console.log('Account deleted successfully');
            accountRef.current = null;
          } catch (accountError) {
            console.error('Delete account error:', accountError);
            accountRef.current = null; // รีเซ็ตแม้จะ error
          }
        }

        // รอสักครู่ให้ account deletion เสร็จสิ้น
        await new Promise(resolve => setTimeout(resolve, 500));

        // ลบ listeners
        try {
          if (endpointRef.current.removeAllListeners) {
            endpointRef.current.removeAllListeners();
            console.log('Listeners removed');
          }
        } catch (listenerError) {
          console.error('Remove listeners error:', listenerError);
        }

        // หยุด endpoint
        try {
          console.log('Stopping endpoint...');
          if (typeof endpointRef.current.stop === 'function') {
            await endpointRef.current.stop();
            console.log('Endpoint stopped successfully');
          } else {
            console.log(
              'endpointRef.current.stop is not a function, skip stopping endpoint',
            );
          }
        } catch (stopError) {
          console.error('Stop endpoint error:', stopError);
        }

        // รีเซ็ต endpoint ref
        endpointRef.current = null;
        console.log('Cleanup completed');
      } else {
        // ถ้าไม่มี endpoint ก็รีเซ็ต refs เฉยๆ
        endpointRef.current = null;
        accountRef.current = null;
        currentCallRef.current = null;
        console.log('Simple cleanup completed');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      // บังคับรีเซ็ต refs แม้จะ error
      endpointRef.current = null;
      accountRef.current = null;
      currentCallRef.current = null;
    }
  };
  // ขอสิทธิ์
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // ตรวจสอบการมีอยู่ของสิทธิ์ก่อนการขอ
        if (!PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) {
          console.warn('RECORD_AUDIO permission not found on this device');
          return;
        }

        // ขอสิทธิ์ใช้ไมค์
        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'ขออนุญาตใช้ไมค์',
            message: 'แอพต้องการใช้ไมค์เพื่อการโทร',
            buttonPositive: 'ตกลง',
            buttonNegative: 'ยกเลิก',
          },
        );

        // ตรวจสอบสิทธิ์ไมค์
        if (audioPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('ต้องการสิทธิ์ใช้ไมค์');
        }

        // ตรวจสอบการมีอยู่ของสิทธิ์ CALL_PHONE
        if (PermissionsAndroid.PERMISSIONS.CALL_PHONE) {
          // ขอสิทธิ์เพิ่มเติมสำหรับการโทร
          const callPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            {
              title: 'ขออนุญาตโทร',
              message: 'แอพต้องการสิทธิ์ในการโทร',
              buttonPositive: 'ตกลง',
              buttonNegative: 'ยกเลิก',
            },
          );

          // ตรวจสอบสิทธิ์การโทร
          if (callPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('ไม่ได้รับสิทธิ์การโทร แต่ยังสามารถใช้ SIP ได้');
          }
        }

        // ตรวจสอบการมีอยู่ของสิทธิ์ MODIFY_AUDIO_SETTINGS
        if (PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS) {
          // ขอสิทธิ์ปรับแต่งเสียง
          const modifyAudioPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS,
            {
              title: 'ขออนุญาตปรับแต่งเสียง',
              message: 'แอพต้องการปรับแต่งการตั้งค่าเสียง',
              buttonPositive: 'ตกลง',
              buttonNegative: 'ยกเลิก',
            },
          );

          // ตรวจสอบสิทธิ์ปรับแต่งเสียง
          if (modifyAudioPermission !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('ไม่ได้รับสิทธิ์ปรับแต่งเสียง');
          }
        }
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการขอสิทธิ์:', error);
        throw new Error(`ไม่สามารถขอสิทธิ์ได้: ${error.message}`);
      }
    }
  };

  // NOTE เชื่อมต่อ SIP
  const connectSIP = async () => {
    if (isConnecting) return;
    if (!config.domain || !config.username || !config.password) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setStatus('กำลังเชื่อมต่อ...');
    await cleanup();

    try {
      // ขอสิทธิ์
      await requestPermissions();

      // สร้าง Endpoint
      endpointRef.current = new Endpoint();

      // Define incoming call handler function
      const handleIncomingCall = (remoteNumber, call) => {
        setIncomingCallNumber(remoteNumber);
        setIncomingCallRef(call);
        setShowIncomingCall(true);
      };

      // เริ่มต้น endpoint พร้อมตั้งค่าเพิ่มเติม
      await endpointRef.current.start({
        userAgent: 'Simple SIP Client',
        logLevel: 5, // เพิ่มระดับการบันทึกล็อกเพื่อให้ง่ายต่อการแก้ไขปัญหา
        logConfig: {
          console: true,
        },
      });



      // ตั้ง timeout สำหรับการเชื่อมต่อ (30 วินาที)
      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          handleConnectionTimeout();
        }
      }, 30000);

      // จัดการ events
      endpointRef.current.on('registration_changed', registration => {
        // ยกเลิก timeout เมื่อได้ response
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        const regData = registration?._registration || registration;
        const isActive = regData?._active || regData?.status === 'PJSIP_SC_OK';

        setIsConnecting(false);
        if (isActive) {
          setIsConnected(true);
          setStatus('✅ เชื่อมต่อสำเร็จ');
          setAccountRef(accountRef.current);
          setEndpointRef(endpointRef.current);

          navigation.navigate('Softphone'); // <-- เพิ่มบรรทัดนี้
        } else {
          setIsConnected(false);
          const reason =
            regData?._reason || regData?._statusText || 'เชื่อมต่อไม่สำเร็จ';
          setStatus(`❌ ${reason}`);
        }
      });

      // จัดการ call events
      // เตรียมเสียงเรียกเข้า
      Sound.setCategory('Playback');

      // เพิ่มการตั้งค่า audio session สำหรับการโทร
      AudioManager.setCallAudioMode();

      // กำหนดค่าตามแพลตฟอร์ม
      const soundPath = Platform.select({
        android: 'incoming_call.mp3',
        ios: 'incoming_call.mp3',
      });

      const soundLocation = Platform.select({
        android: Sound.MAIN_BUNDLE,
        ios: '', // สำหรับ iOS ใช้ค่าว่างเพื่อให้หาในบันเดิล
      });

      ringtoneRef.current = new Sound(soundPath, soundLocation, error => {
        if (error) {
          console.log('ไม่สามารถโหลดเสียงเรียกเข้าได้:', error);
          console.log('Error code:', error.code);
          console.log('Error description:', error.description);
        } else {
          console.log('เสียงเรียกเข้าพร้อมใช้งาน');
          ringtoneRef.current.setVolume(1.0);
          // เช็คว่าเสียงพร้อมเล่นหรือไม่
          console.log('Is sound ready?', ringtoneRef.current.isLoaded());
          console.log('Sound duration:', ringtoneRef.current.getDuration());
        }
      });

      endpointRef.current.on('call_received', call => {
        console.log('Incoming call:', call);
        if (call) {
          const remoteNumber = call
            .getRemoteUri()
            .split('@')[0]
            .replace('sip:', '');
          setCurrentCallRef(call);
          setCurrentCallNumber(remoteNumber);
          setCallStatus('📞 สายเรียกเข้า');

          // บันทึกประวัติสายเข้าทันทีเมื่อมีสายเรียกเข้า
          try {
            console.log('📝 บันทึกประวัติสายเรียกเข้า:', remoteNumber);
            saveCallHistory(
              {
                number: remoteNumber,
                type: 'incoming',
                status: 'ringing', // สถานะเริ่มต้นเป็นกำลังเรียก
                timestamp: new Date().toISOString(),
              },
              'default_user',
            )
              .then(() => {})
              .catch(error => {
                console.error(
                  '❌ ไม่สามารถบันทึกประวัติสายเรียกเข้าได้:',
                  error,
                );
              });
          } catch (error) {
            console.error(
              '❌ ข้อผิดพลาดในการบันทึกประวัติสายเรียกเข้า:',
              error,
            );
          }

          // เล่นเสียงเรียกเข้า
          if (ringtoneRef.current && ringtoneRef.current.isLoaded()) {
            ringtoneRef.current.setVolume(1.0);
            ringtoneRef.current.setNumberOfLoops(-1); // เล่นซ้ำไปเรื่อยๆ
            ringtoneRef.current.play(success => {
              if (!success) {
                console.log('การเล่นเสียงผิดพลาด');
              } else {
                console.log('เริ่มเล่นเสียงเรียกเข้า');
              }
            });
          } else {
            console.log('เสียงยังไม่พร้อมเล่น');
          }

          // สั่นเตือน: สั่น 500ms, หยุด 1000ms, วนซ้ำ
          const PATTERN = [500, 1000];
          Vibration.vibrate(PATTERN, true);

          // แสดง custom incoming call alert
          handleIncomingCall(remoteNumber, call);
        }
      });

      endpointRef.current.on('call_changed', call => {
        const callInfo = call?._callInfo || call;
        const state = callInfo?.state || call?.state;
        const lastStatus = callInfo?.lastStatus || call?.lastStatus;
        const callId = call?._callId || call?.id || 'unknown';

        console.log(`Call state changed [${callId}]:`, { state, lastStatus });

        // ตรวจสอบว่าสายนี้เป็นสายที่กำลังใช้งานอยู่หรือไม่
        const isActiveCall =
          currentCallRef.current &&
          ((currentCallRef.current._callId &&
            currentCallRef.current._callId === callId) ||
            (currentCallRef.current.id &&
              currentCallRef.current.id === callId));

        console.log(`Is active call: ${isActiveCall}`);

        // หากไม่ใช่สายที่กำลังใช้งาน แต่มีสถานะ DISCONNECTED ให้อัพเดต UI
        if (!isActiveCall && state === 'PJSIP_INV_STATE_DISCONNECTED') {
          console.log(
            'Detected disconnection of a non-active call, updating UI...',
          );
          currentCallRef.current = null;
          setCurrentCallRef(null);
          setIsInCall(false);
          setCallStatus('📞 อีกฝ่ายวางสาย');
          setTimeout(() => setCallStatus(''), 2000);
        }

        if (state === 'PJSIP_INV_STATE_CALLING') {
          setCallStatus('📞 กำลังโทร...');
        } else if (state === 'PJSIP_INV_STATE_EARLY') {
          setCallStatus('📞 กำลังเรียก...');
        } else if (state === 'PJSIP_INV_STATE_CONFIRMED') {
          // หยุดเสียงเรียกเข้าทุกแหล่งทันทีเมื่อสายเชื่อมต่อ
          AudioManager.stopAllRingtones(ringtoneRef);
          setShowIncomingCall(false);

          setCallStatus('📞 สายเชื่อมต่อแล้ว');
          setIsInCall(true);
          if (call) {
            currentCallRef.current = call;
            setCurrentCallRef(call);

            // ตรวจสอบและตั้งค่าเสียงเมื่อสายเชื่อมต่อ
            AudioManager.setCallAudioMode();

            // เพิ่มการตรวจสอบและแก้ไขปัญหาไมค์
            setTimeout(() => {
              AudioManager.checkAndFixMicrophone(call);
              // เพิ่มการบังคับเปิดไมค์
              AudioManager.forceMicrophoneEnable(call);
            }, 1000); // รอ 1 วินาทีแล้วค่อยตรวจสอบ

            // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
            try {
              CallManager.setMute(call, false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
            } catch (muteError) {
              console.log(
                '❌ Error unmuting microphone in CONFIRMED state:',
                muteError,
              );
            }
          }
        } else if (state === 'PJSIP_INV_STATE_DISCONNECTED') {
          // หยุดเสียงเรียกเข้าทุกแหล่งทันทีเมื่อสายถูกตัด
          AudioManager.stopAllRingtones(ringtoneRef);
          setShowIncomingCall(false);

          // ตรวจสอบสาเหตุการวางสาย
          let disconnectReason = '';
          if (lastStatus === 487) {
            disconnectReason = 'ยกเลิกการโทร';
          } else if (lastStatus === 486 || lastStatus === 600) {
            disconnectReason = 'ปฏิเสธสาย';
          } else if (lastStatus === 480 || lastStatus === 408) {
            disconnectReason = 'ไม่มีการรับสาย';
          } else if (lastStatus === 603) {
            disconnectReason = 'ปฏิเสธการรับสาย';
          } else if (lastStatus === 200) {
            disconnectReason = 'วางสายปกติ';
          } else if (lastStatus === 500 || lastStatus === 503) {
            disconnectReason = 'ปัญหาจากระบบ SIP';
          } else if (lastStatus === 0 || !lastStatus) {
            disconnectReason = 'อีกฝ่ายวางสาย';
          } else {
            disconnectReason = `วางสายแล้ว (${lastStatus})`;
          }

          console.log('Call disconnected:', {
            state,
            lastStatus,
            disconnectReason,
          });

          // รีเซ็ต audio mode เมื่อสายถูกตัด
          AudioManager.resetAudioMode();

          // อัปเดตประวัติการโทรเมื่อสายถูกตัด
          try {
            const callNumber =
              currentCallRef.current
                ?.getRemoteUri?.()
                ?.split('@')[0]
                ?.replace('sip:', '') || 'Unknown';
            let historyStatus = 'ended';

            // กำหนดสถานะตามเหตุผลการตัดสาย
            if (
              lastStatus === 487 ||
              lastStatus === 486 ||
              lastStatus === 600 ||
              lastStatus === 603
            ) {
              historyStatus = 'declined';
            } else if (lastStatus === 480 || lastStatus === 408) {
              historyStatus = 'missed';
            } else if (lastStatus === 200) {
              historyStatus = 'completed';
            }

            console.log('📝 อัปเดตประวัติการโทรเมื่อสายถูกตัด:', {
              callNumber,
              historyStatus,
              lastStatus,
            });
            saveCallHistory(
              {
                number: callNumber,
                type: 'incoming',
                status: historyStatus,
                timestamp: new Date().toISOString(),
              },
              'default_user',
            )
              .then(() => {})
              .catch(error => {
                console.error('❌ ไม่สามารถอัปเดตประวัติการโทรได้:', error);
              });
          } catch (error) {
            console.error('❌ ข้อผิดพลาดในการอัปเดตประวัติการโทร:', error);
          }

          setCallStatus(`📞 ${disconnectReason}`);
          setIsInCall(false);

          // ตรวจสอบว่ามีสายที่กำลังใช้งานอยู่หรือไม่ และรีเซ็ต
          if (currentCallRef.current) {
            console.log('Resetting current call reference');
            currentCallRef.current = null;
            setCurrentCallRef(null);
          }

          setCurrentCallNumber('');

          // เพิ่มการจัดการเมื่อสายถูกตัดจากฝั่งตรงข้าม
          try {
            if (state === 'PJSIP_INV_STATE_DISCONNECTED') {
              if (call?.getRemoteUri) {
                const remoteUri = call.getRemoteUri();
                console.log('Remote party disconnected the call:', remoteUri);
              } else {
                console.log('Remote party disconnected the call (no URI)');
              }

              // เพิ่มการ forcibly cleanup หากจำเป็น
              if (call && typeof call.delete === 'function') {
                try {
                  call.delete();
                } catch (deleteError) {}
              }
            }
          } catch (uriError) {
            console.log('Error handling remote URI:', uriError);
          }

          // กลับไปหน้า Softphone หลังจากวางสาย
          if (navigation && navigation.canGoBack()) {
            try {
              navigation.goBack();
            } catch (navError) {
              console.error('❌ Navigation error after disconnect:', navError);
            }
          }

          setTimeout(() => setCallStatus(''), 2000);
        }
      });

      // เพิ่ม handler สำหรับ call terminated
      endpointRef.current.on('call_terminated', call => {
        console.log('Call terminated event received:', call);

        // หยุดเสียงเรียกเข้าทุกแหล่งทันทีเมื่อสายถูกตัด
        AudioManager.stopAllRingtones(ringtoneRef);
        setShowIncomingCall(false);

        // ตรวจสอบสถานะการโทรปัจจุบัน
        console.log('Current call state before termination:', {
          hasCurrentCallRef: !!currentCallRef.current,
        });

        // หมายเหตุ: การอัปเดตประวัติการโทรทำไว้ด้านบนแล้วตามสถานะของการโทร

        // บังคับให้ระบบทราบว่าสายถูกตัดแล้ว ไม่ว่าจะด้วยเหตุผลใด
        setCallStatus('📞 สายถูกตัดจากอีกฝ่าย');
        setIsInCall(false);
        currentCallRef.current = null;
        setCurrentCallRef(null);
        setCurrentCallNumber('');

        // รีเซ็ต audio mode และปิดลำโพงเมื่อสายถูกตัด
        AudioManager.resetAudioMode();
        AudioManager.disableSpeaker().catch(error => {
          console.log('Error disabling speaker on call termination:', error);
        });

        // กลับไปหน้า Softphone
        if (navigation && navigation.canGoBack()) {
          try {
            navigation.goBack();
          } catch (navError) {
            console.error('❌ Navigation error:', navError);
          }
        }

        setTimeout(() => setCallStatus(''), 2000);
      });

      // เพิ่ม handler สำหรับ call_media_state_change
      endpointRef.current.on('call_media_state_change', call => {
        console.log('Call media state changed:', call);

        // จัดการ audio session เมื่อ media state เปลี่ยน
        if (call) {
          const mediaState = call.getMediaState
            ? call.getMediaState()
            : call.mediaState;
          console.log('Media state:', mediaState);

          if (mediaState === 'PJSIP_MEDIA_ACTIVE') {
            // เมื่อ audio เริ่มทำงาน
            console.log('Audio is now active - starting microphone check');

            // ตั้งค่า audio mode สำหรับการโทร
            AudioManager.setCallAudioMode();

            // เรียกใช้ฟังก์ชันตรวจสอบและแก้ไขปัญหาไมค์
            setTimeout(() => {
              AudioManager.checkAndFixMicrophone(call);
              AudioManager.forceMicrophoneEnable(call);
            }, 500); // รอครึ่งวินาทีแล้วค่อยตรวจสอบ

            // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
            try {
              CallManager.setMute(call, false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
            } catch (muteError) {
              console.log(
                '❌ Error unmuting microphone in MEDIA_ACTIVE state:',
                muteError,
              );
            }
          }
        }
      });

      // เพิ่ม handler สำหรับ call_connected
      endpointRef.current.on('call_connected', call => {
        console.log('Call connected:', call);

        // ตั้งค่า audio เมื่อสายเชื่อมต่อ
        AudioManager.setCallAudioMode();

        // เริ่มต้น speaker
        AudioManager.initializeSpeaker();

        // เรียกใช้ฟังก์ชันตรวจสอบและแก้ไขปัญหาไมค์
        setTimeout(() => {
          AudioManager.checkAndFixMicrophone(call);
          AudioManager.forceMicrophoneEnable(call);
        }, 1500); // รอ 1.5 วินาทีแล้วค่อยตรวจสอบ

        // ตรวจสอบและเปิดใช้งาน audio streams
        try {
          // ตรวจสอบว่าไมค์ถูกปิดอยู่หรือไม่
          CallManager.setMute(call, false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่

          // ตรวจสอบสถานะของ audio streams
          if (call && typeof call.getMediaStreams === 'function') {
            const streams = call.getMediaStreams();
            console.log('Media streams:', streams);
          }
        } catch (mediaError) {
          console.error(
            'Error configuring media on call connected:',
            mediaError,
          );
        }
      });

      //NOTE สร้าง Account
      const accountConfig = {
        username: config.username,
        domain: config.domain,
        password: config.password,
        proxy: `sip:${config.domain}:${config.port}`,
        transport: 'UDP',
        regOnAdd: true,
        stunServer: 'stun:stun.l.google.com:19302',
        mediaConfig: {
          audioCodecs: [
            'PCMU/8000', // G.711 μ-law (แนะนำสำหรับความเข้ากันได้)
            'PCMA/8000', // G.711 A-law
            'speex/8000', // Speex 8kHz (ใช้น้อยลง เพื่อลดปัญหา)
            'iLBC/8000', // iLBC
          ],
          videoCodecs: [], // ไม่ใช้ video codec
          // คุณภาพเสียง - ตั้งค่าให้เหมาะสมกับการโทร
          audioConfig: {
            // การตั้งค่าพื้นฐาน
            echoCancellation: false, // ปิดเพื่อลดการประมวลผล
            noiseSuppression: false, // ปิดเพื่อให้เสียงผ่านได้ชัดเจน
            autoGainControl: false, // ปิดเพื่อควบคุมเสียงเอง

            // การตั้งค่าเสียง
            sampleRate: 8000, // 8kHz เพื่อความเข้ากันได้
            channelCount: 1, // mono สำหรับการโทร
            bitsPerSample: 16, // คุณภาพมาตรฐาน

            // การเปิดใช้งาน
            enableAudio: true,
            enableMicrophone: true,
            enableSpeaker: true,

            // ระดับเสียง
            audioVolume: 1.0, // ใช้ค่า 0.0-1.0 แทน
            microphoneVolume: 1.0,
            txLevel: 1.0, // ระดับการส่งเสียงสูงสุด
            rxLevel: 1.0, // ระดับการรับเสียงสูงสุด

            // การปิดใช้งานฟีเจอร์ที่อาจรบกวน
            vad: false, // ปิด Voice Activity Detection
            agc: false, // ปิด Auto Gain Control
            noVad: true, // บังคับปิด VAD
            disableSilenceDetection: true, // ปิดการตรวจจับความเงียบ

            // โหมดและคุณภาพ
            audioMode: 'communication', // เปลี่ยนเป็น communication
            audioQuality: 'default', // ใช้ default แทน high

            // การตั้งค่าเพิ่มเติมสำหรับ PJSIP
            clockRate: 8000, // Clock rate สำหรับ audio
            ptime: 20, // Packet time 20ms
            maxptime: 20, // Maximum packet time
          },
        },
      };

      accountRef.current = await endpointRef.current.createAccount(
        accountConfig,
      );
    } catch (error) {
      setIsConnecting(false);
      setIsConnected(false);
      setStatus(`❌ ผิดพลาด: ${error.message}`);
      Alert.alert('ผิดพลาด', error.message);

      // ยกเลิก timeout ถ้าเกิด error
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  };

  // จัดการเมื่อหมดเวลาการเชื่อมต่อ
  const handleConnectionTimeout = () => {
    setIsConnecting(false);
    setIsConnected(false);
    setStatus('❌ หมดเวลาการเชื่อมต่อ');
    Alert.alert(
      'หมดเวลาการเชื่อมต่อ',
      'ไม่สามารถเชื่อมต่อได้ภายใน 30 วินาที\nกรุณาตรวจสอบการตั้งค่าและลองอีกครั้ง',
      [{ text: 'ตกลง' }],
    );
    cleanup();
  };

  // ยกเลิกการเชื่อมต่อ (ใช้เมื่อกำลังเชื่อมต่ออยู่)
  const cancelConnection = async () => {
    setStatus('กำลังยกเลิก...');
    await cleanup();
    setStatus('ยกเลิกการเชื่อมต่อแล้ว');
  };

  // ตัดการเชื่อมต่อ
  const disconnect = async () => {
    await cleanup();
    setStatus('ยังไม่เชื่อมต่อ');
  };

  return (
    <View style={styles.container}>
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Convergence</Text>
      </View> */}

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Server Settings</Text>
            <Text style={styles.cardSubtitle}>
              Configure your SIP server connection
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>IP Address</Text>
              <TextInput
                style={[
                  styles.input,
                  !isConnecting && !isConnected ? {} : styles.inputDisabled,
                ]}
                placeholder="192.168.1.100"
                value={config.domain}
                onChangeText={text => setConfig({ ...config, domain: text })}
                editable={!isConnecting && !isConnected}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Port</Text>
              <TextInput
                style={[
                  styles.input,
                  !isConnecting && !isConnected ? {} : styles.inputDisabled,
                ]}
                placeholder="5060"
                value={config.port}
                onChangeText={text => setConfig({ ...config, port: text })}
                keyboardType="numeric"
                editable={!isConnecting && !isConnected}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={[
                  styles.input,
                  !isConnecting && !isConnected ? {} : styles.inputDisabled,
                ]}
                placeholder="SIP username"
                value={config.username}
                onChangeText={text => setConfig({ ...config, username: text })}
                editable={!isConnecting && !isConnected}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  !isConnecting && !isConnected ? {} : styles.inputDisabled,
                ]}
                placeholder="SIP password"
                value={config.password}
                onChangeText={text => setConfig({ ...config, password: text })}
                secureTextEntry
                editable={!isConnecting && !isConnected}
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            {!isConnecting && !isConnected && (
              <TouchableOpacity
                style={styles.connectButton}
                onPress={connectSIP}
                activeOpacity={0.7}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            )}

            {isConnecting && (
              <View style={styles.connectingContainer}>
                <TouchableOpacity
                  style={styles.connectingButton}
                  disabled={true}
                >
                  <Text style={styles.connectingButtonText}>Connecting...</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelConnection}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isConnecting && isConnected && (
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={disconnect}
                activeOpacity={0.7}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Status</Text>
            <View style={styles.statusIndicator}>
              <View
                style={[
                  styles.statusDot,
                  isConnected
                    ? styles.statusOnline
                    : isConnecting
                    ? styles.statusConnecting
                    : styles.statusOffline,
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected
                  ? 'Connected'
                  : isConnecting
                  ? 'Connecting...'
                  : 'Disconnected'}
              </Text>
            </View>
          </View>
          {status !== 'ยังไม่เชื่อมต่อ' && (
            <Text style={styles.statusMessage}>{status}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const Stack = createStackNavigator();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
  },
  inputDisabled: {
    backgroundColor: '#f8f8f8',
    color: '#999999',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#007aff',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectingContainer: {
    alignItems: 'center',
  },
  connectingButton: {
    backgroundColor: '#ff9500',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginBottom: 8,
    minWidth: 100,
  },
  connectingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#8e8e93',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  disconnectButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
  },
  disconnectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#34c759',
  },
  statusConnecting: {
    backgroundColor: '#ff9500',
  },
  statusOffline: {
    backgroundColor: '#ff3b30',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  statusMessage: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    lineHeight: 20,
  },
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

  // NOTE ฟังก์ชันจัดการปุ่มรับสาย
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

      // ตรวจสอบและรับสาย
      let answered = false;

      // วิธีที่ 3: endpoint.answerCall()
      if (!answered && endpointRef && endpointRef.answerCall) {
        try {
          await endpointRef.answerCall(call);
          answered = true;
        } catch (error) {}
      }

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

  // NOTE ฟังก์ชันจัดการปุ่มปฏิเสธสาย
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

      // อัปเดตประวัติการโทรเป็น "ปฏิเสธ"
      try {
        const remoteNumber = incomingCallNumber || 'Unknown';
        console.log('📝 อัปเดตประวัติการโทรเป็นปฏิเสธสาย:', remoteNumber);
        saveCallHistory(
          {
            number: remoteNumber,
            type: 'incoming',
            status: 'declined',
            timestamp: new Date().toISOString(),
          },
          'default_user',
        )
          .then(() => {})
          .catch(error => {
            console.error('❌ ไม่สามารถอัปเดตประวัติการโทรได้:', error);
          });
      } catch (error) {
        console.error('❌ ข้อผิดพลาดในการอัปเดตประวัติการโทร:', error);
      }

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

      // บันทึกประวัติสายออก
      try {
        console.log('📝 บันทึกประวัติสายออก:', callNumber);
        saveCallHistory(
          {
            number: callNumber,
            type: 'outgoing',
            status: 'calling',
            timestamp: new Date().toISOString(),
          },
          'default_user',
        )
          .then(() => {})
          .catch(error => {
            console.error('❌ ไม่สามารถบันทึกประวัติสายออกได้:', error);
          });
      } catch (error) {
        console.error('❌ ข้อผิดพลาดในการบันทึกประวัติสายออก:', error);
      }

      // เพิ่มการตรวจสอบไมค์หลังจากโทรออก
      if (call) {
        setTimeout(() => {
          AudioManager.checkAndFixMicrophone(call);
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

      // เคลียร์ข้อความ error หลังจาก 3 วินาที
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

  // Attended Transfer - โอนสายแบบตรวจสอบ (3-way conference)
  const startAttendedTransfer = async transferTo => {
    if (!currentCallRef) {
      throw new Error('No active call to transfer');
    }

    try {
      // Hold current call
      await holdCall(currentCallRef);

      // Make new call to transfer target
      const callUri = `sip:${transferTo}@${config.domain}`;
      const transferCall = await CallManager.makeCall(endpointRef, accountRef, callUri);
      console.log(`Transfer call initiated to ${transferTo}`);

      // อัพเดทสถานะ Attended Transfer
      setAttendedTransferState({
        originalCallRef: currentCallRef,
        consultCallRef: transferCall,
        targetNumber: transferTo,
        step: 'consulting',
        isConsulting: true,
      });

      setCallStatus(`กำลังโทรไปปรึกษา: ${transferTo}`);

      return transferCall;
    } catch (error) {
      console.error('Failed to start attended transfer:', error);
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
  // สิ้นสุดฟังก์ชัน Hold/Unhold สาย

  // ฟังก์ชันการโอนสาย (Call Transfer)

  // โอนสายแบบง่าย (Unattended Transfer)
  // หมายเลขปลายทางจะได้รับสายและคุยกับผู้โทรเข้ามาโดยตรง
  // รองรับทั้งการโทรออกและรับสายเข้า
  const unattendedTransfer = async targetNumber => {
    console.log('🔍 ตรวจสอบสถานะการโอนสาย:');
    console.log('📞 currentCallRef:', !!currentCallRef);
    console.log('📞 isInCall:', isInCall);
    console.log('📞 currentCallNumber:', currentCallNumber);

    if (!currentCallRef) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return false;
    }

    if (!isInCall) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่เชื่อมต่ออยู่');
      return false;
    }

    if (!targetNumber || !targetNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุหมายเลขที่ต้องการโอนสาย');
      return false;
    }

    // แสดงคำอธิบายการทำงานก่อนโอน
    return new Promise(resolve => {
      Alert.alert(
        'เชื่อมต่อสาย',
        `🔗 การเชื่อมต่อสาย:\n\n` +
          `📞 เครื่องที่รอสาย ↔ ${targetNumber}\n\n` +
          `วิธีการทำงาน:\n` +
          `• เครื่องที่รอสายจะเชื่อมต่อกับ ${targetNumber} โดยตรง\n` +
          `• ${targetNumber} จะได้รับสายและคุยกับเครื่องที่รอสาย\n` +
          `• คุณจะออกจากการสนทนา\n\n` +
          `ต้องการดำเนินการต่อหรือไม่?`,
        [
          {
            text: 'ยกเลิก',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'เชื่อมต่อสาย',
            onPress: async () => {
              try {
                const result = await performUnattendedTransfer(targetNumber);
                resolve(result);
              } catch (error) {
                resolve(false);
              }
            },
          },
        ],
      );
    });
  };

  // ฟังก์ชันสำหรับทำ Unattended Transfer จริง
  const performUnattendedTransfer = async targetNumber => {
    try {
      if (!currentCallRef) {
        throw new Error('ไม่มีสายที่กำลังใช้งาน');
      }

      // ใช้ TransferManager แทนโค้ดเดิม
      const success = await TransferManager.performUnattendedTransfer({
        endpointRef,
        accountRef,
        currentCallRef,
        targetNumber,
        config
      });

      if (success) {
        // รีเซ็ตสถานะ
        setTimeout(() => {
          setIsInCall(false);
          setCurrentCallRef(null);
          setCurrentCallNumber('');
          setIsHold(false);
          setCallStatus('');
          AudioManager.resetAudioMode();
        }, 2000);

        Alert.alert(
          'เชื่อมต่อสายสำเร็จ!',
          `✅ เชื่อมต่อสำเร็จ!\n\n` +
            `🔗 การเชื่อมต่อ:\n` +
            `• เครื่องที่รออยู่กำลังคุยกับ ${targetNumber}\n` +
            `• คุณได้ออกจากการสนทนาแล้ว\n\n` +
            `📞 ${targetNumber} จะได้รับสายและคุยกับเครื่องที่รอสายได้ทันที`,
        );

        return true;
      } else {
        throw new Error('การโอนสายล้มเหลว');
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการโอนสาย:', error);
      setCallStatus('เชื่อมต่อสายไม่สำเร็จ');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเชื่อมต่อสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันเชื่อมต่อสายแบบง่าย (ใช้ standard SIP transfer)
  const simpleConnectCall = async targetNumber => {
    try {
      console.log('📞 เครื่องที่รอสาย จะเชื่อมต่อกับ:', targetNumber);

      // ตรวจสอบ call state ก่อน
      if (!currentCallRef) {
        throw new Error('ไม่มีสายที่กำลังใช้งาน');
      }

      if (!isInCall) {
        throw new Error('ไม่มีสายที่เชื่อมต่ออยู่');
      }

      // ใช้ domain จาก config
      const domain =
        config && config.domain ? config.domain : 'your-sip-domain.com';
      const targetUri = targetNumber.includes('@')
        ? targetNumber
        : `sip:${targetNumber.trim()}@${domain}`;

      setCallStatus(`กำลังเชื่อมต่อเครื่องที่รอสายกับ ${targetNumber}...`);
      console.log('🔗 Target URI:', targetUri);
      console.log(
        '📋 การทำงาน: เครื่องที่รอสาย -> เชื่อมต่อกับ -> หมายเลขปลายทาง',
      );
      console.log('🔍 ตรวจสอบ methods ที่มี:');
      console.log('  - endpointRef.xferCall:', typeof endpointRef.xferCall);
      console.log(
        '  - currentCallRef.transfer:',
        typeof currentCallRef.transfer,
      );
      console.log(
        '  - endpointRef.transferCall:',
        typeof endpointRef.transferCall,
      );

      // ลองใช้ methods ต่างๆ ตามลำดับ
      let transferSuccess = false;

      // วิธีที่ 1: ใช้ endpointRef.xferCall
      if (!transferSuccess && typeof endpointRef.xferCall === 'function') {
        try {
          await endpointRef.xferCall(accountRef, currentCallRef, targetUri);
          transferSuccess = true;
        } catch (error) {}
      }

      // วิธีที่ 2: ใช้ currentCallRef.transfer
      if (!transferSuccess && typeof currentCallRef.transfer === 'function') {
        try {
          await currentCallRef.transfer(targetUri);
          transferSuccess = true;
        } catch (error) {}
      }

      // วิธีที่ 3: ใช้ endpointRef.transferCall
      if (!transferSuccess && typeof endpointRef.transferCall === 'function') {
        try {
          await endpointRef.transferCall(currentCallRef, targetUri);
          transferSuccess = true;
        } catch (error) {}
      }

      // วิธีที่ 4: ใช้ SIP REFER method (ถ้ามี)
      if (!transferSuccess && typeof currentCallRef.refer === 'function') {
        try {
          await currentCallRef.refer(targetUri);
          transferSuccess = true;
        } catch (error) {}
      }

      if (!transferSuccess) {
        try {
          // วิธีสำรอง: ทำ attended transfer
          // 1. Hold สายเดิม
          console.log('📞 Hold สายเดิม...');
          await holdCall();

          // 2. โทรไปหาหมายเลขปลายทาง
          console.log('📞 โทรไปหา:', targetUri);
          const newCall = await CallManager.makeCall(endpointRef, accountRef, targetUri);

          if (newCall) {
            setCallStatus(`รอ ${targetNumber} รับสาย...`);

            // รอสักครู่แล้วลองเชื่อมต่อ
            setTimeout(async () => {
              try {
                // 3. Unhold สายเดิม
                await unholdCall();

                // 4. ใช้ ConferenceCallManager สร้าง conference call
                if (conferenceRef.current && conferenceRef.current.startConference) {
                  await conferenceRef.current.startConference();
                  transferSuccess = true;
                  setCallStatus('เชื่อมต่อสายสำเร็จ (วิธีสำรอง)');
                } else {
                  console.log('❌ ไม่มี ConferenceCallManager');
                }
              } catch (error) {
                // ถ้าทำไม่ได้ ให้ unhold สายเดิม
                await unholdCall();
                setCallStatus('กลับสู่การสนทนาเดิม');
              }
            }, 3000); // รอ 3 วินาทีให้หมายเลขปลายทางรับสาย
          } else {
            throw new Error('ไม่สามารถโทรไปหาหมายเลขปลายทางได้');
          }
        } catch (error) {}
      }

      if (!transferSuccess) {
        throw new Error('ไม่สามารถเชื่อมต่อสายได้ - ลองทุกวิธีแล้ว');
      }

      console.log(
        '✅ เชื่อมต่อสายสำเร็จ - เครื่องที่รอสายได้เชื่อมต่อกับหมายเลขปลายทางแล้ว',
      );
      setCallStatus('เชื่อมต่อสายสำเร็จ');

      Alert.alert(
        'เชื่อมต่อสายสำเร็จ!',
        `✅ เชื่อมต่อสำเร็จ!\n\n` +
          `🔗 การเชื่อมต่อ:\n` +
          `• เครื่องที่รออยู่กำลังคุยกับ ${targetNumber}\n` +
          `• คุณได้ออกจากการสนทนาแล้ว\n\n` +
          `📞 ${targetNumber} จะได้รับสายและคุยกับเครื่องที่รอสายได้ทันที`,
      );

      // รีเซ็ตสถานะ
      setTimeout(() => {
        setIsInCall(false);
        setCurrentCallRef(null);
        setCurrentCallNumber('');
        setIsHold(false);
        setCallStatus('');
        AudioManager.resetAudioMode();
      }, 2000);

      return true;
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการเชื่อมต่อสาย:', error);
      setCallStatus('เชื่อมต่อสายไม่สำเร็จ');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเชื่อมต่อสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันเชื่อมต่อสายแบบใหม่ (เครื่องที่รอสายต่อกับหมายเลขปลายทาง)
  const connectCallToTarget = async targetNumber => {
    try {
      console.log('� เริ่มการเชื่อมต่อสายแบบใหม่');
      console.log('� เครื่องที่รอสายจะต่อกับ:', targetNumber);

      // ใช้ domain จาก config หรือ default domain
      const domain =
        config && config.domain ? config.domain : 'your-sip-domain.com';

      const targetUri = targetNumber.includes('@')
        ? targetNumber
        : `sip:${targetNumber.trim()}@${domain}`;

      setCallStatus(`กำลังเชื่อมต่อไป ${targetNumber}...`);

      // Step 1: Hold สายเดิมไว้ก่อน
      await holdCall();
      console.log('� Hold สายเดิมแล้ว');

      // Step 2: โทรไปหาหมายเลขปลายทาง
      console.log('📞 กำลังโทรไปหา:', targetUri);

      const newCall = await CallManager.makeCall(endpointRef, accountRef, targetUri, {
        headers: {
          'X-Transfer-Type': 'Connect-Call',
        },
      });

      setCallStatus(`รอ ${targetNumber} รับสาย...`);

      // Step 3: รอให้หมายเลขปลายทางรับสาย
      return new Promise(resolve => {
        const checkCallStatus = () => {
          if (newCall && newCall.state === 'confirmed') {
            setCallStatus('กำลังเชื่อมต่อสาย...');

            // Step 4: เชื่อมต่อสายเดิมกับสายใหม่
            setTimeout(async () => {
              try {
                // Unhold สายเดิม
                await unholdCall();

                // วางสายของเราและให้สายทั้งสองต่อกัน
                if (typeof endpointRef.xferCall === 'function') {
                  await endpointRef.xferCall(
                    accountRef,
                    currentCallRef,
                    targetUri,
                  );
                } else if (typeof currentCallRef.transfer === 'function') {
                  await currentCallRef.transfer(targetUri);
                }

                // แสดงผลลัพธ์
                Alert.alert(
                  'เชื่อมต่อสำเร็จ',
                  `✅ เชื่อมต่อสายสำเร็จ!\n\n` +
                    `ตอนนี้:\n` +
                    `• ฝ่ายที่รออยู่กำลังคุยกับ ${targetNumber}\n` +
                    `• คุณได้ออกจากการสนทนาแล้ว\n` +
                    `• ทั้งสองฝ่ายสามารถคุยกันต่อได้`,
                );

                // รีเซ็ตสถานะ
                setTimeout(() => {
                  setIsInCall(false);
                  setCurrentCallRef(null);
                  setCurrentCallNumber('');
                  setIsHold(false);
                  setCallStatus('');
                  AudioManager.resetAudioMode();
                }, 2000);

                resolve(true);
              } catch (error) {
                console.error('❌ เชื่อมต่อสายไม่สำเร็จ:', error);
                Alert.alert(
                  'ข้อผิดพลาด',
                  `ไม่สามารถเชื่อมต่อสายได้: ${error.message}`,
                );
                resolve(false);
              }
            }, 1000);
          } else {
            // ยังไม่รับสาย ตรวจสอบอีกครั้งใน 1 วินาที
            setTimeout(checkCallStatus, 1000);
          }
        };

        // เริ่มตรวจสอบสถานะ
        setTimeout(checkCallStatus, 1000);

        // ตั้ง timeout 30 วินาที ถ้าไม่รับสาย
        setTimeout(() => {
          Alert.alert('หมดเวลา', `${targetNumber} ไม่รับสาย\nกลับไปสถานะเดิม`, [
            {
              text: 'ตกลง',
              onPress: async () => {
                try {
                  // วางสายใหม่ด้วยวิธีที่ปลอดภัย
                  if (newCall) {
                    try {
                      await CallManager.hangupCall(newCall);
                    } catch (hangupError) {
                      console.log(
                        '⚠️ ไม่สามารถวางสายใหม่ได้:',
                        hangupError.message,
                      );
                    }
                  }
                  // Unhold สายเดิม
                  await unholdCall();
                  setCallStatus('กลับสู่การสนทนาเดิม');
                } catch (error) {
                  console.error('Error returning to original call:', error);
                }
                resolve(false);
              },
            },
          ]);
        }, 30000);
      });
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการเชื่อมต่อสาย:', error);
      setCallStatus('เชื่อมต่อสายไม่สำเร็จ');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถเชื่อมต่อสายได้: ${error.message}`);
      return false;
    }
  };

  // โอนสายแบบ Attended Transfer (มีการสนทนาก่อนโอน)
  // รองรับทั้งการโทรออกและรับสายเข้า
  const attendedTransfer = async targetNumber => {
    console.log('🔍 ตรวจสอบสถานะสำหรับ Attended Transfer:');
    console.log('📞 currentCallRef:', !!currentCallRef);
    console.log('📞 isInCall:', isInCall);
    console.log('📞 currentCallNumber:', currentCallNumber);

    if (!currentCallRef) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่กำลังโทรอยู่');
      return false;
    }

    if (!isInCall) {
      Alert.alert('ข้อผิดพลาด', 'ไม่มีสายที่เชื่อมต่ออยู่');
      return false;
    }

    if (!targetNumber || !targetNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุหมายเลขที่ต้องการโอนสาย');
      return false;
    }

    try {
      // เริ่มสายปรึกษาผ่าน TransferManager
      const consultCall = await TransferManager.startConsultCall({
        endpointRef,
        accountRef,
        targetNumber,
        config
      });

      if (consultCall) {
        // บันทึกข้อมูลการโอนสาย
        setAttendedTransferState({
          originalCallRef: currentCallRef,
          consultCallRef: consultCall,
          targetNumber: targetNumber,
          step: 'consulting',
          isConsulting: true,
        });

        // นำทางไปหน้า AttendedTransferScreen
        if (navigationRef?.current) {
          navigationRef.current.navigate('AttendedTransfer', {
            originalCall: currentCallRef,
            consultCall: consultCall,
            targetNumber: targetNumber,
          });
        }

        return true;
      } else {
        throw new Error('ไม่สามารถเริ่มสายปรึกษาได้');
      }
    } catch (error) {
      console.error('❌ Error in attended transfer:', error);
      setCallStatus('❌ ไม่สามารถโอนสายแบบ Attended ได้');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันสำหรับการโอนสายทันทีหรือเสร็จสิ้น attended transfer
  const handleCompleteTransfer = async () => {
    try {
      const { originalCallRef, consultCallRef, targetNumber } =
        attendedTransferState;

      console.log('🔍 ตรวจสอบสถานะการโอนสาย:');
      console.log('🔍 targetNumber:', targetNumber);
      console.log('🔍 originalCallRef:', !!originalCallRef);
      console.log('🔍 consultCallRef:', !!consultCallRef);
      console.log('🔍 currentCallRef:', !!currentCallRef);
      console.log('🔍 isInCall:', isInCall);

      // กรณีที่ 1: มีการทำ Attended Transfer ครบถ้วน
      if (originalCallRef && consultCallRef && targetNumber) {
        return await TransferManager.performAttendedTransfer({
          endpointRef,
          accountRef,
          originalCallRef,
          consultCallRef,
          targetNumber,
          config
        });
      }

      // กรณีที่ 2: ใช้ targetNumber จาก state แต่ยังไม่เสร็จขั้นตอน attended
      if (targetNumber && currentCallRef && isInCall) {
        return await performUnattendedTransfer(targetNumber);
      }

      // กรณีที่ 3: ไม่มี targetNumber ให้ขอจากผู้ใช้
      console.log('❓ ไม่มี targetNumber ให้ขอจากผู้ใช้');
      Alert.alert('โอนสาย', 'กรุณาระบุหมายเลขที่ต้องการโอนสาย', [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ระบุหมายเลข',
          onPress: () => {
            // เปิด Transfer Keypad เพื่อให้ผู้ใช้ใส่หมายเลข
            setTransferType('unattended');
            setShowTransferKeypad(true);
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Error in handleCompleteTransfer:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
    }
  };
  const completeAttendedTransfer = async () => {
    try {
      const { originalCallRef, consultCallRef, targetNumber } = attendedTransferState;

      // ถ้าไม่มี targetNumber ให้ขอจากผู้ใช้
      if (!targetNumber) {
        Alert.alert(
          'กรุณาระบุหมายเลข',
          'กรุณาใส่หมายเลขที่จะโอนสายไป',
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ตกลง',
              onPress: inputNumber => {
                if (inputNumber) {
                  performUnattendedTransfer(inputNumber);
                }
              },
            },
          ],
          { type: 'plain-text-input' },
        );
        return;
      }

      // ถ้าไม่มี consultCallRef หรือ originalCallRef ให้ใช้ unattended transfer แทน
      if (!consultCallRef || !originalCallRef) {
        console.log('🔄 ไม่มี Attended Transfer State ที่สมบูรณ์ ใช้ Unattended Transfer แทน...');
        Alert.alert(
          'โอนสายทันที',
          `ไม่พบการโทรปรึกษา จะโอนสายแบบทันทีไปยัง ${targetNumber} แทน\n\nต้องการดำเนินการต่อหรือไม่?`,
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'โอนเลย',
              onPress: async () => {
                try {
                  await performUnattendedTransfer(targetNumber);
                } catch (error) {
                  console.error('❌ Unattended transfer failed:', error);
                }
              },
            },
          ],
        );
        return;
      }

      setCallStatus(`กำลังโอนสายไป ${targetNumber}...`);

      // ใช้ TransferManager แทนโค้ดเก่า
      const success = await TransferManager.performAttendedTransfer({
        endpointRef,
        accountRef,
        originalCallRef,
        consultCallRef,
        targetNumber,
        config
      });

      if (success) {
        // รีเซ็ตสถานะ
        setIsInCall(false);
        setCurrentCallRef(null);
        setCurrentCallNumber('');
        setIsHold(false);
        setCallStatus('โอนสายสำเร็จ');

        setAttendedTransferState({
          originalCallRef: null,
          consultCallRef: null,
          targetNumber: '',
          step: 'idle',
          isConsulting: false,
        });

        AudioManager.resetAudioMode();
        Alert.alert('สำเร็จ', `โอนสายไป ${targetNumber} สำเร็จแล้ว`);
        return true;
      } else {
        throw new Error('การโอนสายล้มเหลว');
      }
    } catch (error) {
      console.error('❌ Error completing attended transfer:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันใหม่: โอนสายโดยให้หมายเลขที่โทรมาโทรไปยังหมายเลขปลายทางทันที (ใช้ TransferManager)
  const handleDirectTransferToTarget = async () => {
    try {
      const { originalCallRef, consultCallRef } = attendedTransferState;
      const targetNumber = (transferTargetNumber || attendedTransferState.targetNumber).trim();

      console.log(`📞 จะโอนสายไปยัง: ${targetNumber}`);
      setCallStatus(`กำลังโอนสายให้ caller โทรไป ${targetNumber} ทันที...`);

      // ใช้ TransferManager แทนโค้ดเก่า
      const success = await TransferManager.performAttendedTransfer({
        endpointRef,
        accountRef, 
        originalCallRef,
        consultCallRef,
        targetNumber,
        config
      });

      if (success) {
        // รีเซ็ต state
        setAttendedTransferState({
          originalCallRef: null,
          consultCallRef: null,
          targetNumber: '',
          step: 'idle',
          isConsulting: false,
        });
        setTransferTargetNumber('');
        setCurrentCallRef(null);
        setCurrentCallNumber('');
        setIsInCall(false);
        setIsHold(false);

        // ทำความสะอาด audio mode
        try {
          AudioManager.resetAudioMode();
        } catch (audioError) {}

        setCallStatus(`สายโอนสำเร็จ - ผู้โทรกำลังเชื่อมต่อกับ ${targetNumber}`);

        // กลับไปหน้า Softphone
        setTimeout(() => {
          if (navigationRef && navigationRef.current) {
            navigationRef.current.navigate('Softphone');
          }
          setTimeout(() => setCallStatus(''), 2000);
        }, 1000);

        Alert.alert('🎉 โอนสายสำเร็จ', `การโอนสายไป ${targetNumber} เสร็จสมบูรณ์!`);
        return true;
      } else {
        throw new Error('การโอนสายล้มเหลว');
      }
    } catch (error) {
      console.error('❌ Error in handleDirectTransferToTarget:', error);

      // รีเซ็ต state ในกรณีเกิดข้อผิดพลาด
      setAttendedTransferState({
        originalCallRef: null,
        consultCallRef: null,
        targetNumber: '',
        step: 'idle',
        isConsulting: false,
      });
      setTransferTargetNumber('');
      setCallStatus('เกิดข้อผิดพลาดในการโอนสาย');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
      return false;
    }
  };

  // แสดง Transfer Keypad แบบ Unattended
  const showUnattendedTransferDialog = () => {
    console.log('🔍 ตรวจสอบสถานะก่อนแสดง Transfer Keypad:');
    console.log('📋 currentCallRef:', !!currentCallRef);
    console.log('📋 isInCall:', isInCall);
    console.log('📋 endpointRef:', !!endpointRef);
    console.log('📋 accountRef:', !!accountRef);
    console.log('📋 config:', config);

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
    console.log('🔍 ตรวจสอบสถานะก่อนแสดง Attended Transfer Keypad:');
    console.log('📋 currentCallRef:', !!currentCallRef);
    console.log('📋 isInCall:', isInCall);
    console.log('📋 endpointRef:', !!endpointRef);
    console.log('📋 accountRef:', !!accountRef);

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
      // บันทึก target number ไว้ในตัวแปรแยก
      setTransferTargetNumber(targetNumber);

      if (type === 'unattended') {
        return await performUnattendedTransfer(targetNumber);
      } else if (type === 'attended') {
        // สำหรับ attended transfer ใช้ TransferManager
        return await TransferManager.performAttendedTransfer({
          endpointRef,
          accountRef,
          originalCallRef: currentCallRef,
          consultCallRef: null, // ยังไม่มีสายปรึกษา
          targetNumber,
          config
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

  // สิ้นสุดฟังก์ชันการโอนสาย (Call Transfer)

  // ฟังก์ชันไปยังหน้า CallingScreen
  const navigateToCalling = navigation => {
    if (isInCall) {
      navigation.navigate('Calling');
    }
  };

  // Wrapper component สำหรับ CallingScreen เพื่อจัดการ navigationRef
  const CallingScreenWrapper = props => {
    useFocusEffect(
      React.useCallback(() => {
        // ตั้งค่า navigation reference เมื่อเข้าหน้า CallingScreen
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
        // เพิ่มฟังก์ชันการโอนสาย
        showUnattendedTransferDialog={showUnattendedTransferDialog}
        showAttendedTransferDialog={showAttendedTransferDialog}
        // conference handlers (from ConferenceCallManager ref)
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
        // Conference Bridge handlers
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
      <Stack.Navigator initialRouteName="Softphone">
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
          {props => (
            <AttendedTransferScreen
              {...props}
            />
          )}
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
            <HomeScreen
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
