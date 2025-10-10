import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const AddContactScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateName = text => {
    setName(text);
    if (text.trim().length < 2) {
      setNameError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
    } else {
      setNameError('');
    }
  };

  const validatePhone = text => {
    // Remove all non-digit characters
    const cleanedPhone = text.replace(/\D/g, '');
    setPhone(cleanedPhone);
    // Remove validation - allow any phone number
    setPhoneError('');
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    if (nameError) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาแก้ไขข้อมูลให้ถูกต้อง');
      return;
    }

    setIsLoading(true);
    try {
      await firestore().collection('contacts').add({
        name: name.trim(),
        phone: phone.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Alert.alert('สำเร็จ', 'เพิ่มผู้ติดต่อเรียบร้อยแล้ว', [
        {
          text: 'ตกลง',
          onPress: () => navigation.goBack(),
        },
      ]);
      setName('');
      setPhone('');
    } catch (error) {
      console.error('Error adding contact: ', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเพิ่มผู้ติดต่อได้');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormInvalid = Boolean(
    !name.trim() || !phone.trim() || nameError || isLoading,
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="person-add" size={60} color="#4A90E2" />
            </View>
            <Text style={styles.title}>เพิ่มผู้ติดต่อใหม่</Text>
            <Text style={styles.subtitle}>
              กรอกข้อมูลผู้ติดต่อที่ต้องการเพิ่ม
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Icon name="person-outline" size={16} color="#8E8E93" /> ชื่อ
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  nameError ? styles.inputError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={validateName}
                  placeholder="กรอกชื่อผู้ติดต่อ"
                  placeholderTextColor="#C7C7CC"
                  autoCapitalize="words"
                />
                {name.length > 0 && !nameError && (
                  <Icon name="checkmark-circle" size={20} color="#34C759" />
                )}
              </View>
              {nameError ? (
                <Text style={styles.errorText}>{nameError}</Text>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Icon name="call-outline" size={16} color="#8E8E93" />{' '}
                เบอร์โทรศัพท์
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  phoneError ? styles.inputError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={validatePhone}
                  placeholder="กรอกเบอร์โทรศัพท์"
                  placeholderTextColor="#C7C7CC"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {phone.length > 0 && !phoneError && (
                  <Icon name="checkmark-circle" size={20} color="#34C759" />
                )}
              </View>
              {phoneError ? (
                <Text style={styles.errorText}>{phoneError}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                isFormInvalid ? styles.saveButtonDisabled : null,
              ]}
              onPress={handleSave}
              disabled={isFormInvalid}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Icon name="sync" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>กำลังบันทึก...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>บันทึกผู้ติดต่อ</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="close-outline" size={20} color="#8E8E93" />
              <Text style={styles.cancelButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    backgroundColor: '#fff',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1D1D1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  formContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
    paddingLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E7',
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1D1D1F',
    fontWeight: '500',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 6,
    paddingLeft: 4,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E7',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AddContactScreen;
