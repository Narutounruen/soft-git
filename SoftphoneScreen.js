import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';

const DIAL_BUTTONS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['*','0','#'],
];

const SoftphoneScreen = ({ 
  navigation, 
  status, 
  isConnected, 
  isInCall, 
  callStatus, 
  makeCall, 
  hangupCall,
  setCurrentCallNumber,
  navigateToCalling
}) => {
  const [number, setNumber] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState([]);

  const handlePress = (value) => {
    setNumber(prev => prev + value);
  };

  const handleDelete = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleCall = async () => {
    if (!isConnected) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเชื่อมต่อ SIP ก่อน');
      return;
    }

    if (!number.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่หมายเลขที่ต้องการโทร');
      return;
    }

    if (isInCall) {
      // ถ้ากำลังโทรอยู่ ให้วางสาย
      await hangupCall();
    } else {
      // ถ้ายังไม่ได้โทร ให้โทรออก
      setCurrentCallNumber(number);
      // เพิ่มเข้าประวัติการโทร
      const newCall = {
        number: number,
        timestamp: new Date().toISOString(),
        type: 'outgoing'
      };
      setCallHistory(prev => [newCall, ...prev].slice(0, 50)); // เก็บประวัติล่าสุด 50 รายการ
      await makeCall(number);
      // รอสักครู่แล้วไปยังหน้า CallingScreen
      setTimeout(() => {
        navigation.navigate('Calling');
      }, 500);
    }
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleMenuOption = (option) => {
    setShowMenu(false);
    if (option === 'sip') {
      navigation.navigate('SIPConnector');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Menu */}
      <View style={styles.header}>
        <View style={{flex: 1}} />
        <TouchableOpacity style={styles.menuButton} onPress={toggleMenu}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topSection}>
        <Text style={styles.numberDisplay}>
          {number}
        </Text>
      </View>

      <View style={styles.centerSection}>
        <View style={styles.dialPad}>
          {DIAL_BUTTONS.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.dialRow}>
              {row.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dialButton}
                  onPress={() => handlePress(item)}
                  disabled={isInCall}
                >
                  <Text style={styles.dialButtonText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={[styles.dialRow, {justifyContent: 'center'}]}>
            <View style={{flex: 1.5}} />
            <TouchableOpacity 
              style={[
                styles.callButton, 
                isInCall ? styles.hangupButton : null
              ]} 
              onPress={handleCall}
            >
              <Text style={styles.callButtonText}>
                {isInCall ? '📞' : '📞'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleDelete}
              onLongPress={() => setNumber('')}
              disabled={isInCall}
            >
              <Text style={styles.actionButtonText}>⌫</Text>
            </TouchableOpacity>
            <View style={{flex: 0.5}} />
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        {/* แสดงสถานะการเชื่อมต่อที่ด้านล่าง */}
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusLED,
              isConnected ? styles.statusLEDSuccess :
              status.includes('❌') ? styles.statusLEDError :
              styles.statusLEDDefault
            ]} />
            <Text style={[
              styles.status,
              isConnected ? styles.success : 
              status.includes('❌') ? styles.error : styles.default
            ]}>
              {status}
            </Text>
          </View>
        </View>
      </View>

      {/* Dropdown Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderText}>เมนู</Text>
              <TouchableOpacity 
                style={styles.menuCloseButton}
                onPress={() => setShowMenu(false)}
              >
                <Text style={styles.menuCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuOption('sip')}
            >
              <View style={styles.menuItemIcon}>
                <Text style={styles.menuItemIconText}>⚙️</Text>
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>การตั้งค่า SIP</Text>
                <Text style={styles.menuItemSubtitle}>ตั้งค่าการเชื่อมต่อ SIP Server</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowHistory(true);
              }}
            >
              <View style={styles.menuItemIcon}>
                <Text style={styles.menuItemIconText}>📞</Text>
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>ประวัติการโทร</Text>
                <Text style={styles.menuItemSubtitle}>ดูรายการโทรทั้งหมด</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Call History Modal */}
      <Modal
        visible={showHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.historyModalContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>ประวัติการโทร</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowHistory(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.historyList}>
            {callHistory.length === 0 ? (
              <Text style={styles.noHistoryText}>ไม่มีประวัติการโทร</Text>
            ) : (
              callHistory.map((call, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.historyItem}
                  onPress={() => {
                    setNumber(call.number);
                    setShowHistory(false);
                  }}
                >
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyNumber}>{call.number}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(call.timestamp).toLocaleString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit'
                      })}
                    </Text>
                  </View>
                  <Text style={styles.historyType}>
                    {call.type === 'outgoing' ? '📞 โทรออก' : '📞 สายเข้า'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#2d3436',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  menuIcon: {
    fontSize: 20,
    color: '#333',
  },
  topSection: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  centerSection: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  bottomSection: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'flex-end' },
  statusContainer: {
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '50%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statusLED: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusLEDDefault: {
    backgroundColor: '#95a5a6',
  },
  statusLEDSuccess: {
    backgroundColor: '#27AE60',
  },
  statusLEDError: {
    backgroundColor: '#E74C3C',
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
  callStatusContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
  },
  callStatusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  numberDisplay: { fontSize: 35, marginBottom: 25, textAlign: 'center', color: '#222', fontWeight: '500' },
  dialPad: { alignItems: 'center', justifyContent: 'center' },
  dialRow: { flexDirection: 'row', marginBottom: 15 },
  dialButton: {
    width: 70, height: 70, marginHorizontal: 10, borderRadius: 35,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  dialButtonText: { fontSize: 28, color: '#333', fontWeight: 'bold' },
  actionButton: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#ff7675',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 3,
  },
  actionButtonText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  callButton: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#00b894',
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 3,
  },
  hangupButton: {
    backgroundColor: '#f44336',
  },
  callButtonText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginTop: 80,
    marginRight: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    minWidth: 280,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  menuCloseButton: {
    padding: 5,
  },
  menuCloseText: {
    fontSize: 20,
    color: '#666',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuItemIconText: {
    fontSize: 20,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 5,
  },
  menuItemDanger: {
    backgroundColor: '#fff5f5',
  },
  menuItemTitleDanger: {
    color: '#dc3545',
  },
  historyModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  historyList: {
    flex: 1,
    padding: 10,
  },
  noHistoryText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
  },
  historyItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  historyNumber: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  historyTime: {
    fontSize: 14,
    color: '#666',
  },
  historyType: {
    fontSize: 14,
    color: '#666',
  },
});

export default SoftphoneScreen;
