import React, { useState, useRef } from 'react';
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
  Modal,
} from 'react-native';
import Sound from 'react-native-sound';
import { Endpoint } from 'react-native-pjsip';
import { saveCallHistory } from '../services/callHistoryService';
import { CallManager } from '../utils/CallManager';
import { AudioManager } from '../utils/AudioManager';

export default function SIPSettingsScreen({
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
  const [isConnecting, setIsConnecting] = useState(false);
  const endpointRef = useRef(null);
  const accountRef = useRef(null);
  const currentCallRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const handleIncomingCall = (remoteNumber, call) => {
    setIncomingCallNumber(remoteNumber);
    setIncomingCallRef(call);
    setShowIncomingCall(true);
  };

  const cleanup = async () => {
    try {
      setIsConnecting(false);
      setIsConnected(false);
      setIsInCall(false);
      setCallStatus('');

      AudioManager.resetAudioMode();

      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      if (currentCallRef.current) {
        try {
          await CallManager.hangupCall(currentCallRef.current, endpointRef.current);
          currentCallRef.current = null;
        } catch (callError) {
          currentCallRef.current = null;
        }
      }

      if (endpointRef.current) {
        if (accountRef.current) {
          try {
            await endpointRef.current.deleteAccount(accountRef.current);
            accountRef.current = null;
          } catch (accountError) {
            accountRef.current = null;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          if (endpointRef.current.removeAllListeners) {
            endpointRef.current.removeAllListeners();
          }
        } catch {}

        try {
          if (typeof endpointRef.current.stop === 'function') {
            await endpointRef.current.stop();
          }
        } catch {}

        endpointRef.current = null;
      } else {
        endpointRef.current = null;
        accountRef.current = null;
        currentCallRef.current = null;
      }
    } catch (error) {
      endpointRef.current = null;
      accountRef.current = null;
      currentCallRef.current = null;
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        if (!PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) {
          return;
        }

        const audioPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'ขออนุญาตใช้ไมค์',
            message: 'แอพต้องการใช้ไมค์เพื่อการโทร',
            buttonPositive: 'ตกลง',
            buttonNegative: 'ยกเลิก',
          },
        );
        if (audioPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('ต้องการสิทธิ์ใช้ไมค์');
        }

        if (PermissionsAndroid.PERMISSIONS.CALL_PHONE) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            {
              title: 'ขออนุญาตโทร',
              message: 'แอพต้องการสิทธิ์ในการโทร',
              buttonPositive: 'ตกลง',
              buttonNegative: 'ยกเลิก',
            },
          );
        }

        if (PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.MODIFY_AUDIO_SETTINGS,
            {
              title: 'ขออนุญาตปรับแต่งเสียง',
              message: 'แอพต้องการปรับแต่งการตั้งค่าเสียง',
              buttonPositive: 'ตกลง',
              buttonNegative: 'ยกเลิก',
            },
          );
        }
      } catch (error) {
        throw new Error(`ไม่สามารถขอสิทธิ์ได้: ${error.message}`);
      }
    }
  };

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
      await requestPermissions();

      endpointRef.current = new Endpoint();

      await endpointRef.current.start({
        userAgent: 'Simple SIP Client',
        logLevel: 5,
        logConfig: { console: true },
      });

      connectionTimeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          setIsConnecting(false);
          setIsConnected(false);
          setStatus('❌ หมดเวลาการเชื่อมต่อ');
          Alert.alert('หมดเวลาการเชื่อมต่อ', 'กรุณาตรวจสอบการตั้งค่าและลองอีกครั้ง');
          cleanup();
        }
      }, 30000);

      endpointRef.current.on('registration_changed', registration => {
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
          // กลับไปหน้า Softphone
          navigation.navigate('Softphone');
        } else {
          setIsConnected(false);
          const reason = regData?._reason || regData?._statusText || 'เชื่อมต่อไม่สำเร็จ';
          setStatus(`❌ ${reason}`);
        }
      });

      Sound.setCategory('Playback');
      AudioManager.setCallAudioMode();

      const soundPath = Platform.select({ android: 'incoming_call.mp3', ios: 'incoming_call.mp3' });
      const soundLocation = Platform.select({ android: Sound.MAIN_BUNDLE, ios: '' });
      ringtoneRef.current = new Sound(soundPath, soundLocation, () => {});

      endpointRef.current.on('call_received', call => {
        if (call) {
          const remoteNumber = call.getRemoteUri().split('@')[0].replace('sip:', '');
          setCurrentCallRef(call);
          setCurrentCallNumber(remoteNumber);
          setCallStatus('📞 สายเรียกเข้า');

          try {
            saveCallHistory(
              { number: remoteNumber, type: 'incoming', status: 'ringing', timestamp: new Date().toISOString() },
              'default_user',
            );
          } catch {}

          if (ringtoneRef.current && ringtoneRef.current.isLoaded()) {
            ringtoneRef.current.setVolume(1.0);
            ringtoneRef.current.setNumberOfLoops(-1);
            ringtoneRef.current.play(() => {});
          }

          Vibration.vibrate([500, 1000], true);
          handleIncomingCall(remoteNumber, call);
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
        mediaConfig: { videoCodecs: [] },
      };
      accountRef.current = await endpointRef.current.createAccount(accountConfig);
    } catch (error) {
      setIsConnecting(false);
      setIsConnected(false);
      setStatus(`❌ ผิดพลาด: ${error.message}`);
      Alert.alert('ผิดพลาด', error.message);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  };

  const cancelConnection = async () => {
    setStatus('กำลังยกเลิก...');
    await cleanup();
    setStatus('ยกเลิกการเชื่อมต่อแล้ว');
  };

  const disconnect = async () => {
    await cleanup();
    setStatus('ยังไม่เชื่อมต่อ');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Server Settings</Text>
            <Text style={styles.cardSubtitle}>Configure your SIP server connection</Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>IP Address</Text>
              <TextInput
                style={[styles.input, !isConnecting && !isConnected ? {} : styles.inputDisabled]}
                placeholder="192.168.1.100"
                value={config.domain}
                onChangeText={text => setConfig({ ...config, domain: text })}
                editable={!isConnecting && !isConnected}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Port</Text>
              <TextInput
                style={[styles.input, !isConnecting && !isConnected ? {} : styles.inputDisabled]}
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
                style={[styles.input, !isConnecting && !isConnected ? {} : styles.inputDisabled]}
                placeholder="SIP username"
                value={config.username}
                onChangeText={text => setConfig({ ...config, username: text })}
                editable={!isConnecting && !isConnected}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={[styles.input, !isConnecting && !isConnected ? {} : styles.inputDisabled]}
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
              <TouchableOpacity style={styles.connectButton} onPress={connectSIP} activeOpacity={0.7}>
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            )}

            {isConnecting && (
              <View style={styles.connectingContainer}>
                <TouchableOpacity style={styles.connectingButton} disabled={true}>
                  <Text style={styles.connectingButtonText}>Connecting...</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelConnection} activeOpacity={0.7}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isConnecting && isConnected && (
              <TouchableOpacity style={styles.disconnectButton} onPress={disconnect} activeOpacity={0.7}>
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
                  isConnected ? styles.statusOnline : isConnecting ? styles.statusConnecting : styles.statusOffline,
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
              </Text>
            </View>
          </View>
          {status !== 'ยังไม่เชื่อมต่อ' && <Text style={styles.statusMessage}>{status}</Text>}
        </View>
      </View>

      {/* ใช้ Modal เดียวกับโค้ดหลักผ่าน props state */}
      {/** Placeholder Modal เพื่อหลีกเลี่ยง UI กระพริบถ้ามีการแสดงจากโค้ดหลัก */}
      {false && (
        <Modal transparent={true} visible={false} animationType="fade" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: { alignItems: 'center', marginBottom: 32 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#666666', textAlign: 'center' },
  inputGroup: { marginBottom: 32 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#333333', marginBottom: 8 },
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
  inputDisabled: { backgroundColor: '#f8f8f8', color: '#999999' },
  buttonContainer: { alignItems: 'center' },
  connectButton: {
    backgroundColor: '#007aff',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
  },
  connectButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  connectingContainer: { alignItems: 'center' },
  connectingButton: {
    backgroundColor: '#ff9500',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginBottom: 8,
    minWidth: 100,
  },
  connectingButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  cancelButton: { backgroundColor: '#8e8e93', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 4 },
  cancelButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '500' },
  disconnectButton: { backgroundColor: '#ff3b30', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4, minWidth: 100 },
  disconnectButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  statusCard: { backgroundColor: '#ffffff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusOnline: { backgroundColor: '#34c759' },
  statusConnecting: { backgroundColor: '#ff9500' },
  statusOffline: { backgroundColor: '#ff3b30' },
  statusText: { fontSize: 14, fontWeight: '500', color: '#333333' },
  statusMessage: { fontSize: 14, color: '#666666', marginTop: 8, lineHeight: 20 },
});



