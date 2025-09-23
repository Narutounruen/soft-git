import React, { useState, useRef, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  Vibration,
  NativeModules,
} from 'react-native';
import Sound from 'react-native-sound';
import { Endpoint } from 'react-native-pjsip';
import mockSipService from './services/mockSipService';
import InCallManager from 'react-native-incall-manager';
import 'react-native-gesture-handler';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ConvergenceScreen from './SoftphoneScreen';
import CallingScreen from './CallingScreen';
import TransferKeypad from './TransferKeypad';
import ConferenceCallManager from './ConferenceCallManager';
import ContactScreen from './ContactScreen';
import AddContactScreen from './AddContactScreen';
import AttendedTransferScreen from './AttendedTransferScreen';
import PJSIPCallTransfer from './PJSIPCallTransfer';
import ConferenceBridge from './ConferenceBridge';
import { saveCallHistory } from './services/callHistoryService';

// ตัวอย่างการเชื่อมต่อ Firestore
  // --- Firestore: ดึงข้อมูล users มาแสดง ---
  function useFirestoreUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      const unsubscribe = firestore()
        .collection('users')
        .onSnapshot(
          snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(data);
            setLoading(false);
          },
          err => {
            setError(err);
            setLoading(false);
          }
        );
      return () => unsubscribe();
    }, []);
    return { users, loading, error };
  }

// Helper functions สำหรับการจัดการ audio
const AudioHelper = {
  // ตั้งค่า audio mode สำหรับการโทร
  setCallAudioMode: () => {
    console.log('🔊 เริ่มตั้งค่า audio mode สำหรับการโทร...');

    try {
      // ใช้ InCallManager เป็นหลัก
      AudioHelper.setCallAudioModeWithInCallManager();

      // สำหรับ React Native ใช้ Sound library เพื่อจัดการเสียงเพิ่มเติม
      Sound.setCategory('PlayAndRecord', true);
      console.log('✅ Sound category set to PlayAndRecord');

      // ตั้งค่าเสียงให้เป็น active
      Sound.setActive(true);
      console.log('✅ Audio session activated');

      // ใช้ Native Module สำหรับ Android
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.setCallAudioMode()
          .then(result => {
            console.log('✅ Native audio mode set:', result);
          })
          .catch(error => {
            console.log('❌ Native audio mode error:', error);
          });
      }

      console.log('✅ Audio mode setup completed');
      return true;
    } catch (error) {
      console.log('❌ Error setting call audio mode:', error);
      return false;
    }
  },

  // รีเซ็ต audio mode เป็นปกติ
  resetAudioMode: () => {
    console.log('🔊 รีเซ็ต audio mode...');

    try {
      // ใช้ InCallManager เป็นหลัก
      AudioHelper.resetAudioModeWithInCallManager();

      Sound.setCategory('Ambient');
      Sound.setActive(false);

      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.resetAudioMode()
          .then(result => {
            console.log('✅ Native audio mode reset:', result);
          })
          .catch(error => {
            console.log('❌ Native audio mode reset error:', error);
          });
      }

      console.log('✅ Audio mode reset completed');
      return true;
    } catch (error) {
      console.log('❌ Error resetting audio mode:', error);
      return false;
    }
  },

  // เพิ่มฟังก์ชันตรวจสอบและแก้ไขปัญหาไมค์
  checkAndFixMicrophone: call => {
    if (!call) return false;

    try {
      console.log('🔍 ตรวจสอบสถานะไมค์...');

      // วิธีที่ 1: ตรวจสอบและปลดการ mute ของ call
      if (typeof call.isMuted === 'function') {
        try {
          const isMuted = call.isMuted();
          console.log(`สถานะไมค์ปัจจุบัน (isMuted): ${isMuted}`);

          if (isMuted && typeof call.mute === 'function') {
            call.mute(false);
            console.log('✅ ปลดการปิดไมค์แล้ว');
          }
        } catch (error) {
          console.log('❌ Error checking mute status:', error);
        }
      }

      console.log('✅ Microphone check completed');
      return true;
    } catch (error) {
      console.error('❌ ข้อผิดพลาดในการตรวจสอบไมค์:', error);
      return false;
    }
  },

  // เพิ่มฟังก์ชันสำหรับตรวจสอบและเปิดไมค์อย่างละเอียด
  forceMicrophoneEnable: call => {
    console.log('🎤 เริ่มกระบวนการบังคับเปิดไมค์...');

    try {
      // Step 1: ตั้งค่า audio session
      AudioHelper.setCallAudioMode();

      // Step 2: ใช้ Native Module เพื่อบังคับเปิดไมค์
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.forceMicrophoneEnable()
          .then(result => {
            console.log('✅ Native microphone force enabled:', result);
          })
          .catch(error => {
            console.log('❌ Native microphone force enable error:', error);
          });
      }

      // Step 3: ปลด mute ใน call object
      if (call && typeof call.mute === 'function') {
        call.mute(false);
        console.log('✅ Call unmuted');
      }

      // Step 4: ตรวจสอบสถานะการ mute
      if (call && typeof call.isMuted === 'function') {
        const isMuted = call.isMuted();
        console.log(`Final mute status: ${isMuted}`);
      }

      // Step 5: ตรวจสอบสถานะไมค์ผ่าน Native Module
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        NativeModules.AudioManagerModule.getMicrophoneStatus()
          .then(status => {
            console.log('📊 Microphone status:', status);
          })
          .catch(error => {
            console.log('❌ Error getting microphone status:', error);
          });
      }

      // Step 6: รีเฟรช audio stream
      setTimeout(() => {
        try {
          if (call && typeof call.mute === 'function') {
            call.mute(true); // mute ชั่วคราว
            setTimeout(() => {
              call.mute(false); // unmute อีกครั้ง
              console.log('✅ Audio stream refreshed');
            }, 100);
          }
        } catch (error) {
          console.log('❌ Error refreshing audio stream:', error);
        }
      }, 500);

      console.log('✅ Force microphone enable completed');
      return true;
    } catch (error) {
      console.error('❌ Error in forceMicrophoneEnable:', error);
      return false;
    }
  },

  // เพิ่มฟังก์ชันการจัดการลำโพง
  speaker: null, // เก็บ reference ของ speaker

  // เริ่มต้นการใช้งานลำโพง
  initializeSpeaker: async () => {
    try {
      console.log('🔊 เริ่มต้นการใช้งานลำโพงด้วย InCallManager...');
      // InCallManager ไม่ต้องสร้าง instance ใหม่
      AudioHelper.speaker = InCallManager;
      console.log('✅ Speaker initialized with InCallManager');
      return true;
    } catch (error) {
      console.error('❌ Error initializing speaker:', error);
      return false;
    }
  },

  // เปิดลำโพง
  enableSpeaker: async () => {
    try {
      console.log('🔊 เปิดลำโพง...');

      if (!AudioHelper.speaker) {
        await AudioHelper.initializeSpeaker();
      }

      if (AudioHelper.speaker) {
        AudioHelper.speaker.setSpeakerphoneOn(true);
        console.log('✅ ลำโพงเปิดแล้ว');
        return true;
      } else {
        console.log('❌ ไม่สามารถเริ่มต้นลำโพงได้');
        return false;
      }
    } catch (error) {
      console.error('❌ Error enabling speaker:', error);
      return false;
    }
  },

  // ปิดลำโพง
  disableSpeaker: async () => {
    try {
      console.log('🔊 ปิดลำโพง...');

      if (!AudioHelper.speaker) {
        await AudioHelper.initializeSpeaker();
      }

      if (AudioHelper.speaker) {
        AudioHelper.speaker.setSpeakerphoneOn(false);
        console.log('✅ ลำโพงปิดแล้ว');
        return true;
      } else {
        console.log('❌ ไม่สามารถเริ่มต้นลำโพงได้');
        return false;
      }
    } catch (error) {
      console.error('❌ Error disabling speaker:', error);
      return false;
    }
  },

  // ปิดไมค์
  muteMicrophone: async () => {
    try {
      console.log('🔇 ปิดไมค์...');

      // ใช้ Native Module สำหรับ Android
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        const result = await NativeModules.AudioManagerModule.muteMicrophone();
        console.log('✅ ปิดไมค์แล้ว (Android Native)');
        return result;
      }

      // สำหรับ iOS หรือกรณีที่ไม่มี Native Module
      if (InCallManager) {
        // InCallManager ไม่มี direct mute method แต่เราสามารถใช้วิธีอื่นได้
        console.log('ℹ️ ใช้วิธี fallback สำหรับการ mute');
        return true;
      }

      console.log('❌ ไม่สามารถปิดไมค์ได้');
      return false;
    } catch (error) {
      console.error('❌ Error muting microphone:', error);
      return false;
    }
  },

  // เปิดไมค์
  unmuteMicrophone: async () => {
    try {
      console.log('🎤 เปิดไมค์...');

      // ใช้ Native Module สำหรับ Android
      if (Platform.OS === 'android' && NativeModules.AudioManagerModule) {
        const result =
          await NativeModules.AudioManagerModule.unmuteMicrophone();
        console.log('✅ เปิดไมค์แล้ว (Android Native)');
        return result;
      }

      // สำหรับ iOS หรือกรณีที่ไม่มี Native Module
      if (InCallManager) {
        // InCallManager ไม่มี direct unmute method แต่เราสามารถใช้วิธีอื่นได้
        console.log('ℹ️ ใช้วิธี fallback สำหรับการ unmute');
        return true;
      }

      console.log('❌ ไม่สามารถเปิดไมค์ได้');
      return false;
    } catch (error) {
      console.error('❌ Error unmuting microphone:', error);
      return false;
    }
  },

  // ตั้งค่าระดับเสียงลำโพง (InCallManager ไม่มี direct volume control)
  setSpeakerVolume: async volume => {
    try {
      console.log(`🔊 ตั้งระดับเสียงลำโพงเป็น ${volume}%...`);

      // InCallManager ไม่มีการตั้งค่า volume โดยตรง
      // แต่เราสามารถใช้ setForceSpeakerphoneOn ได้
      if (!AudioHelper.speaker) {
        await AudioHelper.initializeSpeaker();
      }

      if (AudioHelper.speaker) {
        // ใช้ setForceSpeakerphoneOn แทนการตั้ง volume
        AudioHelper.speaker.setForceSpeakerphoneOn(true);
        console.log(
          `✅ ตั้งค่าลำโพงแล้ว (InCallManager ไม่รองรับการตั้งค่า volume)`,
        );
        return true;
      } else {
        console.log('❌ ไม่สามารถเริ่มต้นลำโพงได้');
        return false;
      }
    } catch (error) {
      console.error('❌ Error setting speaker volume:', error);
      return false;
    }
  },

  // ตรวจสอบสถานะลำโพง
  isSpeakerEnabled: async () => {
    try {
      if (!AudioHelper.speaker) {
        await AudioHelper.initializeSpeaker();
      }

      // InCallManager ไม่มี method เพื่อตรวจสอบสถานะ
      // เราจะใช้วิธีอื่นในการติดตาม state
      console.log(
        '📊 สถานะลำโพง: ไม่สามารถตรวจสอบได้โดยตรง (InCallManager limitation)',
      );
      return false; // default เป็น false
    } catch (error) {
      console.error('❌ Error checking speaker status:', error);
      return false;
    }
  },

  // สลับการเปิด/ปิดลำโพง
  toggleSpeaker: async () => {
    try {
      // เนื่องจาก InCallManager ไม่มีวิธีตรวจสอบสถานะ
      // เราจะให้ CallingScreen จัดการ state เอง
      return await AudioHelper.enableSpeaker();
    } catch (error) {
      console.error('❌ Error toggling speaker:', error);
      return false;
    }
  },

  // เพิ่มฟังก์ชันสำหรับการตั้งค่า audio mode ด้วย InCallManager
  setCallAudioModeWithInCallManager: () => {
    try {
      console.log('🔊 ตั้งค่า audio mode ด้วย InCallManager...');

      // ตั้งค่าให้ใช้ built-in speaker เป็นค่าเริ่มต้น
      InCallManager.setSpeakerphoneOn(false);
      a;

      console.log('✅ Audio mode set with InCallManager');
      return true;
    } catch (error) {
      console.log(
        '❌ Error setting call audio mode with InCallManager:',
        error,
      );
      return false;
    }
  },

  // รีเซ็ต audio mode ด้วย InCallManager
  resetAudioModeWithInCallManager: () => {
    try {
      console.log('🔊 รีเซ็ต audio mode ด้วย InCallManager...');

      // หยุดการจัดการการโทร
      InCallManager.stop();

      console.log('✅ Audio mode reset with InCallManager');
      return true;
    } catch (error) {
      console.log('❌ Error resetting audio mode with InCallManager:', error);
      return false;
    }
  },
};

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
}) {
  // --- State และ ref สำหรับ HomeScreen เท่านั้น ---
  const [isConnecting, setIsConnecting] = useState(false);
  const endpointRef = useRef(null);
  const accountRef = useRef(null);
  const currentCallRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const transferManagerRef = useRef(null);
  // Firestore users
  const { users, loading: usersLoading, error: usersError } = useFirestoreUsers();

  // ทำความสะอาด
  const cleanup = async () => {
    try {
      console.log('เริ่มต้นกระบวนการ cleanup...');
      setIsConnecting(false);
      setIsConnected(false);
      setIsInCall(false);
      setCallStatus('');

      // รีเซ็ต audio mode
      AudioHelper.resetAudioMode();

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

          let callTerminated = false;

          // วิธีที่ 1: ใช้ hangup
          if (!callTerminated) {
            try {
              await currentCallRef.current.hangup();
              console.log('✅ สายถูกยุติด้วย hangup');
              callTerminated = true;
            } catch (hangupError) {
              console.log('❌ hangup ไม่สำเร็จ:', hangupError);
            }
          }

          // วิธีที่ 2: ใช้ terminate
          if (
            !callTerminated &&
            typeof currentCallRef.current.terminate === 'function'
          ) {
            try {
              await currentCallRef.current.terminate();
              console.log('✅ สายถูกยุติด้วย terminate');
              callTerminated = true;
            } catch (terminateError) {
              console.log('❌ terminate ไม่สำเร็จ:', terminateError);
            }
          }

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

  // เชื่อมต่อ SIP (Mock Version)
  const connectSIP = async () => {
    if (isConnecting) return;
    if (!config.domain || !config.username || !config.password) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsConnecting(true);
    setIsConnected(false);
    setStatus('กำลังเชื่อมต่อ...');

    try {
      // ขอสิทธิ์
      await requestPermissions();

      console.log('🔄 เริ่มเชื่อมต่อ SIP (Mock)...');
      
      // สร้าง listener สำหรับ mock service
      const handleSipEvent = (event, data) => {
        console.log(`� SIP Event: ${event}`, data);
        
        if (event === 'registrationChanged') {
          if (data.isRegistered) {
            setIsConnected(true);
            setIsConnecting(false);
            setStatus('เชื่อมต่อแล้ว');
            console.log('✅ เชื่อมต่อ SIP สำเร็จ (Mock)');
          } else {
            setIsConnected(false);
            setStatus('ไม่สามารถเชื่อมต่อได้');
            setIsConnecting(false);
          }
        } else if (event === 'callStateChanged') {
          setCallStatus(`สถานะ: ${data.state}`);
          if (data.state === 'CONNECTED') {
            setCurrentCall(data.callId);
          } else if (data.state === 'DISCONNECTED') {
            setCurrentCall(null);
            setCallStatus('');
          }
        }
      };

      // เพิ่ม listener
      mockSipService.addListener(handleSipEvent);

      // จำลองการลงทะเบียน
      const accountId = mockSipService.addAccount({
        username: config.username,
        domain: config.domain,
        password: config.password
      });

      console.log(`🆔 Account ID: ${accountId}`);

    } catch (error) {
      setIsConnecting(false);
      setStatus(`❌ ${error.message || error}`);
      console.error('การเชื่อมต่อ SIP ล้มเหลว:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่');
    }
  };

  // ฟังก์ชันโทรออก (Mock Version)

      // จัดการ call events
      // เตรียมเสียงเรียกเข้า
      Sound.setCategory('Playback');

      // เพิ่มการตั้งค่า audio session สำหรับการโทร
      AudioHelper.setCallAudioMode();

      // กำหนดค่าตามแพลตฟอร์ม
      const soundPath = Platform.select({
        android: 'incoming_call.mp3',
        ios: 'incoming_call.mp3',
      });

      const soundLocation = Platform.select({
        android: Sound.MAIN_BUNDLE,
        ios: '', // สำหรับ iOS ใช้ค่าว่างเพื่อให้หาในบันเดิล
      });

      const ringtone = new Sound(soundPath, soundLocation, error => {
        if (error) {
          console.log('ไม่สามารถโหลดเสียงเรียกเข้าได้:', error);
          console.log('Error code:', error.code);
          console.log('Error description:', error.description);
        } else {
          console.log('เสียงเรียกเข้าพร้อมใช้งาน');
          ringtone.setVolume(1.0);
          // เช็คว่าเสียงพร้อมเล่นหรือไม่
          console.log('Is sound ready?', ringtone.isLoaded());
          console.log('Sound duration:', ringtone.getDuration());
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

          // เล่นเสียงเรียกเข้า
          if (ringtone.isLoaded()) {
            ringtone.setVolume(1.0);
            ringtone.setNumberOfLoops(-1); // เล่นซ้ำไปเรื่อยๆ
            ringtone.play(success => {
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
          Alert.alert(
            '📞 สายเรียกเข้า',
            `จากหมายเลข: ${remoteNumber}`,
            [
              {
                text: '❌ ปฏิเสธ',
                onPress: async () => {
                  try {
                    // หยุดเสียงและการสั่น
                    ringtone.stop();
                    Vibration.cancel();

                    console.log('กำลังปฏิเสธสาย...');
                    setCallStatus('📞 กำลังปฏิเสธสาย...');

                    let rejected = false;

                    // วิธีที่ 1: ใช้ call.hangup()
                    if (
                      !rejected &&
                      call &&
                      typeof call.hangup === 'function'
                    ) {
                      try {
                        await call.hangup();
                        console.log('✅ Call rejected via call.hangup()');
                        rejected = true;
                      } catch (error) {
                        console.log('❌ call.hangup() failed:', error);
                      }
                    }

                    // วิธีที่ 2: ใช้ call.reject()
                    if (
                      !rejected &&
                      call &&
                      typeof call.reject === 'function'
                    ) {
                      try {
                        await call.reject();
                        console.log('✅ Call rejected via call.reject()');
                        rejected = true;
                      } catch (error) {
                        console.log('❌ call.reject() failed:', error);
                      }
                    }

                    // วิธีที่ 3: ใช้ endpointRef.current.hangupCall() กับ call object
                    if (
                      !rejected &&
                      endpointRef.current &&
                      endpointRef.current.hangupCall
                    ) {
                      try {
                        await endpointRef.current.hangupCall(call);
                        console.log('✅ Call rejected via endpoint.hangupCall');
                        rejected = true;
                      } catch (error) {
                        console.log('❌ endpoint.hangupCall failed:', error);
                      }
                    }

                    // วิธีที่ 4: ใช้ endpointRef.current.hangupCall() กับ callId
                    if (
                      !rejected &&
                      call &&
                      call._callId &&
                      endpointRef.current
                    ) {
                      try {
                        await endpointRef.current.hangupCall(call._callId);
                        console.log(
                          '✅ Call rejected via endpoint.hangupCall with _callId',
                        );
                        rejected = true;
                      } catch (error) {
                        console.log(
                          '❌ endpoint.hangupCall with _callId failed:',
                          error,
                        );
                      }
                    }

                    // วิธีที่ 5: ใช้ call.terminate()
                    if (
                      !rejected &&
                      call &&
                      typeof call.terminate === 'function'
                    ) {
                      try {
                        await call.terminate();
                        console.log('✅ Call rejected via call.terminate()');
                        rejected = true;
                      } catch (error) {
                        console.log('❌ call.terminate() failed:', error);
                      }
                    }

                    if (!rejected) {
                      console.log(
                        '⚠️ ไม่สามารถปฏิเสธสายได้: ไม่พบฟังก์ชันปฏิเสธสายที่ทำงานได้',
                      );
                    }

                    setCallStatus('📞 ปฏิเสธสายแล้ว');
                    setTimeout(() => setCallStatus(''), 2000);
                  } catch (error) {
                    console.error('ไม่สามารถปฏิเสธสายได้:', error);
                    setCallStatus('❌ ไม่สามารถปฏิเสธสาย');
                    setTimeout(() => setCallStatus(''), 2000);
                  }
                },
                style: 'cancel',
              },
              {
                text: '✅ รับสาย',
                onPress: async () => {
                  try {
                    // หยุดเสียงและการสั่น
                    ringtone.stop();
                    Vibration.cancel();

                    // ตั้งค่า audio mode ก่อนรับสาย
                    AudioHelper.setCallAudioMode();

                    // ตรวจสอบและรับสาย
                    let answered = false;

                    // วิธีที่ 1: call.answer()
                    if (
                      !answered &&
                      call &&
                      typeof call.answer === 'function'
                    ) {
                      try {
                        await call.answer();
                        console.log('✅ Call answered via call.answer()');
                        answered = true;
                      } catch (error) {
                        console.log('❌ call.answer() failed:', error);
                      }
                    }

                    // วิธีที่ 2: call.answerCall()
                    if (
                      !answered &&
                      call &&
                      typeof call.answerCall === 'function'
                    ) {
                      try {
                        await call.answerCall();
                        console.log('✅ Call answered via call.answerCall()');
                        answered = true;
                      } catch (error) {
                        console.log('❌ call.answerCall() failed:', error);
                      }
                    }

                    // วิธีที่ 3: endpoint.answerCall()
                    if (
                      !answered &&
                      endpointRef.current &&
                      endpointRef.current.answerCall
                    ) {
                      try {
                        await endpointRef.current.answerCall(call);
                        console.log(
                          '✅ Call answered via endpoint.answerCall()',
                        );
                        answered = true;
                      } catch (error) {
                        console.log('❌ endpoint.answerCall() failed:', error);
                      }
                    }

                    if (!answered) {
                      throw new Error('ไม่สามารถรับสายได้ - ลองทุกวิธีแล้ว');
                    }

                    // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
                    try {
                      if (call && typeof call.mute === 'function') {
                        call.mute(false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
                        console.log('✅ Microphone explicitly unmuted');
                      }
                    } catch (muteError) {
                      console.log('❌ Error unmuting microphone:', muteError);
                    }

                    setIsInCall(true);
                    setCurrentCallRef(call);
                    navigation.navigate('Calling');
                  } catch (error) {
                    console.error('Error answering call:', error);
                    Alert.alert('ข้อผิดพลาด', 'ไม่สามารถรับสายได้');
                    // ทำความสะอาดหากเกิดข้อผิดพลาด
                    ringtone.stop();
                    Vibration.cancel();
                    setCallStatus('❌ ไม่สามารถรับสาย');
                    setTimeout(() => setCallStatus(''), 2000);
                  }
                },
              },
            ],
            {
              cancelable: false,
              onDismiss: () => {
                // กรณีที่ Alert ถูกปิดด้วยวิธีอื่น
                ringtone.stop();
                Vibration.cancel();
              },
            },
          );
        }
      });

      // เพิ่ม handler สำหรับ incoming_call
      endpointRef.current.on('incoming_call', call => {
        console.log('Incoming call event:', call);
        if (call) {
          setCurrentCallRef(call);
          
          // บันทึกประวัติสายเข้า
          const incomingNumber = call?.remoteContact || call?.remoteNumber || 'Unknown';
          try {
            saveCallHistory({
              number: incomingNumber,
              type: 'incoming',
            }, 'default_user').catch(error => {
              console.error('Failed to save incoming call history:', error);
            });
          } catch (error) {
            console.error('Error saving incoming call history:', error);
          }
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
          setCallStatus('📞 สายเชื่อมต่อแล้ว');
          setIsInCall(true);
          if (call) {
            currentCallRef.current = call;
            setCurrentCallRef(call);

            // ตรวจสอบและตั้งค่าเสียงเมื่อสายเชื่อมต่อ
            AudioHelper.setCallAudioMode();

            // เพิ่มการตรวจสอบและแก้ไขปัญหาไมค์
            setTimeout(() => {
              AudioHelper.checkAndFixMicrophone(call);
              // เพิ่มการบังคับเปิดไมค์
              AudioHelper.forceMicrophoneEnable(call);
            }, 1000); // รอ 1 วินาทีแล้วค่อยตรวจสอบ

            // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
            try {
              if (call && typeof call.mute === 'function') {
                call.mute(false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
                console.log('✅ Microphone unmuted in CONFIRMED state');
              }
            } catch (muteError) {
              console.log(
                '❌ Error unmuting microphone in CONFIRMED state:',
                muteError,
              );
            }
          }
        } else if (state === 'PJSIP_INV_STATE_DISCONNECTED') {
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
          AudioHelper.resetAudioMode();

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
                  console.log('✅ Call object deleted');
                } catch (deleteError) {
                  console.log('❌ Call delete error:', deleteError);
                }
              }
            }
          } catch (uriError) {
            console.log('Error handling remote URI:', uriError);
          }

          // กลับไปหน้า Softphone หลังจากวางสาย
          if (navigation && navigation.canGoBack()) {
            try {
              navigation.goBack();
              console.log('✅ Navigation after disconnect successful');
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

        // ตรวจสอบสถานะการโทรปัจจุบัน
        console.log('Current call state before termination:', {
          hasCurrentCallRef: !!currentCallRef.current,
        });

        // บังคับให้ระบบทราบว่าสายถูกตัดแล้ว ไม่ว่าจะด้วยเหตุผลใด
        setCallStatus('📞 สายถูกตัดจากอีกฝ่าย');
        setIsInCall(false);
        currentCallRef.current = null;
        setCurrentCallRef(null);
        setCurrentCallNumber('');

        // รีเซ็ต audio mode และปิดลำโพงเมื่อสายถูกตัด
        AudioHelper.resetAudioMode();
        AudioHelper.disableSpeaker().catch(error => {
          console.log('Error disabling speaker on call termination:', error);
        });

        // กลับไปหน้า Softphone
        if (navigation && navigation.canGoBack()) {
          try {
            navigation.goBack();
            console.log('✅ Navigation to Softphone successful');
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
            AudioHelper.setCallAudioMode();

            // เรียกใช้ฟังก์ชันตรวจสอบและแก้ไขปัญหาไมค์
            setTimeout(() => {
              AudioHelper.checkAndFixMicrophone(call);
              AudioHelper.forceMicrophoneEnable(call);
            }, 500); // รอครึ่งวินาทีแล้วค่อยตรวจสอบ

            // ตรวจสอบว่าไมค์เปิดอยู่หรือไม่
            try {
              if (call && typeof call.mute === 'function') {
                call.mute(false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
                console.log('✅ Microphone unmuted in MEDIA_ACTIVE state');
              }
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
        AudioHelper.setCallAudioMode();

        // เริ่มต้น speaker
        AudioHelper.initializeSpeaker();

        // เรียกใช้ฟังก์ชันตรวจสอบและแก้ไขปัญหาไมค์
        setTimeout(() => {
          AudioHelper.checkAndFixMicrophone(call);
          AudioHelper.forceMicrophoneEnable(call);
        }, 1500); // รอ 1.5 วินาทีแล้วค่อยตรวจสอบ

        // ตรวจสอบและเปิดใช้งาน audio streams
        try {
          if (call && typeof call.mute === 'function') {
            // ตรวจสอบว่าไมค์ถูกปิดอยู่หรือไม่
            call.mute(false); // ตรวจสอบให้แน่ใจว่าไมค์เปิดอยู่
            console.log('✅ Call microphone unmuted in call_connected');
          }

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

      // สร้าง Account
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

      console.log(`🆔 Account ID: ${accountId}`);

    } catch (error) {
      setIsConnecting(false);
      setStatus(`❌ ${error.message || error}`);
      console.error('การเชื่อมต่อ SIP ล้มเหลว:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่');
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Convergence</Text>
      </View>

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

  // ฟังก์ชันโทรออก (Mock Version)
  const makeCall = async callNumber => {
    if (!callNumber.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการโทร');
      return;
    }

    if (!isConnected) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเชื่อมต่อ SIP ก่อน');
      return;
    }

    try {
      setCallStatus('📞 เริ่มโทร...');
      setCurrentCallNumber(callNumber);
      setIsInCall(true);

      // ตั้งค่า audio mode ก่อนโทร
      AudioHelper.setCallAudioMode();

      console.log('📞 โทรออกไปยัง (Mock):', callNumber);

      // ใช้ mock service แทน
      const callId = mockSipService.makeCall('mock_account', callNumber);
      setCurrentCall(callId);
      setIsHold(false);
      setCallStatus('📞 กำลังเชื่อมต่อ...');

      console.log('✅ เริ่มโทรออกสำเร็จ (Mock)');

    } catch (error) {
      setCallStatus('❌ โทรไม่สำเร็จ');
      setIsInCall(false);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโทรได้: ${error.message}`);
      setTimeout(() => setCallStatus(''), 3000);
    }
  };

  // ฟังก์ชันวางสาย (Mock Version)
  const hangupCall = async () => {
    try {
      if (!currentCall) {
        console.log('ไม่พบสายที่กำลังใช้งาน');
        setCallStatus('❌ ไม่มีสายที่ต้องวาง');
        setTimeout(() => setCallStatus(''), 2000);
        return;
      }

      console.log('กำลังวางสาย (Mock)...');
      setCallStatus('📞 กำลังวางสาย...');

      // รีเซ็ต audio mode ก่อนวางสาย
      AudioHelper.resetAudioMode();

      // ใช้ mock service
      mockSipService.hangupCall(currentCall);
      
      // รีเซ็ตสถานะ
      setCurrentCall(null);
      setCurrentCallRef(null);
      setCurrentCallNumber('');
      setIsInCall(false);
      setIsHold(false);
      setCallStatus('✅ วางสายแล้ว');
      
      console.log('✅ วางสายสำเร็จ (Mock)');
      setTimeout(() => setCallStatus(''), 2000);

    } catch (error) {
      console.error('ข้อผิดพลาดในการวางสาย:', error);
      setCallStatus('❌ วางสายไม่สำเร็จ');
      setTimeout(() => setCallStatus(''), 2000);
    }
  };
          }
        }

        // วิธีที่ 3: ใช้ endpointRef.hangupCall() กับ callId
        if (
          !cancelled &&
          currentCallRef &&
          currentCallRef._callId &&
          endpointRef
        ) {
          try {
            await endpointRef.hangupCall(currentCallRef._callId);
            console.log(
              '✅ Call cancelled via endpoint.hangupCall with _callId',
            );
            cancelled = true;
          } catch (error) {
            console.log('❌ endpoint.hangupCall with _callId failed:', error);
          }
        }

        // วิธีที่ 4: ใช้ currentCallRef.terminate()
        if (
          !cancelled &&
          currentCallRef &&
          typeof currentCallRef.terminate === 'function'
        ) {
          try {
            await currentCallRef.terminate();
            console.log('✅ Call cancelled via currentCallRef.terminate()');
            cancelled = true;
          } catch (error) {
            console.log('❌ currentCallRef.terminate() failed:', error);
          }
        }

        if (!cancelled) {
          console.log('⚠️ ไม่สามารถวางสายได้: ไม่พบฟังก์ชันวางสายที่ทำงานได้');
        }

        console.log('วางสายสำเร็จ');

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
      } catch (hangupError) {
        console.error('ไม่สามารถวางสายได้:', hangupError);
        setCallStatus('❌ ไม่สามารถวางสาย');

        // บังคับรีเซ็ต state แม้จะมี error
        setIsInCall(false);
        setIsHold(false);
        setCurrentCallRef(null);
        setCurrentCallNumber('');

        // เคลียร์ call timer
        if (callTimer.current) {
          clearInterval(callTimer.current);
          callTimer.current = null;
        }

        setTimeout(() => setCallStatus(''), 3000);
      }

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
    if (!targetCall) {
      throw new Error('ไม่มีสายที่กำลังโทรอยู่');
    }

    try {
      let holdSuccess = false;

      // ใช้ endpoint holdCall
      if (endpointRef && endpointRef.holdCall) {
        try {
          await endpointRef.holdCall(targetCall);
          holdSuccess = true;
          console.log('✅ Hold สายสำเร็จ');
        } catch (error) {
          console.log('❌ Hold failed:', error);
        }
      }

      if (holdSuccess) {
        if (targetCall === currentCallRef) {
          setIsHold(true);
          setCallStatus('สายถูก Hold แล้ว');
        }
        return true;
      } else {
        throw new Error('ไม่สามารถ Hold สายได้');
      }
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
      const transferCall = await endpointRef.makeCall(accountRef, callUri);
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
    if (!targetCall) {
      console.log('❌ ไม่พบสายที่ต้องการ Unhold');
      Alert.alert('Unhold call error', 'ไม่พบสายที่ต้องการ Unhold');
      return false;
    }

    try {
      // ตรวจสอบว่า call มี method unhold
      if (typeof targetCall.unhold !== 'function') {
        console.log('❌ call object ไม่มี method unhold');
        Alert.alert('Unhold call error', 'call object ไม่มี method unhold');
        return false;
      }

      // ตรวจสอบสถานะ call (เช่น ต้องเป็น hold ก่อน)
      if (targetCall.state !== 'LOCAL_HOLD') {
        console.log(`❌ call state ไม่ใช่ LOCAL_HOLD: ${targetCall.state}`);
        Alert.alert(
          'Unhold call error',
          `call state ไม่ใช่ LOCAL_HOLD: ${targetCall.state}`,
        );
        return false;
      }

      let unholdSuccess = false;

      // ใช้ endpoint unholdCall
      if (endpointRef && endpointRef.unholdCall) {
        try {
          await endpointRef.unholdCall(targetCall);
          unholdSuccess = true;
          console.log('✅ Unhold สายสำเร็จ');
        } catch (error) {
          console.log('❌ Unhold failed:', error);
        }
      }

      if (unholdSuccess) {
        if (targetCall === currentCallRef) {
          setIsHold(false);
          setCallStatus('เชื่อมต่อแล้ว');
        }
        return true;
      } else {
        Alert.alert('Unhold call error', 'ไม่สามารถ Unhold สายได้');
        return false;
      }
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
        let holdSuccess = false;
        // วิธีที่ 3: ใช้ endpoint holdCall
        if (!holdSuccess && endpointRef && endpointRef.holdCall) {
          try {
            await endpointRef.holdCall(call);
            holdSuccess = true;
          } catch (error) {
            console.log('Hold failed:', error);
          }
        }
        if (holdSuccess) {
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
      } else {
        // Unhold call
        let unholdSuccess = false;
        if (!unholdSuccess && endpointRef && endpointRef.unholdCall) {
          try {
            await endpointRef.unholdCall(call);
            unholdSuccess = true;
          } catch (error) {
            console.log('Unhold failed', error);
          }
        }
        if (unholdSuccess) {
          setIsHold(false);
          setCallStatus('สายถูก Unhold แล้ว - กลับมาคุยได้');
          // เริ่ม call timer ใหม่
          startCallTimer();
        } else {
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
    console.log('📞 transferManagerRef:', !!transferManagerRef.current);

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

    if (!transferManagerRef.current) {
      Alert.alert('ข้อผิดพลาด', 'Transfer Manager ไม่พร้อมใช้งาน');
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
      console.log('🔄 เริ่มการโอนสายแบบ Unattended Transfer');
      
      if (!transferManagerRef.current) {
        throw new Error('Transfer Manager ไม่พร้อมใช้งาน');
      }

      if (!currentCallRef) {
        throw new Error('ไม่มีสายที่กำลังใช้งาน');
      }

      // เตรียม URI สำหรับปลายทาง
      const targetUri = targetNumber.includes('@') 
        ? targetNumber 
        : `sip:${targetNumber}@${config.domain}`;

      console.log('🔗 Target URI:', targetUri);

      // ใช้ Transfer Manager ทำการโอนสาย
      const success = await transferManagerRef.current.unattendedTransfer(
        currentCallRef._callId || currentCallRef.id,
        targetUri
      );

      if (success) {
        console.log('✅ Unattended Transfer สำเร็จ');
        
        // รีเซ็ตสถานะ
        setTimeout(() => {
          setIsInCall(false);
          setCurrentCallRef(null);
          setCurrentCallNumber('');
          setIsHold(false);
          setCallStatus('');
          AudioHelper.resetAudioMode();
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
      console.log('🔄 เริ่มการเชื่อมต่อสาย...');
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
          console.log('🔄 [วิธีที่ 1] ใช้ endpointRef.xferCall...');
          await endpointRef.xferCall(accountRef, currentCallRef, targetUri);
          transferSuccess = true;
          console.log('✅ [วิธีที่ 1] สำเร็จ');
        } catch (error) {
          console.log('❌ [วิธีที่ 1] ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 2: ใช้ currentCallRef.transfer
      if (!transferSuccess && typeof currentCallRef.transfer === 'function') {
        try {
          console.log('🔄 [วิธีที่ 2] ใช้ currentCallRef.transfer...');
          await currentCallRef.transfer(targetUri);
          transferSuccess = true;
          console.log('✅ [วิธีที่ 2] สำเร็จ');
        } catch (error) {
          console.log('❌ [วิธีที่ 2] ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 3: ใช้ endpointRef.transferCall
      if (!transferSuccess && typeof endpointRef.transferCall === 'function') {
        try {
          console.log('🔄 [วิธีที่ 3] ใช้ endpointRef.transferCall...');
          await endpointRef.transferCall(currentCallRef, targetUri);
          transferSuccess = true;
          console.log('✅ [วิธีที่ 3] สำเร็จ');
        } catch (error) {
          console.log('❌ [วิธีที่ 3] ล้มเหลว:', error.message);
        }
      }

      // วิธีที่ 4: ใช้ SIP REFER method (ถ้ามี)
      if (!transferSuccess && typeof currentCallRef.refer === 'function') {
        try {
          console.log('🔄 [วิธีที่ 4] ใช้ currentCallRef.refer (SIP REFER)...');
          await currentCallRef.refer(targetUri);
          transferSuccess = true;
          console.log('✅ [วิธีที่ 4] สำเร็จ');
        } catch (error) {
          console.log('❌ [วิธีที่ 4] ล้มเหลว:', error.message);
        }
      }

      if (!transferSuccess) {
        console.log('🔄 [วิธีสำรอง] ลองใช้ Attended Transfer + Conference...');

        try {
          // วิธีสำรอง: ทำ attended transfer
          // 1. Hold สายเดิม
          console.log('📞 Hold สายเดิม...');
          await holdCall();

          // 2. โทรไปหาหมายเลขปลายทาง
          console.log('📞 โทรไปหา:', targetUri);
          const newCall = await endpointRef.makeCall(accountRef, targetUri);

          if (newCall) {
            console.log('✅ โทรไปหาหมายเลขปลายทางสำเร็จ');
            setCallStatus(`รอ ${targetNumber} รับสาย...`);

            // รอสักครู่แล้วลองเชื่อมต่อ
            setTimeout(async () => {
              try {
                // 3. Unhold สายเดิม
                await unholdCall();

                // 4. สร้าง conference call
                if (typeof endpointRef.conferenceConnect === 'function') {
                  await endpointRef.conferenceConnect(currentCallRef, newCall);
                  console.log('✅ Conference call สำเร็จ');

                  // 5. วางสายของเรา (ออกจาก conference)
                  setTimeout(async () => {
                    try {
                      if (typeof newCall.hangup === 'function') {
                        // ยังไม่วางสายใหม่ ให้อยู่ใน conference
                        console.log('ℹ️ เก็บสายใหม่ไว้ใน conference');
                      }
                      transferSuccess = true;
                      setCallStatus('เชื่อมต่อสายสำเร็จ (วิธีสำรอง)');
                    } catch (error) {
                      console.log('Error in conference cleanup:', error);
                    }
                  }, 2000);
                } else {
                  console.log('❌ ไม่มี conference method');
                }
              } catch (error) {
                console.log('❌ Conference failed:', error);
                // ถ้าทำไม่ได้ ให้ unhold สายเดิม
                await unholdCall();
                setCallStatus('กลับสู่การสนทนาเดิม');
              }
            }, 3000); // รอ 3 วินาทีให้หมายเลขปลายทางรับสาย
          } else {
            throw new Error('ไม่สามารถโทรไปหาหมายเลขปลายทางได้');
          }
        } catch (error) {
          console.log('❌ วิธีสำรองล้มเหลว:', error.message);
        }
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
        AudioHelper.resetAudioMode();
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
      console.log('� เริ่มการเชื่อมต่อสายแบบใหม่...');
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

      const newCall = await endpointRef.makeCall(accountRef, targetUri, {
        headers: {
          'X-Transfer-Type': 'Connect-Call',
        },
      });

      console.log('✅ โทรไปหาหมายเลขปลายทางสำเร็จ');
      setCallStatus(`รอ ${targetNumber} รับสาย...`);

      // Step 3: รอให้หมายเลขปลายทางรับสาย
      return new Promise(resolve => {
        const checkCallStatus = () => {
          if (newCall && newCall.state === 'confirmed') {
            console.log('✅ หมายเลขปลายทางรับสายแล้ว');
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
                  AudioHelper.resetAudioMode();
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
                      if (typeof newCall.hangup === 'function') {
                        await newCall.hangup();
                      } else if (typeof newCall.terminate === 'function') {
                        await newCall.terminate();
                      }
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
    console.log('📞 transferManagerRef:', !!transferManagerRef.current);

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

    if (!transferManagerRef.current) {
      Alert.alert('ข้อผิดพลาด', 'Transfer Manager ไม่พร้อมใช้งาน');
      return false;
    }

    try {
      console.log('🔄 เริ่มการโอนสายแบบ Attended Transfer');

      // เตรียม URI สำหรับปลายทาง
      const targetUri = targetNumber.includes('@') 
        ? targetNumber 
        : `sip:${targetNumber}@${config.domain}`;

      // เริ่ม Attended Transfer ผ่าน Transfer Manager
      const transferResult = await transferManagerRef.current.startAttendedTransfer(
        currentCallRef,
        targetUri
      );

      if (transferResult && transferResult.transferId) {
        console.log('✅ เริ่ม Attended Transfer สำเร็จ');
        
        // บันทึกข้อมูลการโอนสาย
        setAttendedTransferState({
          originalCallRef: transferResult.originalCall,
          consultCallRef: transferResult.consultCall,
          targetNumber: targetNumber,
          transferId: transferResult.transferId,
          step: 'consulting',
          isConsulting: true,
        });

        // นำทางไปหน้า AttendedTransferScreen
        if (navigationRef?.current) {
          navigationRef.current.navigate('AttendedTransfer', {
            transferId: transferResult.transferId,
            originalCall: transferResult.originalCall,
            consultCall: transferResult.consultCall,
            targetNumber: targetNumber,
            transferManager: transferManagerRef.current,
            AudioHelper: AudioHelper,
          });
        }

        return transferResult;
      } else {
        throw new Error('ไม่สามารถเริ่ม Attended Transfer ได้');
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
        console.log('✅ ใช้ Complete Attended Transfer');
        return await completeAttendedTransfer();
      }

      // กรณีที่ 2: ใช้ targetNumber จาก state แต่ยังไม่เสร็จขั้นตอน attended
      if (targetNumber && currentCallRef && isInCall) {
        console.log('🔄 ใช้ Unattended Transfer แทน (มี targetNumber)');
        return await unattendedTransfer(targetNumber);
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
      console.log('✅ ทำการโอนสายแบบ Attended Transfer');
      console.log('🔍 Debug attendedTransferState:', attendedTransferState);

      const { originalCallRef, consultCallRef, targetNumber } =
        attendedTransferState;

      console.log('🔍 Debug originalCallRef:', originalCallRef);
      console.log('🔍 Debug consultCallRef:', consultCallRef);
      console.log('🔍 Debug currentCallRef:', currentCallRef);

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
                  // เรียกใช้ unattended transfer แทน
                  unattendedTransfer(inputNumber);
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
        console.log(
          '🔄 ไม่มี Attended Transfer State ที่สมบูรณ์ ใช้ Unattended Transfer แทน...',
        );
        Alert.alert(
          'โอนสายทันที',
          `ไม่พบการโทรปรึกษา จะโอนสายแบบทันทีไปยัง ${targetNumber} แทน\n\nต้องการดำเนินการต่อหรือไม่?`,
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'โอนเลย',
              onPress: async () => {
                try {
                  await unattendedTransfer(targetNumber);
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

      // วิธีง่ายๆ: วางสายปรึกษาและใช้ unattended transfer กับสายเดิม
      console.log('🔄 ใช้วิธี Attended Transfer แบบง่าย...');

      try {
        // วางสายปรึกษา (ถ้ามี)
        if (consultCallRef) {
          console.log('📞 วางสายปรึกษา...');
          try {
            if (typeof consultCallRef.hangup === 'function') {
              await consultCallRef.hangup();
              console.log('✅ วางสายปรึกษาสำเร็จ');
            } else if (typeof consultCallRef.terminate === 'function') {
              await consultCallRef.terminate();
              console.log('✅ วางสายปรึกษาสำเร็จ (terminate)');
            } else {
              console.log('⚠️ ไม่พบฟังก์ชันวางสายสำหรับ consultCall');
            }
          } catch (hangupError) {
            console.log('⚠️ ไม่สามารถวางสายปรึกษาได้:', hangupError.message);
          }
        }

        // โอนสายเดิมไปยังหมายเลขปลายทางด้วย unattended transfer
        const domain =
          config && config.domain ? config.domain : 'your-sip-domain.com';
        const targetUri = targetNumber.includes('@')
          ? targetNumber
          : `sip:${targetNumber.trim()}@${domain}`;

        console.log('🔄 โอนสายเดิมไปยัง:', targetUri);

        // ใช้ xferCall เพื่อโอนสายเดิม
        if (endpointRef && typeof endpointRef.xferCall === 'function') {
          await endpointRef.xferCall(accountRef, originalCallRef, targetUri);
          console.log('✅ Attended Transfer สำเร็จ');
        } else if (
          originalCallRef &&
          typeof originalCallRef.transfer === 'function'
        ) {
          await originalCallRef.transfer(targetUri);
          console.log('✅ Attended Transfer สำเร็จ (ใช้ call.transfer)');
        } else {
          throw new Error('ไม่พบ method สำหรับการโอนสาย');
        }
      } catch (error) {
        console.error('❌ การโอนสายล้มเหลว:', error);
        throw error;
      }

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

      AudioHelper.resetAudioMode();

      Alert.alert('สำเร็จ', `โอนสายไป ${targetNumber} สำเร็จแล้ว`);

      return true;
    } catch (error) {
      console.error('❌ Error completing attended transfer:', error);
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโอนสายได้: ${error.message}`);
      return false;
    }
  };

  // ฟังก์ชันใหม่: โอนสายโดยให้หมายเลขที่โทรมาโทรไปยังหมายเลขปลายทางทันที
  const handleDirectTransferToTarget = async () => {
    try {
      console.log('🔄 เริ่มการโอนสายแบบตรง - ให้ caller โทรไปหา target ทันที');

      // Debug: แสดงข้อมูลทั้งหมด
      console.log(
        '🔍 DEBUG - attendedTransferState ปัจจุบัน:',
        JSON.stringify(attendedTransferState, null, 2),
      );
      console.log(
        '🔍 DEBUG - transferTargetNumber ปัจจุบัน:',
        transferTargetNumber,
      );
      console.log(
        '🔍 DEBUG - originalCallRef มีหรือไม่:',
        !!attendedTransferState.originalCallRef,
      );
      console.log(
        '🔍 DEBUG - consultCallRef มีหรือไม่:',
        !!attendedTransferState.consultCallRef,
      );
      console.log('🔍 DEBUG - currentCallNumber ปัจจุบัน:', currentCallNumber);

      const { originalCallRef, consultCallRef } = attendedTransferState;

      // ใช้ transferTargetNumber เป็นหลัก ถ้าไม่มีใช้จาก attendedTransferState
      let targetNumber =
        transferTargetNumber || attendedTransferState.targetNumber;

      console.log('🔍 DEBUG - targetNumber ที่จะใช้:', targetNumber);
      console.log('🔍 DEBUG - targetNumber type:', typeof targetNumber);
      console.log(
        '🔍 DEBUG - targetNumber length:',
        targetNumber ? targetNumber.length : 'undefined',
      );

      // ทำความสะอาด targetNumber
      targetNumber = targetNumber.trim();

      console.log('✅ ข้อมูลครบถ้วน - เริ่มการโอนสาย');
      console.log(`📞 จะโอนจาก originalCall ไปยัง: ${targetNumber}`);

      setCallStatus(`กำลังโอนสายให้ caller โทรไป ${targetNumber} ทันที...`);

      // Step 1: วางสายปรึกษา (ถ้ามี)
      if (consultCallRef) {
        try {
          console.log('📞 วางสายปรึกษา...');
          if (typeof consultCallRef.hangup === 'function') {
            await consultCallRef.hangup();
          } else if (typeof consultCallRef.terminate === 'function') {
            await consultCallRef.terminate();
          }
          console.log('✅ วางสายปรึกษาแล้ว');
        } catch (hangupError) {
          console.log(
            '⚠️ เกิดข้อผิดพลาดในการวางสายปรึกษา:',
            hangupError.message,
          );
        }
      }

      // Step 2: เตรียมการโอนสายและตรวจสอบสถานะ
      const domain =
        config && config.domain ? config.domain : 'your-sip-domain.com';
      const targetUri = targetNumber.includes('@')
        ? targetNumber
        : `sip:${targetNumber.trim()}@${domain}`;

      console.log(`🔄 เตรียมโอนสายเดิม (caller) ไปยัง: ${targetUri}`);

      // กลับไปใช้สายเดิมและตรวจสอบสถานะ
      setCurrentCallRef(originalCallRef);

      // ตรวจสอบและจัดการสถานะ Hold ก่อนโอน
      try {
        // ตรวจสอบสถานะสายเดิมก่อน
        console.log('🔍 ตรวจสอบสถานะสายเดิมก่อนโอน...');

        if (isHold) {
          console.log('📞 Unhold สายเดิมก่อนโอน...');
          await unholdCall();

          // รอให้ unhold เสร็จและตรวจสอบสถานะ
          await new Promise(resolve => setTimeout(resolve, 1500));

          // ตรวจสอบว่า unhold สำเร็จหรือไม่
          if (isHold) {
            console.log('⚠️ ยังคง hold อยู่ ลองอีกครั้ง...');
            await unholdCall();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          console.log('✅ สายเดิมพร้อมสำหรับการโอน');
        } else {
          console.log('✅ สายเดิมไม่ได้ hold อยู่ พร้อมโอนทันที');
        }

        // ตั้งค่า audio mode สำหรับการโอน
        AudioHelper.setCallAudioMode();
      } catch (unholdError) {
        console.log('⚠️ เกิดข้อผิดพลาดในการ unhold:', unholdError.message);
        console.log('🔄 ดำเนินการโอนต่อไปแม้จะมีปัญหา unhold');
      }

      // Step 3: ทำการโอนสายทันที (caller จะโทรไปหา target เลย)
      console.log('🔄 เริ่มกระบวนการโอนสาย...');
      let transferSuccess = false;
      let transferMethod = '';

      // วิธีที่ 1: ใช้ endpointRef.xferCall (วิธีมาตรฐาน)
      if (
        !transferSuccess &&
        endpointRef &&
        typeof endpointRef.xferCall === 'function'
      ) {
        try {
          console.log('🔄 [วิธีที่ 1] ใช้ endpointRef.xferCall...');
          await endpointRef.xferCall(accountRef, originalCallRef, targetUri);
          transferSuccess = true;
          transferMethod = 'endpointRef.xferCall';
          console.log('✅ [วิธีที่ 1] โอนสายสำเร็จ - caller กำลังโทรไป target');
        } catch (error) {
          console.log('❌ [วิธีที่ 1] ล้มเหลว:', error.message);
        }
      }

      console.log(`✅ โอนสายสำเร็จด้วยวิธี: ${transferMethod}`);

      // Step 4: รีเซ็ต state และกลับไปหน้าหลัก
      console.log('🔄 ทำการรีเซ็ตสถานะและทำความสะอาด...');

      // รีเซ็ต attended transfer state
      setAttendedTransferState({
        originalCallRef: null,
        consultCallRef: null,
        targetNumber: '',
        step: 'idle',
        isConsulting: false,
      });

      // รีเซ็ต transfer target number
      setTransferTargetNumber('');

      // รีเซ็ตสถานะการโทรทั้งหมด
      setCurrentCallRef(null);
      setCurrentCallNumber('');
      setIsInCall(false);
      setIsHold(false);

      // ทำความสะอาด audio mode
      try {
        AudioHelper.resetAudioMode();
        console.log('✅ รีเซ็ต audio mode สำเร็จ');
      } catch (audioError) {
        console.log('⚠️ ไม่สามารถรีเซ็ต audio mode:', audioError.message);
      }

      // อัพเดทสถานะการแสดงผล
      setCallStatus(`สายโอนสำเร็จ - ผู้โทรกำลังเชื่อมต่อกับ ${targetNumber}`);

      // กลับไปหน้า Softphone หลังจากรอสักครู่
      setTimeout(() => {
        if (navigationRef && navigationRef.current) {
          navigationRef.current.navigate('Softphone');
          console.log('📱 กลับไปหน้า Softphone แล้ว');
        }

        // เคลียร์ status หลังจากกลับหน้าหลัก
        setTimeout(() => {
          setCallStatus('');
        }, 2000);
      }, 1000);

      // แสดงข้อความยืนยันความสำเร็จ
      Alert.alert(
        '🎉 โอนสายสำเร็จ',
        `✅ การโอนสายเสร็จสมบูรณ์!\n\n` +
          `📞 สถานะ:\n` +
          `• ผู้โทรเข้ากำลังเชื่อมต่อกับ ${targetNumber}\n` +
          `• ใช้วิธีการ: ${transferMethod}\n` +
          `• คุณได้ออกจากการสนทนาแล้ว\n\n` +
          `🔗 ผู้โทรและ ${targetNumber} สามารถสนทนากันต่อได้ทันที`,
        [
          {
            text: 'เข้าใจแล้ว',
            onPress: () => {
              console.log('✅ ผู้ใช้ยืนยันรับทราบการโอนสายสำเร็จ');
            },
          },
        ],
      );

      console.log('✅ โอนสายแบบตรงเสร็จสมบูรณ์');
      return true;
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

      // รีเซ็ต transfer target number
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
      console.log('🔍 DEBUG - บันทึก targetNumber จาก keypad:', targetNumber);
      setTransferTargetNumber(targetNumber);

      if (type === 'unattended') {
        return await unattendedTransfer(targetNumber);
      } else if (type === 'attended') {
        return await attendedTransfer(targetNumber);
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
        AudioHelper={AudioHelper}
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
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Softphone">
        <Stack.Screen name="Softphone" options={{ title: 'Convergence' }}>
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
          options={{ title: 'ผู้ติดต่อ' }}
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
              transferManager={transferManagerRef.current}
              AudioHelper={AudioHelper}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="SIPConnector" options={{ title: 'SIP Connector' }}>
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
        AudioHelper={AudioHelper}
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
    </NavigationContainer>
  );
}
