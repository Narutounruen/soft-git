import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { useContacts } from '../useContacts';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const ContactScreen = ({ navigation, makeCall, setCurrentCallNumber }) => {
  const { contacts, loading, error, deleteContact } = useContacts();
  const [searchTerm, setSearchTerm] = useState('');

  // Removed useLayoutEffect to allow header to show

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#E74C3C" />
          <Text style={styles.errorTitle}>เกิดข้อผิดพลาด</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredContacts = contacts.filter(
    contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm),
  );

  const handleCall = async (phoneNumber) => {
    try {
      if (makeCall && setCurrentCallNumber) {
        setCurrentCallNumber(phoneNumber);
        await makeCall(phoneNumber);
        // ไปยังหน้า CallingScreen
        navigation.navigate('Calling');
      } else {
        // fallback เป็น native call
        const phoneUrl = `tel:${phoneNumber}`;
        const supported = await Linking.canOpenURL(phoneUrl);
        if (supported) {
          await Linking.openURL(phoneUrl);
        } else {
          Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโทรได้');
        }
      }
    } catch (error) {
      console.error('Call error:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโทรได้');
    }
  };

  const handleDelete = (contact) => {
    Alert.alert(
      'ยืนยันการลบ',
      `คุณต้องการลบ ${contact.name} หรือไม่?`,
      [
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(contact.id);
            } catch (error) {
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบผู้ติดต่อได้');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item, index }) => {
    const firstLetter = item.name.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(firstLetter);
    
    return (
      <View style={styles.contactItemWrapper}>
        <TouchableOpacity 
          style={[styles.contactItem, { 
            transform: [{ scale: 0.98 }] 
          }]}
          activeOpacity={0.7}
          onPress={() => handleCall(item.phone)}
        >
          <View style={styles.contactContent}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactPhone}>{item.phone}</Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={() => handleCall(item.phone)}
              >
                <Icon name="call" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(item)}
              >
                <Icon name="trash" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const getAvatarColor = (letter) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#A55EEA', '#26DE81', '#FD79A8', '#FDCB6E', '#6C5CE7'
    ];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Back Button Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ผู้ติดต่อ</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('AddContact')}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={20}
            color="#8E8E93"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาผู้ติดต่อ..."
            placeholderTextColor="#8E8E93"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Icon name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
        {filteredContacts.length > 0 && (
          <Text style={styles.contactCount}>
            {filteredContacts.length} รายการ
          </Text>
        )}
      </View>
      
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon 
              name={searchTerm ? "search-outline" : "person-add-outline"} 
              size={80} 
              color="#C7C7CC" 
            />
            <Text style={styles.emptyTitle}>
              {searchTerm ? 'ไม่พบผู้ติดต่อ' : 'ยังไม่มีผู้ติดต่อ'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchTerm 
                ? 'ลองค้นหาด้วยคำอื่น' 
                : 'แตะปุ่ม + เพื่อเพิ่มผู้ติดต่อใหม่'
              }
            </Text>
            {!searchTerm && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AddContact')}
              >
                <Text style={styles.emptyButtonText}>เพิ่มผู้ติดต่อ</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredContacts.length === 0 ? styles.emptyList : styles.listContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: 15,
  },
  addButtonContainer: {
    backgroundColor: '#4A90E2',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    padding: 8,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1D1D1F',
    fontWeight: '400',
  },
  contactCount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    fontWeight: '500',
  },
  listContainer: {
    paddingVertical: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  contactItemWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  contactItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '400',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  callButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContactScreen;
