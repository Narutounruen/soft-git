import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIPSettingsScreen = ({ navigation, config, setConfig }) => {
  const [localConfig, setLocalConfig] = useState({
    name: config?.name || '',
    username: config?.username || '',
    password: config?.password || '',
    domain: config?.domain || '',
    proxy: config?.proxy || '',
    transport: config?.transport || 'UDP',
    port: config?.port || '5060',
    regTimeout: config?.regTimeout || '300',
    enableSRTP: config?.enableSRTP || false,
    enableSTUN: config?.enableSTUN || false,
    stunServer: config?.stunServer || '',
  });

  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    // เช็คว่ามีการเปลี่ยนแปลงหรือไม่
    const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config);
    setIsModified(hasChanges);
  }, [localConfig, config]);

  const handleInputChange = (field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('sipConfig', JSON.stringify(localConfig));
      setConfig(localConfig);
      setIsModified(false);
      Alert.alert('สำเร็จ', 'บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถบันทึกการตั้งค่าได้');
    }
  };

  const resetSettings = () => {
    Alert.alert(
      'รีเซ็ตการตั้งค่า',
      'คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดหรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'รีเซ็ต',
          style: 'destructive',
          onPress: () => {
            const defaultConfig = {
              name: '',
              username: '',
              password: '',
              domain: '',
              proxy: '',
              transport: 'UDP',
              port: '5060',
              regTimeout: '300',
              enableSRTP: false,
              enableSTUN: false,
              stunServer: '',
            };
            setLocalConfig(defaultConfig);
          },
        },
      ]
    );
  };

  const InputField = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholderTextColor="#999"
      />
    </View>
  );

  const SwitchField = ({ label, value, onValueChange, description }) => (
    <View style={styles.switchContainer}>
      <View style={styles.switchTextContainer}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description && <Text style={styles.switchDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
        thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>การตั้งค่า SIP</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลบัญชี</Text>
          
          <InputField
            label="ชื่อแสดง"
            value={localConfig.name}
            onChangeText={(value) => handleInputChange('name', value)}
            placeholder="ชื่อที่จะแสดงเมื่อโทรออก"
          />

          <InputField
            label="ชื่อผู้ใช้"
            value={localConfig.username}
            onChangeText={(value) => handleInputChange('username', value)}
            placeholder="SIP Username"
          />

          <InputField
            label="รหัสผ่าน"
            value={localConfig.password}
            onChangeText={(value) => handleInputChange('password', value)}
            placeholder="SIP Password"
            secureTextEntry={true}
          />

          <InputField
            label="โดเมน"
            value={localConfig.domain}
            onChangeText={(value) => handleInputChange('domain', value)}
            placeholder="sip.example.com"
          />
        </View>

        {/* Server Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การตั้งค่าเซิร์ฟเวอร์</Text>
          
          <InputField
            label="Proxy Server"
            value={localConfig.proxy}
            onChangeText={(value) => handleInputChange('proxy', value)}
            placeholder="proxy.example.com (ไม่บังคับ)"
          />

          <InputField
            label="Port"
            value={localConfig.port}
            onChangeText={(value) => handleInputChange('port', value)}
            placeholder="5060"
            keyboardType="numeric"
          />

          <InputField
            label="Registration Timeout (วินาที)"
            value={localConfig.regTimeout}
            onChangeText={(value) => handleInputChange('regTimeout', value)}
            placeholder="300"
            keyboardType="numeric"
          />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Transport Protocol</Text>
            <View style={styles.transportContainer}>
              {['UDP', 'TCP', 'TLS'].map((transport) => (
                <TouchableOpacity
                  key={transport}
                  style={[
                    styles.transportButton,
                    localConfig.transport === transport && styles.transportButtonActive,
                  ]}
                  onPress={() => handleInputChange('transport', transport)}
                >
                  <Text
                    style={[
                      styles.transportButtonText,
                      localConfig.transport === transport && styles.transportButtonTextActive,
                    ]}
                  >
                    {transport}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>การตั้งค่าความปลอดภัย</Text>
          
          <SwitchField
            label="เปิดใช้งาน SRTP"
            value={localConfig.enableSRTP}
            onValueChange={(value) => handleInputChange('enableSRTP', value)}
            description="เข้ารหัสการสื่อสารด้วย SRTP"
          />

          <SwitchField
            label="เปิดใช้งาน STUN"
            value={localConfig.enableSTUN}
            onValueChange={(value) => handleInputChange('enableSTUN', value)}
            description="สำหรับการใช้งานผ่าน NAT/Firewall"
          />

          {localConfig.enableSTUN && (
            <InputField
              label="STUN Server"
              value={localConfig.stunServer}
              onChangeText={(value) => handleInputChange('stunServer', value)}
              placeholder="stun:stun.l.google.com:19302"
            />
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetSettings}
          >
            <Icon name="refresh" size={20} color="#FF3B30" />
            <Text style={styles.resetButtonText}>รีเซ็ตการตั้งค่า</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.saveButton,
              !isModified && styles.saveButtonDisabled,
            ]}
            onPress={saveSettings}
            disabled={!isModified}
          >
            <Icon name="save" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>บันทึกการตั้งค่า</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1D1D1F',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1D1D1F',
    backgroundColor: '#FFFFFF',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1D1D1F',
  },
  switchDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  transportContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  transportButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E1E1E1',
  },
  transportButtonActive: {
    backgroundColor: '#007AFF',
  },
  transportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  transportButtonTextActive: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    paddingVertical: 24,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SIPSettingsScreen;