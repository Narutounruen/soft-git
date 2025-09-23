import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const app = getApp();
    const unsubscribe = firestore(app)
      .collection('contacts')
      .orderBy('name', 'asc')
      .onSnapshot(
        snapshot => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setContacts(data);
          setLoading(false);
        },
        err => {
          setError(err);
          setLoading(false);
        }
      );
    
    return () => unsubscribe();
  }, []);

  const deleteContact = async (contactId) => {
    try {
      const app = getApp();
      await firestore(app).collection('contacts').doc(contactId).delete();
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  };

  return { contacts, loading, error, deleteContact };
}
