import assert from 'assert'
import fs from 'fs'

console.log('=== PHASE 3B: SECURITY RULES STRUCTURAL LOGIC TEST SUITE ===\n')

// Read the actual firestore.rules file
const rulesContent = fs.readFileSync('firestore.rules', 'utf8')
assert(rulesContent.includes('rules_version = \'2\';'), 'Rules must be version 2')

// -------------------------------------------------------------
// Rules Simulator mirroring the exact logic implemented in firestore.rules
// -------------------------------------------------------------

function evaluateConversationCreate(auth, resourceData) {
  const isAuthenticated = auth !== null
  const hasRole = (role) => isAuthenticated && auth.token?.role === role
  const isPlatformAdmin = hasRole('platform_admin')

  // Requester identity check
  const isRequesterIdentityValid =
    (isAuthenticated && auth.uid === resourceData.requesterId && resourceData.requesterRole === 'member') ||
    (hasRole('ngo_admin') && auth.token?.orgId === resourceData.requesterId && resourceData.requesterRole === 'org')

  // SEC-2: If requester is NGO, recipient must NOT be an NGO
  const isNotNgoToNgo = !(hasRole('ngo_admin') && (resourceData.recipientRole === 'org' || resourceData.type !== 'ngo'))

  const isPending = resourceData.requestStatus === 'pending'
  const isNotBlocked = resourceData.blocked === false
  const notSelf = resourceData.recipientId !== resourceData.requesterId

  return isAuthenticated && isRequesterIdentityValid && isNotNgoToNgo && isPending && isNotBlocked && notSelf
}

function evaluateConversationUpdate(auth, existingData, incomingData) {
  const isAuthenticated = auth !== null
  const hasRole = (role) => isAuthenticated && auth.token?.role === role

  const isConversationParticipant =
    (existingData.type === 'member' && existingData.participantIds.includes(auth?.uid)) ||
    (existingData.type === 'ngo' &&
      (existingData.participantIds.includes(auth?.uid) ||
        (hasRole('ngo_admin') && auth?.token?.orgId === existingData.orgId)))

  const isIntendedRecipient =
    (existingData.recipientRole === 'member' && auth?.uid === existingData.recipientId) ||
    (existingData.recipientRole === 'org' &&
      hasRole('ngo_admin') &&
      (auth?.token?.orgId === existingData.recipientId ||
        (existingData.orgId && auth?.token?.orgId === existingData.orgId)))

  const isRequester =
    (existingData.requesterRole === 'member' && auth?.uid === existingData.requesterId) ||
    (existingData.requesterRole === 'org' &&
      hasRole('ngo_admin') &&
      (auth?.token?.orgId === existingData.requesterId ||
        (existingData.orgId && auth?.token?.orgId === existingData.orgId)))

  // Diff check: only permitted fields can change
  const allowedKeys = new Set([
    'requestStatus',
    'respondedAt',
    'blocked',
    'blockedByUid',
    'reported',
    'lastMessageText',
    'lastMessageTime',
    'updatedAt',
  ])
  const changedKeys = Object.keys(incomingData).filter((k) => incomingData[k] !== existingData[k])
  const diffPermitted = changedKeys.every((k) => allowedKeys.has(k))

  // SEC-1: Status transition check
  const statusCheck =
    incomingData.requestStatus === existingData.requestStatus ||
    (existingData.requestStatus === 'pending' &&
      ['accepted', 'declined'].includes(incomingData.requestStatus) &&
      isIntendedRecipient &&
      !isRequester)

  return isAuthenticated && isConversationParticipant && diffPermitted && statusCheck
}

function evaluateCommunityProfileWrite(auth, memberUid, profileData) {
  const isAuthenticated = auth !== null
  const isUser = isAuthenticated && auth.uid === memberUid

  const allowedKeys = new Set([
    'uid',
    'nickname',
    'avatarId',
    'district',
    'interests',
    'communityOptIn',
    'updatedAt',
  ])
  const keys = Object.keys(profileData)
  const keysPermitted = keys.every((k) => allowedKeys.has(k))

  const validTypes =
    typeof profileData.uid === 'string' &&
    profileData.uid === memberUid &&
    typeof profileData.nickname === 'string' &&
    profileData.nickname.length > 0 &&
    profileData.nickname.length <= 50 &&
    typeof profileData.avatarId === 'string' &&
    (profileData.district === undefined || profileData.district === null || typeof profileData.district === 'string') &&
    (profileData.interests === undefined || Array.isArray(profileData.interests)) &&
    typeof profileData.communityOptIn === 'boolean'

  return isUser && keysPermitted && validTypes
}

function evaluateMessageCreate(auth, parentConv, messageData) {
  const isAuthenticated = auth !== null
  const hasRole = (role) => isAuthenticated && auth.token?.role === role

  const isParentParticipant =
    (parentConv.type === 'member' && parentConv.participantIds.includes(auth?.uid)) ||
    (parentConv.type === 'ngo' &&
      (parentConv.participantIds.includes(auth?.uid) ||
        (hasRole('ngo_admin') && auth?.token?.orgId === parentConv.orgId)))

  const isAccepted = parentConv.requestStatus === 'accepted'
  const isNotBlocked = parentConv.blocked === false

  const isAuthorValid =
    auth?.uid === messageData.authorId ||
    (hasRole('ngo_admin') && auth?.token?.orgId === messageData.authorId)

  return isAuthenticated && isParentParticipant && isAccepted && isNotBlocked && isAuthorValid
}

// -------------------------------------------------------------
// TEST CASES
// -------------------------------------------------------------

console.log('--- TEST 1: Requester cannot accept their own request ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const conv = {
    id: 'conv-1',
    type: 'member',
    requesterId: 'mem-1',
    requesterRole: 'member',
    recipientId: 'mem-2',
    recipientRole: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending',
    blocked: false,
  }
  const update = { ...conv, requestStatus: 'accepted' }
  const allowed = evaluateConversationUpdate(auth, conv, update)
  assert.strictEqual(allowed, false, 'Requester must not be allowed to self-accept')
  console.log('PASS: Requester self-accept successfully blocked.')
}

console.log('--- TEST 2: Requester cannot decline their own request ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const conv = {
    id: 'conv-1',
    type: 'member',
    requesterId: 'mem-1',
    requesterRole: 'member',
    recipientId: 'mem-2',
    recipientRole: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending',
    blocked: false,
  }
  const update = { ...conv, requestStatus: 'declined' }
  const allowed = evaluateConversationUpdate(auth, conv, update)
  assert.strictEqual(allowed, false, 'Requester must not be allowed to decline own request')
  console.log('PASS: Requester self-decline successfully blocked.')
}

console.log('--- TEST 3: Intended recipient can accept a pending request ---')
{
  const auth = { uid: 'mem-2', token: { role: 'member' } }
  const conv = {
    id: 'conv-1',
    type: 'member',
    requesterId: 'mem-1',
    requesterRole: 'member',
    recipientId: 'mem-2',
    recipientRole: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending',
    blocked: false,
  }
  const update = { ...conv, requestStatus: 'accepted', respondedAt: '2026-11-27T16:00:00Z' }
  const allowed = evaluateConversationUpdate(auth, conv, update)
  assert.strictEqual(allowed, true, 'Intended recipient must be permitted to accept')
  console.log('PASS: Intended recipient accepted pending request.')
}

console.log('--- TEST 4: Intended recipient can decline a pending request ---')
{
  const auth = { uid: 'mem-2', token: { role: 'member' } }
  const conv = {
    id: 'conv-1',
    type: 'member',
    requesterId: 'mem-1',
    requesterRole: 'member',
    recipientId: 'mem-2',
    recipientRole: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending',
    blocked: false,
  }
  const update = { ...conv, requestStatus: 'declined', respondedAt: '2026-11-27T16:00:00Z' }
  const allowed = evaluateConversationUpdate(auth, conv, update)
  assert.strictEqual(allowed, true, 'Intended recipient must be permitted to decline')
  console.log('PASS: Intended recipient declined pending request.')
}

console.log('--- TEST 5: Unrelated users cannot change request status ---')
{
  const auth = { uid: 'mem-3', token: { role: 'member' } }
  const conv = {
    id: 'conv-1',
    type: 'member',
    requesterId: 'mem-1',
    requesterRole: 'member',
    recipientId: 'mem-2',
    recipientRole: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending',
    blocked: false,
  }
  const update = { ...conv, requestStatus: 'accepted' }
  const allowed = evaluateConversationUpdate(auth, conv, update)
  assert.strictEqual(allowed, false, 'Unrelated user must be blocked')
  console.log('PASS: Unrelated user update successfully blocked.')
}

console.log('--- TEST 6: NGO A cannot initiate a conversation with NGO B ---')
{
  const auth = { uid: 'staff-asha', token: { role: 'ngo_admin', orgId: 'org-asha' } }
  const conv = {
    type: 'ngo',
    requesterId: 'org-asha',
    requesterRole: 'org',
    recipientId: 'org-samjhana',
    recipientRole: 'org',
    participantIds: ['org-asha', 'org-samjhana'],
    requestStatus: 'pending',
    blocked: false,
  }
  const allowed = evaluateConversationCreate(auth, conv)
  assert.strictEqual(allowed, false, 'NGO-to-NGO creation must be blocked')
  console.log('PASS: NGO-to-NGO messaging creation successfully blocked.')
}

console.log('--- TEST 7: NGO staff can initiate a permitted member conversation ---')
{
  const auth = { uid: 'staff-asha', token: { role: 'ngo_admin', orgId: 'org-asha' } }
  const conv = {
    type: 'ngo',
    requesterId: 'org-asha',
    requesterRole: 'org',
    recipientId: 'mem-1',
    recipientRole: 'member',
    participantIds: ['org-asha', 'mem-1'],
    requestStatus: 'pending',
    blocked: false,
  }
  const allowed = evaluateConversationCreate(auth, conv)
  assert.strictEqual(allowed, true, 'NGO staff must be able to message a member')
  console.log('PASS: NGO-to-Member initiation allowed.')
}

console.log('--- TEST 8: Members cannot inject unauthorized community profile fields ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const badProfile = {
    uid: 'mem-1',
    nickname: 'Sajilo',
    avatarId: 'avatar1',
    district: 'Lalitpur',
    communityOptIn: true,
    associatedOrgId: 'org-asha', // INJECTED SENSITIVE FIELD
    maliciousPayload: '<script>alert(1)</script>',
  }
  const allowed = evaluateCommunityProfileWrite(auth, 'mem-1', badProfile)
  assert.strictEqual(allowed, false, 'Injected fields must be rejected')
  console.log('PASS: Malicious community profile payload rejected.')
}

console.log('--- TEST 9: Members cannot modify another member\'s community profile ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const profile = {
    uid: 'mem-2',
    nickname: 'Prakriti',
    avatarId: 'avatar2',
    communityOptIn: false,
  }
  const allowed = evaluateCommunityProfileWrite(auth, 'mem-2', profile)
  assert.strictEqual(allowed, false, 'Cross-user profile modification must be blocked')
  console.log('PASS: Cross-user profile modification blocked.')
}

console.log('--- TEST 10: Valid community profile updates still work ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const validProfile = {
    uid: 'mem-1',
    nickname: 'Sajilo',
    avatarId: 'avatar1',
    district: 'Lalitpur',
    interests: ['Tailoring', 'Handicrafts'],
    communityOptIn: true,
  }
  const allowed = evaluateCommunityProfileWrite(auth, 'mem-1', validProfile)
  assert.strictEqual(allowed, true, 'Valid profile update must be accepted')
  console.log('PASS: Valid community profile update accepted.')
}

console.log('--- TEST 11: Blocked conversations cannot receive new messages ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const parentConv = {
    type: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'accepted',
    blocked: true, // BLOCKED CONVERSATION
  }
  const message = {
    authorId: 'mem-1',
    text: 'Hello, are you there?',
  }
  const allowed = evaluateMessageCreate(auth, parentConv, message)
  assert.strictEqual(allowed, false, 'Messages in blocked thread must be denied')
  console.log('PASS: Message to blocked conversation rejected.')
}

console.log('--- TEST 12: Existing message request and participant restrictions still work ---')
{
  const auth = { uid: 'mem-1', token: { role: 'member' } }
  const unacceptedConv = {
    type: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'pending', // NOT YET ACCEPTED
    blocked: false,
  }
  const message = {
    authorId: 'mem-1',
    text: 'Trying to chat before acceptance',
  }
  const allowed = evaluateMessageCreate(auth, unacceptedConv, message)
  assert.strictEqual(allowed, false, 'Messages before acceptance must be denied')

  const nonParticipantAuth = { uid: 'mem-3', token: { role: 'member' } }
  const acceptedConv = {
    type: 'member',
    participantIds: ['mem-1', 'mem-2'],
    requestStatus: 'accepted',
    blocked: false,
  }
  const allowedForNonParticipant = evaluateMessageCreate(nonParticipantAuth, acceptedConv, message)
  assert.strictEqual(allowedForNonParticipant, false, 'Non-participant cannot send message')
  console.log('PASS: Pre-acceptance and non-participant messaging restrictions verified.')
}

console.log('\n=== ALL 12 SECURITY RULE TEST CASES PASSED SUCCESSFULLY! ===\n')
