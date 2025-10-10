import firestore from '@react-native-firebase/firestore';

// Collection name for call history
const COLLECTION_NAME = 'callHistory';

/**
 * Save call history to Firestore
 * @param {Object} callData - Call data object
 * @param {string} callData.number - Phone number
 * @param {string} callData.type - 'outgoing' or 'incoming'
 * @param {string} callData.duration - Call duration (optional)
 * @param {string} userId - User ID to associate with the call
 * @returns {Promise<string>} Document ID
 */
export const saveCallHistory = async (callData, userId = 'default_user') => {
  try {
    // สร้าง key ป้องกันซ้ำ: เบอร์ + วัน + ชั่วโมง + นาที
    const number = callData.number;
    const dateObj = new Date(callData.timestamp || callData.createdAt || Date.now());
    const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()+1}-${dateObj.getDate()}_${dateObj.getHours()}_${dateObj.getMinutes()}`;
    const uniqueKey = `${number}_${dateKey}`;

    // ตรวจสอบว่ามี record นี้อยู่แล้วหรือยัง
    const snapshot = await firestore()
      .collection(COLLECTION_NAME)
      .where('userId', '==', userId)
      .where('number', '==', number)
      .where('createdAtKey', '==', uniqueKey)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      console.log('Call history already exists for:', uniqueKey);
      return null;
    }

    const callRecord = {
      ...callData,
      userId,
      timestamp: firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      createdAtKey: uniqueKey,
    };

    const docRef = await firestore()
      .collection(COLLECTION_NAME)
      .add(callRecord);

    console.log('Call history saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving call history:', error);
    throw error;
  }
}

/**
 * Subscribe to call history updates
 * @param {string} userId - User ID to filter call history
 * @param {Function} callback - Callback to handle updates
 * @param {number} limit - Number of records to fetch (default: 50)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCallHistory = (
  userId = 'default_user',
  callback,
  limit = 50
) => {
  try {
    const unsubscribe = firestore()
      .collection(COLLECTION_NAME)
      .where('userId', '==', userId)
      .limit(limit)
      .onSnapshot(
        snapshot => {
          const callHistory = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          // Sort by createdAt in JavaScript instead of Firestore
          const sortedHistory = callHistory.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.timestamp || 0);
            const dateB = new Date(b.createdAt || b.timestamp || 0);
            return dateB - dateA; // Descending order (newest first)
          });
          
          callback(sortedHistory, null);
        },
        error => {
          console.error('Error in call history subscription:', error);
          callback([], error);
        }
      );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up call history subscription:', error);
    callback([], error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Delete a call history record
 * @param {string} callId - Document ID of the call to delete
 * @returns {Promise<void>}
 */
export const deleteCallHistory = async (callId) => {
  try {
    await firestore()
      .collection(COLLECTION_NAME)
      .doc(callId)
      .delete();

    console.log('Call history deleted:', callId);
  } catch (error) {
    console.error('Error deleting call history:', error);
    throw error;
  }
};

/**
 * Clear all call history for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const clearCallHistory = async (userId = 'default_user') => {
  try {
    const snapshot = await firestore()
      .collection(COLLECTION_NAME)
      .where('userId', '==', userId)
      .get();

    const batch = firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('All call history cleared for user:', userId);
  } catch (error) {
    console.error('Error clearing call history:', error);
    throw error;
  }
}
