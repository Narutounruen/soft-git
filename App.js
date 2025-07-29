import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Endpoint } from 'react-native-pjsip';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SoftphoneScreen from './SoftphoneScreen';
import CallingScreen from './CallingScreen';


function HomeScreen({ navigation, status, setStatus, isConnected, setIsConnected, setAccountRef, setEndpointRef, setCurrentCallRef, setIsInCall, setCallStatus, config, setConfig }) {
  // --- ย้าย state และ ref ทั้งหมดมาไว้ที่นี่ ---
  const [isConnecting, setIsConnecting] = useState(false);
  const endpointRef = useRef(null);
  const accountRef = useRef(null);
  const currentCallRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  // ทำความสะอาด
// ทำความสะอาด
const cleanup = async () => {
  try {
    setIsConnecting(false);
    setIsConnected(false);
    setIsInCall(false);
    setCallStatus('');
    
    // ยกเลิก timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    // ยุติสายที่กำลังใช้งาน
    if (currentCallRef.current) {
      try {
        await currentCallRef.current.hangup();
        currentCallRef.current = null;
      } catch (callError) {
        console.error('Hangup call error:', callError);
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
          console.log('endpointRef.current.stop is not a function, skip stopping endpoint');
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

// ฟังก์ชันตัดการเชื่อมต่อแบบบังคับ
const forceDisconnect = async () => {
  setStatus('กำลังตัดการเชื่อมต่อ...');
  
  try {
    // ลองปิดแบบปกติก่อน
    await cleanup();
    
    // ตั้ง timeout เพื่อบังคับรีเซ็ต state ถ้าปิดไม่สำเร็จ
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(false);
      setIsInCall(false);
      setCallStatus('');
      setStatus('ตัดการเชื่อมต่อแล้ว');
      
      // บังคับรีเซ็ต refs
      endpointRef.current = null;
      accountRef.current = null;
      currentCallRef.current = null;
    }, 2000);
    
    setStatus('ตัดการเชื่อมต่อแล้ว');
  } catch (error) {
    console.error('Force disconnect error:', error);
    
    // บังคับรีเซ็ต state แม้จะ error
    setIsConnecting(false);
    setIsConnected(false);
    setIsInCall(false);
    setCallStatus('');
    setStatus('ตัดการเชื่อมต่อแล้ว');
    
    // บังคับรีเซ็ต refs
    endpointRef.current = null;
    accountRef.current = null;
    currentCallRef.current = null;
  }
};
  // ขอสิทธิ์
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const audioPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (audioPermission !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('ต้องการสิทธิ์ใช้ไมค์');
      }
    }
  };

  // เชื่อมต่อ SIP
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
      await endpointRef.current.start({
        userAgent: 'Simple SIP Client',
      });

      // ตั้ง timeout สำหรับการเชื่อมต่อ (30 วินาที)
      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          handleConnectionTimeout();
        }
      }, 30000);

      // จัดการ events
      endpointRef.current.on('registration_changed', (registration) => {
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
          const reason = regData?._reason || regData?._statusText || 'เชื่อมต่อไม่สำเร็จ';
          setStatus(`❌ ${reason}`);
        }
      });

      // จัดการ call events
      endpointRef.current.on('call_received', (call) => {
        // Handle incoming calls if needed
        console.log('Incoming call:', call);
      });

      endpointRef.current.on('call_changed', (call) => {
        const callInfo = call?._callInfo || call;
        const state = callInfo?.state || call?.state;
        
        if (state === 'PJSIP_INV_STATE_CALLING') {
          setCallStatus('📞 กำลังโทร...');
        } else if (state === 'PJSIP_INV_STATE_EARLY') {
          setCallStatus('📞 กำลังเรียก...');
        } else if (state === 'PJSIP_INV_STATE_CONFIRMED') {
          setCallStatus('📞 สายเชื่อมต่อแล้ว');
          setIsInCall(true);
        } else if (state === 'PJSIP_INV_STATE_DISCONNECTED') {
          setCallStatus('📞 วางสายแล้ว');
          setIsInCall(false);
          setCurrentCallRef(null);
          setCurrentCallNumber('');
          setTimeout(() => setCallStatus(''), 2000);
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
        stunServer: 'stun:stun.l.google.com:19302', // เพิ่มตรงนี้
      };

      accountRef.current = await endpointRef.current.createAccount(accountConfig);

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
      [{ text: 'ตกลง' }]
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
      <Text style={styles.title}>SIP Connector</Text>
      
      <TextInput
        style={styles.input}
        placeholder="IP Address"
        value={config.domain}
        onChangeText={(text) => setConfig({...config, domain: text})}
        editable={!isConnecting && !isConnected}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Port (5060)"
        value={config.port}
        onChangeText={(text) => setConfig({...config, port: text})}
        keyboardType="numeric"
        editable={!isConnecting && !isConnected}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={config.username}
        onChangeText={(text) => setConfig({...config, username: text})}
        editable={!isConnecting && !isConnected}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={config.password}
        onChangeText={(text) => setConfig({...config, password: text})}
        secureTextEntry
        editable={!isConnecting && !isConnected}
      />

      <View style={styles.buttonContainer}>
        {/* แสดงปุ่มตามสถานะ */}
        {!isConnecting && !isConnected && (
          <Button 
            title="เชื่อมต่อ" 
            onPress={connectSIP} 
          />
        )}
        
        {isConnecting && (
          <>
            <Button 
              title="กำลังเชื่อมต่อ..." 
              disabled={true}
            />
            <View style={styles.spacing} />
            <Button 
              title="ยกเลิก" 
              onPress={cancelConnection} 
              color="#FF6B6B"
            />
          </>
        )}
        
        {!isConnecting && isConnected && (
          <Button 
            title="ตัดการเชื่อมต่อ" 
            onPress={disconnect} 
            color="#FF6B6B"
          />
        )}
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>สถานะ:</Text>
        <Text style={[
          styles.status,
          status.includes('สำเร็จ') ? styles.success : 
          status.includes('❌') ? styles.error : styles.default
        ]}>
          {status}
        </Text>
      </View>

    </View>
  );
}

const Stack = createStackNavigator();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginVertical: 20,
  },
  spacing: {
    height: 10,
  },
  statusContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
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
  const [config, setConfig] = useState({
    username: "1003",
    domain: "192.168.0.5",
    password: "con1003",
    port: "5060",
  });

  // ฟังก์ชันโทรออก
  const makeCall = async (callNumber) => {
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
      const callUri = `sip:${callNumber}@${config.domain}`;
      const call = await endpointRef.makeCall(accountRef, callUri);
      setCurrentCallRef(call);
    } catch (error) {
      setCallStatus('❌ โทรไม่สำเร็จ');
      Alert.alert('ข้อผิดพลาด', `ไม่สามารถโทรได้: ${error.message}`);
      setTimeout(() => setCallStatus(''), 3000);
    }
  };

  // ฟังก์ชันวางสาย
  const hangupCall = async () => {
    if (currentCallRef && typeof currentCallRef.hangup === 'function') {
      try {
        await currentCallRef.hangup();
        setCallStatus('📞 วางสายแล้ว');
        setIsInCall(false);
        setCurrentCallRef(null);
        setCurrentCallNumber('');
        setTimeout(() => setCallStatus(''), 2000);
      } catch (error) {
        console.error('Hangup error:', error);
      }
    } else {
      // เพิ่ม log หรือแจ้งเตือนกรณีไม่มีสายให้วาง
      setCallStatus('❌ ไม่มีสายที่ต้องวาง');
      setTimeout(() => setCallStatus(''), 2000);
    }
  };

  // ฟังก์ชันไปยังหน้า CallingScreen
  const navigateToCalling = () => {
    if (isInCall) {
      // ใช้ setTimeout เพื่อให้ navigation ทำงานหลังจาก state อัปเดตแล้ว
      setTimeout(() => {
        // หา navigation instance จาก ref หรือ context
        // สำหรับตอนนี้จะใช้วิธีอื่น
      }, 100);
    }
  };

  // ส่ง props ไปทั้งสองหน้า
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Softphone">
        <Stack.Screen
          name="Softphone"
          options={{ title: 'Softphone' }}
        >
          {props => (
            <SoftphoneScreen
              {...props}
              status={status}
              isConnected={isConnected}
              isInCall={isInCall}
              callStatus={callStatus}
              accountRef={accountRef}
              endpointRef={endpointRef}
              config={config}
              makeCall={makeCall}
              hangupCall={hangupCall}
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
            gestureEnabled: false
          }}
        >
          {props => (
            <CallingScreen
              {...props}
              hangupCall={hangupCall}
              callStatus={callStatus}
              isInCall={isInCall}
              currentCallNumber={currentCallNumber}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="SIPConnector"
          options={{ title: 'SIP Connector' }}
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
              config={config}
              setConfig={setConfig}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}