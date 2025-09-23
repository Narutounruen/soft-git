import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Dimensions,
  BackHandler
} from 'react-native';

const { width, height } = Dimensions.get('window');

const TransferKeypad = ({ 
  visible, 
  onClose, 
  onTransfer, 
  transferType = 'unattended', // 'unattended' หรือ 'attended'
  currentNumber = '' 
}) => {
  const [number, setNumber] = useState(currentNumber);

  // ปิด modal เมื่อกด back button
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, onClose]);

  // รีเซ็ตเลขเมื่อเปิด modal
  React.useEffect(() => {
    if (visible) {
      setNumber(currentNumber);
    }
  }, [visible, currentNumber]);

  const handleNumberPress = (digit) => {
    if (number.length < 15) { // จำกัดความยาวของเลข
      setNumber(number + digit);
    }
  };

  const handleBackspace = () => {
    setNumber(number.slice(0, -1));
  };

  const handleClear = () => {
    setNumber('');
  };

  const handleTransfer = () => {
    if (!number.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการโอนสาย');
      return;
    }

    Alert.alert(
      'ยืนยันการโอนสาย',
      `ต้องการโอนสายไปยังหมายเลข ${number} หรือไม่?`,
      [
        {
          text: 'ยกเลิก',
          style: 'cancel'
        },
        {
          text: 'โอนสาย',
          onPress: () => {
            onTransfer(number, transferType);
            onClose();
          }
        }
      ]
    );
  };

  const renderKeypadButton = (digit, extraStyle = {}) => (
    <TouchableOpacity
      key={digit}
      style={[styles.keypadButton, extraStyle]}
      onPress={() => handleNumberPress(digit)}
      activeOpacity={0.7}
    >
      <Text style={styles.keypadButtonText}>{digit}</Text>
    </TouchableOpacity>
  );

  const getTransferTypeText = () => {
    return transferType === 'attended' ? 'โอนสายแบบเชื่อมต่อ' : 'โอนสายทันที';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{getTransferTypeText()}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Display Screen */}
          <View style={styles.displayContainer}>
            <Text style={styles.displayText}>
              {number || 'ใส่หมายเลขที่ต้องการโอนสาย'}
            </Text>
            <View style={styles.displayUnderline} />
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              {transferType === 'attended' 
                ? 'จะเชื่อมต่อก่อนแล้วค่อยโอนสาย' 
                : 'จะโอนสายไปทันที'}
            </Text>
          </View>

          {/* Keypad */}
          <View style={styles.keypadContainer}>
            {/* Row 1: 1, 2, 3 */}
            <View style={styles.keypadRow}>
              {renderKeypadButton('1')}
              {renderKeypadButton('2')}
              {renderKeypadButton('3')}
            </View>

            {/* Row 2: 4, 5, 6 */}
            <View style={styles.keypadRow}>
              {renderKeypadButton('4')}
              {renderKeypadButton('5')}
              {renderKeypadButton('6')}
            </View>

            {/* Row 3: 7, 8, 9 */}
            <View style={styles.keypadRow}>
              {renderKeypadButton('7')}
              {renderKeypadButton('8')}
              {renderKeypadButton('9')}
            </View>

            {/* Row 4: *, 0, # */}
            <View style={styles.keypadRow}>
              {renderKeypadButton('*')}
              {renderKeypadButton('0')}
              {renderKeypadButton('#')}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.backspaceButton} 
              onPress={handleBackspace}
              disabled={Boolean(!number)}
            >
              <Text style={[
                styles.backspaceButtonText,
                !number && styles.disabledButtonText
              ]}>
                ⌫ ลบ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={handleClear}
              disabled={Boolean(!number)}
            >
              <Text style={[
                styles.clearButtonText,
                !number && styles.disabledButtonText
              ]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transfer Button */}
          <View style={styles.transferButtonContainer}>
            <TouchableOpacity 
              style={[
                styles.transferButton,
                !number && styles.transferButtonDisabled
              ]} 
              onPress={handleTransfer}
              disabled={Boolean(!number)}
            >
              <Text style={[
                styles.transferButtonText,
                !number && styles.transferButtonTextDisabled
              ]}>
                🔄 โอนสาย
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1B1E',
    letterSpacing: 0.3,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  displayContainer: {
    marginBottom: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  displayText: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: '300',
    textAlign: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
    letterSpacing: 1.2,
  },
  displayUnderline: {
    width: '70%',
    height: 1,
    backgroundColor: '#E8E8E8',
    marginTop: 8,
  },
  instructionsContainer: {
    marginBottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  keypadContainer: {
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1A1B1E',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  backspaceButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backspaceButtonText: {
    fontSize: 15,
    color: '#1A1B1E',
    fontWeight: '500',
  },
  clearButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  clearButtonText: {
    fontSize: 15,
    color: '#1A1B1E',
    fontWeight: '500',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  transferButtonContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  transferButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 28,
    elevation: 2,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    minWidth: 240,
    alignItems: 'center',
  },
  transferButtonDisabled: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  transferButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  transferButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default TransferKeypad;
