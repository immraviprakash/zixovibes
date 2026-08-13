import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBi4jXmU6Az24oE5kw8m9kArmNUmxHs6P0",
    authDomain: "zixovibes.firebaseapp.com",
    projectId: "zixovibes",
    storageBucket: "zixovibes.firebasestorage.app",
    messagingSenderId: "380922480857",
    appId: "1:380922480857:web:ac4ae698f4eee5545f16c8"
};

// Initialize client Firebase app on backend for simple, secret-free Firestore access
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// History limit of maximum 25 exchanges
const HISTORY_LIMIT = 25;

/**
 * Loads the latest conversation history from Firestore for a specific user.
 * Stores under nested map 'ai.classicConversation' inside the user's primary document.
 * 
 * @param {string} userId - The authenticated user ID.
 * @returns {Promise<Array>} - The loaded message array.
 */
export async function loadConversation(userId) {
  if (!userId || userId === 'guest') return [];
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const messages = data.ai?.classicConversation?.messages || [];
      // Keep only the last HISTORY_LIMIT messages
      return messages.slice(-HISTORY_LIMIT);
    }
  } catch (error) {
    console.error(`[Conversation Service] Failed to load history for ${userId}:`, error);
  }
  return [];
}

/**
 * Saves conversation history to Firestore for a specific user, capped to 25 exchanges.
 * 
 * @param {string} userId - The authenticated user ID.
 * @param {Array} messages - The complete message list.
 */
export async function saveConversation(userId, messages) {
  if (!userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId);
    const cappedMessages = messages.slice(-HISTORY_LIMIT);
    await setDoc(docRef, {
      ai: {
        classicConversation: {
          messages: cappedMessages
        }
      }
    }, { merge: true });
  } catch (error) {
    console.error(`[Conversation Service] Failed to save history for ${userId}:`, error);
  }
}

/**
 * Permanently clears a user's conversation history in Firestore.
 * 
 * @param {string} userId - The authenticated user ID.
 */
export async function clearConversation(userId) {
  if (!userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      ai: {
        classicConversation: {
          messages: []
        }
      }
    }, { merge: true });
  } catch (error) {
    console.error(`[Conversation Service] Failed to clear history for ${userId}:`, error);
  }
}
