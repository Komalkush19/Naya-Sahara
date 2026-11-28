/**
 * messageService.js
 *
 * Frontend service for managing conversations and messages.
 * Communicates with backend /api/conversations endpoints and supports
 * real-time Firestore listeners for active conversations and messages.
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db, auth } from '../firebase/config.js'

async function getAuthHeader() {
  if (!auth.currentUser) return {}
  try {
    const token = await auth.currentUser.getIdToken()
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

/**
 * Fetch all conversations for the current authenticated user via backend API.
 */
export async function getConversations() {
  const headers = await getAuthHeader()
  const res = await fetch('/api/conversations', {
    headers: {
      ...headers,
      Accept: 'application/json',
    },
  })
  return res.json()
}

/**
 * Send a conversation request.
 * @param {Object} params
 * @param {string} params.targetId
 * @param {string} params.targetType - 'member' | 'ngo'
 * @param {string} params.targetName
 * @param {string} [params.targetAvatar]
 * @param {string} [params.targetSubtitle]
 * @param {string} [params.introMessage]
 */
export async function sendConversationRequest(params) {
  const headers = await getAuthHeader()
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  })
  return res.json()
}

/**
 * Update conversation status (accept, decline, cancel, block, unblock, report).
 * @param {Object} params
 * @param {string} params.conversationId
 * @param {'accept'|'decline'|'cancel'|'block'|'unblock'|'report'} params.action
 * @param {string} [params.reason]
 */
export async function updateConversationStatus({ conversationId, action, reason }) {
  const headers = await getAuthHeader()
  const res = await fetch('/api/conversations', {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ conversationId, action, reason }),
  })
  return res.json()
}

/**
 * Fetch messages for an accepted conversation.
 * @param {string} conversationId
 */
export async function getMessages(conversationId) {
  const headers = await getAuthHeader()
  const res = await fetch(
    `/api/conversations/messages?conversationId=${encodeURIComponent(conversationId)}`,
    {
      headers: {
        ...headers,
        Accept: 'application/json',
      },
    },
  )
  return res.json()
}

/**
 * Send a message within an accepted conversation.
 * @param {string} conversationId
 * @param {string} text
 */
export async function sendMessage(conversationId, text) {
  const headers = await getAuthHeader()
  const res = await fetch('/api/conversations/messages', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ conversationId, text }),
  })
  return res.json()
}

/**
 * Subscribe to real-time conversation updates for a user/organization.
 * @param {Object} options
 * @param {string} options.role - 'member' | 'ngo_admin'
 * @param {string} options.uid - Member UID or User UID
 * @param {string} [options.orgId] - NGO orgId if role is ngo_admin
 * @param {function} onUpdate - callback receiving updated conversations array
 * @param {function} [onError] - error callback
 * @returns {function} unsubscribe function
 */
export function subscribeToConversations({ role, uid, orgId }, onUpdate, onError) {
  if (!db || !uid) return () => {}

  try {
    let q
    if (role === 'ngo_admin' && orgId) {
      q = query(collection(db, 'conversations'), where('orgId', '==', orgId))
    } else {
      q = query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', uid),
      )
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const convs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        // Sort descending by updatedAt or createdAt
        convs.sort((a, b) => {
          const tA = a.updatedAt || a.createdAt || ''
          const tB = b.updatedAt || b.createdAt || ''
          return tB.localeCompare(tA)
        })
        onUpdate(convs)
      },
      (err) => {
        onError?.(err)
      },
    )
  } catch (err) {
    onError?.(err)
    return () => {}
  }
}

/**
 * Subscribe to real-time messages for an accepted conversation.
 * @param {string} conversationId
 * @param {function} onUpdate - callback receiving messages array
 * @param {function} [onError] - error callback
 * @returns {function} unsubscribe function
 */
export function subscribeToMessages(conversationId, onUpdate, onError) {
  if (!db || !conversationId) return () => {}

  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        onUpdate(msgs)
      },
      (err) => {
        onError?.(err)
      },
    )
  } catch (err) {
    onError?.(err)
    return () => {}
  }
}
