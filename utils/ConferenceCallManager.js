import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, FlatList } from 'react-native';

const ConferenceCallManager = forwardRef(({ 
  endpointRef, 
  activeCalls = [], 
  setCallStatus, 
  onConferenceStateChange 
}, ref) => {
  const [isConferenceActive, setIsConferenceActive] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [newNumber, setNewNumber] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // รวมสาย (Conference)
  const mergeCalls = async (call1, call2) => {
    try {
      if (!endpointRef?.current) {
        throw new Error('Endpoint not ready');
      }

      if (!call1 || !call2) {
        Alert.alert('❌ Error', 'ต้องมีสายอย่างน้อย 2 สายก่อน merge');
        return;
      }

      console.log(`🔗 Merging ${call1.id} and ${call2.id} (no hold)`);
      setCallStatus?.('กำลังรวมสาย (ไม่พักสาย)...');

      const endpoint = endpointRef.current;
      // อย่าพักสายใด ๆ ให้แน่ใจว่าทั้งสองสายไม่ถูก hold
      if (endpoint.unholdCall) {
        try { await endpoint.unholdCall(call1.id); } catch (e) {}
        try { await endpoint.unholdCall(call2.id); } catch (e) {}
      }

      setParticipants([call1, call2]);
      setIsConferenceActive(true);
      setCallStatus?.('🎙️ เริ่ม Conference สำเร็จ');
      onConferenceStateChange?.(true);
    } catch (error) {
      console.error('mergeCalls error:', error);
      Alert.alert('Error', 'ไม่สามารถรวมสายได้');
      setCallStatus?.('❌ ไม่สามารถรวมสายได้');
    }
  };

  // เพิ่มคนเข้า Conference
  const addParticipant = async (number) => {
    if (!endpointRef?.current) {
      Alert.alert('Error', 'Endpoint ยังไม่พร้อม');
      return;
    }
    if (!number || !number.trim()) {
      Alert.alert('⚠️ ใส่หมายเลขก่อน');
      return;
    }

    try {
      setIsAdding(true);
      const endpoint = endpointRef.current;
      const account = await endpoint.getAccounts().then(accs => accs[0]);

      if (!account) {
        Alert.alert('Error', 'ยังไม่มีบัญชี SIP ที่ใช้งานอยู่');
        return;
      }

      const target = number.includes('@') ? number : `sip:${number}@yourdomain.com`;
      console.log('📞 กำลังโทรเพิ่มเข้า Conference:', target);

      const call = await endpoint.makeCall(account, target);
      setParticipants(prev => [...prev, { id: call.id, number: number }]);
      setNewNumber('');
      setIsAdding(false);
      setCallStatus?.(`เพิ่ม ${number} เข้าร่วมแล้ว`);
    } catch (error) {
      console.error('addParticipant error:', error);
      Alert.alert('Error', 'เพิ่มผู้เข้าร่วมไม่สำเร็จ');
      setIsAdding(false);
    }
  };

  // เอาออกจาก Conference
  const removeParticipant = async (p) => {
    try {
      const endpoint = endpointRef.current;
      Alert.alert(
        'ลบออกจาก Conference',
        `ต้องการตัดสาย ${p.number || p.id} ออกจากห้องหรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ลบ', onPress: async () => {
              await endpoint.hangupCall(p.id);
              setParticipants(prev => prev.filter(i => i.id !== p.id));

              if (participants.length <= 2) {
                endConference();
              }
            }
          }
        ]
      );
    } catch (e) {
      console.error('removeParticipant error:', e);
    }
  };

  // จบการประชุมทั้งหมด
  const endConference = async () => {
    try {
      const endpoint = endpointRef.current;
      console.log('🔴 จบ Conference');
      for (const p of participants) {
        await endpoint.hangupCall(p.id);
      }
      setIsConferenceActive(false);
      setParticipants([]);
      onConferenceStateChange?.(false);
      setCallStatus?.('Conference สิ้นสุดแล้ว');
    } catch (e) {
      console.error('endConference error:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    mergeCalls,
    addParticipant,
    removeParticipant,
    endConference,
    isConferenceActive,
    participants
  }));

  if (!isConferenceActive) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎙️ Conference Call ({participants.length})</Text>

      <FlatList
        data={participants}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.participantRow}>
            <Text style={styles.participantText}>📞 {item.number || item.id}</Text>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeParticipant(item)}>
              <Text style={styles.removeText}>❌</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.addContainer}>
        <TextInput
          style={styles.input}
          placeholder="เพิ่มหมายเลขใหม่"
          placeholderTextColor="#888"
          value={newNumber}
          onChangeText={setNewNumber}
          keyboardType="phone-pad"
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => addParticipant(newNumber)}
          disabled={isAdding}>
          <Text style={styles.addText}>{isAdding ? '⏳' : '➕'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endBtn} onPress={endConference}>
        <Text style={styles.endText}>จบ Conference</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    padding: 15,
    borderRadius: 12,
    margin: 10,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2A2A2E',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  participantText: {
    color: '#fff',
    fontSize: 15,
  },
  removeBtn: {
    paddingHorizontal: 8,
  },
  removeText: {
    color: '#E74C3C',
    fontSize: 18,
  },
  addContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
  },
  addText: {
    color: '#fff',
    fontSize: 18,
  },
  endBtn: {
    backgroundColor: '#E63946',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  endText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ConferenceCallManager;
