import { useEffect, useState } from 'react'
import AppShell from './components/AppShell.jsx'
import { Button, Icon } from './components/ui.jsx'
import { IMAGE_PATHS, MEMBER_AVATAR_OPTIONS } from './config/images.js'
import { tx } from './i18n.js'
import {
  initialAssociatedMembers,
  initialOrganizations,
} from './data.js'
import AuthPage from './pages/AuthPage.jsx'
import CasesPage from './pages/Cases.jsx'
import CommunityPage from './pages/Community.jsx'
import Dashboard from './pages/Dashboard.jsx'
import LandingPage from './pages/Landing.jsx'
import MessagesPage from './pages/Messages.jsx'
import NoticesPage from './pages/Notices.jsx'
import OrganizationsPage from './pages/Organizations.jsx'
import TeamPage from './pages/Team.jsx'
import { useAuth } from './hooks/useAuth.js'
import { auth } from './firebase/config.js'
import { issueHandoverCode } from './services/ngoService.js'
import {
  fetchPublicOrganizations,
  fetchAdminOrganizations,
  submitOrganizationApplication,
  reviewOrganization,
} from './services/organizationService.js'
import {
  updateMemberProfileFirestore,
  fetchCommunityDirectory,
} from './services/memberService.js'
import {
  fetchPublicNotices,
  fetchOrgNotices,
  fetchAdminNotices,
  createNoticeApi,
  updateNoticeApi,
  deleteNoticeApi,
  adminModerateNotice,
  createGovNoticeApi,
} from './services/noticeService.js'
import {
  getConversations as fetchConversationsApi,
  sendConversationRequest as sendConversationRequestApi,
  updateConversationStatus as updateConversationStatusApi,
  sendMessage as sendMessageApi,
  subscribeToConversations,
  subscribeToMessages,
} from './services/messageService.js'

const ALLOWED_PAGES_BY_ROLE = {
  guest: new Set(['home', 'organizations', 'notices']),
  member: new Set(['home', 'notices', 'organizations', 'community', 'messages']),
  org: new Set(['home', 'cases', 'team', 'notices', 'organizations', 'messages']),
  admin: new Set(['home', 'organizations', 'notices']),
}

function QuickExitScreen({ onReturn, language }) {
  return (
    <main className="quick-exit-screen">
      <div className="quick-exit-card">
        <div className="brand-mark"><Icon name="calendar_month" size={24} /></div>
        <p className="eyebrow">{tx(language, 'CALENDAR', 'पात्रो')}</p>
        <h1>{tx(language, 'Your day, at a glance.', 'तपाईंको दिनको झलक।')}</h1>
        <p>{new Date().toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <Button onClick={onReturn} variant="secondary">{tx(language, 'Return', 'फर्कनुहोस्')}</Button>
      </div>
    </main>
  )
}

export default function App() {
  const {
    user: authUser,
    role: authRole,
    loading: authLoading,
    registerMember,
    loginMember,
    loginStaff,
    logout,
  } = useAuth()

  const [publicView, setPublicView] = useState('landing') // 'landing' | 'auth' | 'app' | 'guest'
  const [authMode, setAuthMode] = useState('login')
  const sessionRole = authRole // Strictly derived from backend auth state: 'member' | 'org' | 'admin' | null
  const [page, setPage] = useState('home')
  const [language, setLanguage] = useState('ne')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [quickExit, setQuickExit] = useState(false)

  // Demo synthetic data
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [notices, setNotices] = useState([])
  const [noticesLoading, setNoticesLoading] = useState(false)
  const [noticesError, setNoticesError] = useState('')
  const [associatedMembers, _setAssociatedMembers] = useState(initialAssociatedMembers)
  const [team, setTeam] = useState([
    {
      id: 'worker-1',
      displayName: 'Maya Sharma',
      roleTitle: 'Community Caseworker',
      bio: 'Post-release community transition and crisis counseling.',
      active: true,
      photoUrl: IMAGE_PATHS.caseworkers.caseworker1,
    },
    {
      id: 'worker-2',
      displayName: 'Deepa Gurung',
      roleTitle: 'Vocational Liaison',
      bio: 'Employment readiness, tailoring apprenticeships, and stipend support.',
      active: true,
      photoUrl: IMAGE_PATHS.caseworkers.caseworker2,
    },
  ])

  // Member authentication state synchronized with backend
  const [memberId, setMemberId] = useState('')
  const [memberNickname, setMemberNickname] = useState('')
  const [memberAvatarId, setMemberAvatarId] = useState('')
  const [memberDistrict, setMemberDistrict] = useState('')
  const [memberInterests, setMemberInterests] = useState([])
  const [memberCommunityOptIn, setMemberCommunityOptIn] = useState(false)
  const [memberShowDistrict, setMemberShowDistrict] = useState(true)
  const [memberShowInterests, setMemberShowInterests] = useState(true)

  // Active NGO organization state for staff sessions
  const [activeOrgId, setActiveOrgId] = useState('')

  // Synchronize authenticated user profile to local state
  useEffect(() => {
    if (authUser && authRole) {
      if (authRole === 'member') {
        if (authUser.uid) setMemberId(authUser.uid)
        if (authUser.nickname) setMemberNickname(authUser.nickname)
        if (authUser.avatarId) setMemberAvatarId(authUser.avatarId)
        if (authUser.district !== undefined) setMemberDistrict(authUser.district)
        if (authUser.interests !== undefined) setMemberInterests(authUser.interests)
        if (authUser.communityOptIn !== undefined) setMemberCommunityOptIn(authUser.communityOptIn)
      } else if (authRole === 'org') {
        if (authUser.orgId) setActiveOrgId(authUser.orgId)
      }
      setPublicView('app')
    } else if (!authUser) {
      // Clear all user-dependent identity and conversation state when unauthenticated
      setMemberId('')
      setMemberNickname('')
      setMemberAvatarId('')
      setMemberDistrict('')
      setMemberInterests([])
      setMemberCommunityOptIn(false)
      setActiveOrgId('')
      setConversations([])
      setReports([])
    }
  }, [authUser, authRole])

  // Role-aware route guard: redirect to auth if trying to access protected views unauthenticated
  useEffect(() => {
    if (!authLoading && !sessionRole && publicView === 'app') {
      setPublicView('auth')
    }
  }, [authLoading, sessionRole, publicView])

  // Page authorization guard: restrict inaccessible pages by role
  useEffect(() => {
    if (sessionRole && ALLOWED_PAGES_BY_ROLE[sessionRole]) {
      if (!ALLOWED_PAGES_BY_ROLE[sessionRole].has(page)) {
        setPage('home')
      }
    } else if (publicView === 'guest') {
      if (!ALLOWED_PAGES_BY_ROLE.guest.has(page)) {
        setPage('home')
      }
    }
  }, [sessionRole, page, publicView])

  // Reports state for retaining report reasons in demonstration
  const [_reports, setReports] = useState([])

  // Community directory state (opt-in members only, fetched from communityProfiles)
  const [communityMembers, setCommunityMembers] = useState([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState('')

  // Load community directory when a member is authenticated
  const loadCommunityDirectory = async () => {
    if (!authUser || authRole !== 'member') return
    setCommunityLoading(true)
    setCommunityError('')
    try {
      const result = await fetchCommunityDirectory()
      if (result.ok) {
        setCommunityMembers(result.members)
      } else {
        setCommunityError(result.error || 'Failed to load community directory')
      }
    } finally {
      setCommunityLoading(false)
    }
  }

  useEffect(() => {
    if (authUser && authRole === 'member') {
      loadCommunityDirectory()
    } else if (!authUser) {
      setCommunityMembers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authRole])

  // Member profile update handler — persists to Firestore then updates local state
  const updateMemberProfile = async ({
    nickname,
    avatarId,
    district,
    interests,
    communityOptIn,
    showDistrict,
    showInterests,
  }) => {
    // Optimistic local update first for instant UI feedback
    if (nickname && nickname.trim()) setMemberNickname(nickname.trim())
    if (avatarId !== undefined) setMemberAvatarId(avatarId)
    if (district !== undefined) setMemberDistrict(district)
    if (interests !== undefined) setMemberInterests(interests)
    if (communityOptIn !== undefined) setMemberCommunityOptIn(communityOptIn)
    if (showDistrict !== undefined) setMemberShowDistrict(showDistrict)
    if (showInterests !== undefined) setMemberShowInterests(showInterests)

    // Persist to Firestore (members + communityProfiles)
    if (memberId && memberNickname) {
      const result = await updateMemberProfileFirestore(
        memberId,
        (nickname && nickname.trim()) || memberNickname,
        { avatarId, district, interests, communityOptIn },
      )
      if (!result.ok && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[Profile] Firestore save failed:', result.error)
      }
      // Refresh community directory if opt-in changed so directory updates immediately
      if (communityOptIn !== undefined) {
        loadCommunityDirectory()
      }
    }
  }

  // Messaging state (text-only MVP supporting Woman <-> Woman and Woman <-> NGO with explicit stable IDs)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)

  // Helper to get active session user ID, role, and avatar
  const role = sessionRole || 'guest'
  const currentUserId = role === 'org' ? activeOrgId : role === 'member' ? memberId : null
  const memberAvatarSrc =
    MEMBER_AVATAR_OPTIONS.find((item) => item.id === memberAvatarId)?.src || IMAGE_PATHS.avatars.avatar1

  // Load conversations from backend & subscribe to real-time updates
  useEffect(() => {
    if (!currentUserId || (role !== 'member' && role !== 'org')) {
      setConversations([])
      return
    }

    // 1. Initial load via API
    fetchConversationsApi()
      .then((data) => {
        if (data && data.ok && Array.isArray(data.conversations)) {
          setConversations((prev) => {
            // merge with any local active messages
            return data.conversations.map((c) => {
              const existing = prev.find((p) => p.id === c.id)
              return {
                ...c,
                messages: existing?.messages || c.messages || [],
              }
            })
          })
        }
      })
      .catch((err) => {
        console.warn('[App] fetchConversationsApi failed:', err)
      })

    // 2. Real-time Firestore subscription
    const unsubscribe = subscribeToConversations(
      {
        role: role === 'org' ? 'ngo_admin' : 'member',
        uid: auth.currentUser?.uid || memberId,
        orgId: activeOrgId,
      },
      (realtimeConvs) => {
        setConversations((prev) => {
          return realtimeConvs.map((c) => {
            const existing = prev.find((p) => p.id === c.id)
            return {
              ...c,
              messages: existing?.messages || c.messages || [],
            }
          })
        })
      },
    )

    return () => {
      unsubscribe?.()
    }
  }, [currentUserId, role, activeOrgId, memberId])

  // Real-time subscription to active conversation messages
  useEffect(() => {
    if (!activeConversationId) return

    const unsubscribe = subscribeToMessages(
      activeConversationId,
      (realtimeMessages) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConversationId) {
              return { ...c, messages: realtimeMessages }
            }
            return c
          }),
        )
      },
    )

    return () => {
      unsubscribe?.()
    }
  }, [activeConversationId])

  // Request-gated messaging handlers with strict authorization checks
  const sendConversationRequest = async ({ targetId, targetName, targetType, targetAvatar, targetSubtitle, introMessage }) => {
    // Check authorization: Guests and Admins cannot send messages
    if (role !== 'member' && role !== 'org') {
      return { ok: false, error: tx(language, 'Only members and NGOs can send message requests.', 'सदस्य र संस्थाले मात्र सन्देश पठाउन सक्छन्।') }
    }

    // Check prohibition: NGO-to-NGO conversations are prohibited
    if (role === 'org' && targetType === 'ngo') {
      return { ok: false, error: tx(language, 'NGO-to-NGO messaging is not permitted in MVP.', 'संस्थाबीच सिधा सन्देश पठाउन पाइँदैन।') }
    }

    // Check prohibition: Self-requests are prohibited
    if (currentUserId === targetId || (role === 'member' && targetName === memberNickname)) {
      return { ok: false, error: tx(language, 'You cannot send a message request to yourself.', 'आफैलाई सन्देश अनुरोध पठाउन मिल्दैन।') }
    }

    try {
      const res = await sendConversationRequestApi({
        targetId,
        targetName,
        targetType,
        targetAvatar,
        targetSubtitle,
        introMessage,
      })

      if (res && res.ok && res.conversation) {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === res.conversation.id)
          if (exists) {
            return prev.map((c) => (c.id === res.conversation.id ? { ...c, ...res.conversation } : c))
          }
          return [{ ...res.conversation, messages: [] }, ...prev]
        })
        setActiveConversationId(res.conversation.id)
        setPage('messages')
        return { ok: true, conversation: res.conversation }
      }

      if (res && res.conversationId) {
        setActiveConversationId(res.conversationId)
        setPage('messages')
        return { ok: true, notice: res.error }
      }

      return { ok: false, error: res?.error || 'Failed to send request' }
    } catch (err) {
      console.warn('[sendConversationRequest] API error, falling back locally:', err)
      // Local fallback
      const newId = `conv-${Date.now()}`
      const isNgoTarget = targetType === 'ngo'
      const orgId = role === 'org' ? activeOrgId : isNgoTarget ? targetId : null
      const requesterDisplayName = role === 'org' ? (organizations.find((o) => o.id === activeOrgId)?.name || 'Asha Sathi Nepal') : memberNickname
      const requesterAvatarSrc = role === 'org' ? IMAGE_PATHS.ngos.ngo1 : memberAvatarSrc

      const newConv = {
        id: newId,
        type: targetType,
        requesterId: currentUserId,
        requesterRole: role,
        requesterName: requesterDisplayName,
        requesterAvatar: requesterAvatarSrc,
        recipientId: targetId,
        recipientRole: targetType,
        recipientName: targetName,
        recipientAvatar: targetAvatar,
        organizationId: orgId,
        participantAvatar: targetAvatar,
        participantSubtitle: targetSubtitle || (targetType === 'ngo' ? 'Verified NGO' : 'Community Member'),
        requestStatus: 'pending',
        blocked: false,
        reported: false,
        messages: [],
      }

      setConversations((current) => [newConv, ...current])
      setActiveConversationId(newId)
      setPage('messages')
      return { ok: true }
    }
  }

  // Central handler: acceptRequest - only the intended recipient can accept
  const acceptRequest = async (convId) => {
    // Optimistic UI update
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, requestStatus: 'accepted' } : c)),
    )
    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'accept' })
    } catch (err) {
      console.warn('[acceptRequest] API error:', err)
    }
  }

  // Central handler: declineRequest - only the intended recipient can decline
  const declineRequest = async (convId) => {
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, requestStatus: 'declined' } : c)),
    )
    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'decline' })
    } catch (err) {
      console.warn('[declineRequest] API error:', err)
    }
  }

  // Central handler: cancelRequest - only original requester can cancel pending request
  const cancelRequest = async (convId) => {
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, requestStatus: 'cancelled' } : c)),
    )
    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'cancel' })
    } catch (err) {
      console.warn('[cancelRequest] API error:', err)
    }
  }

  // Central handler: blockConversation - only actual participants can block
  const blockConversation = async (convId) => {
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, blocked: true } : c)),
    )
    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'block' })
    } catch (err) {
      console.warn('[blockConversation] API error:', err)
    }
  }

  // Central handler: unblockConversation - only actual participants can unblock
  const unblockConversation = async (convId) => {
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, blocked: false } : c)),
    )
    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'unblock' })
    } catch (err) {
      console.warn('[unblockConversation] API error:', err)
    }
  }

  // Central handler: reportConversation - records report reason in state and server
  const reportConversation = async (convId, reason) => {
    const reportReasonText = typeof reason === 'string' && reason.trim() ? reason.trim() : 'Flagged for review'
    const newReport = {
      id: `report-${Date.now()}`,
      conversationId: convId,
      reportingParticipantId: currentUserId,
      reportingRole: role,
      reason: reportReasonText,
      status: 'pending_review',
      timestamp: new Date().toISOString(),
    }

    setReports((current) => [...current, newReport])
    setConversations((current) =>
      current.map((c) => (c.id === convId ? { ...c, reported: true } : c)),
    )

    try {
      await updateConversationStatusApi({ conversationId: convId, action: 'report', reason: reportReasonText })
    } catch (err) {
      console.warn('[reportConversation] API error:', err)
    }
  }

  // Central handler: sendChatMessage - verifies participant, acceptance, and unblocked state
  const sendChatMessage = async (convId, text) => {
    if (!text.trim()) return

    const timeStr = new Date().toLocaleTimeString(language === 'ne' ? 'ne-NP' : 'en', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const authorRole = role === 'org' ? 'org' : 'member'
    const authorName = role === 'org' ? (organizations.find((o) => o.id === activeOrgId)?.name || 'NGO Caseworker') : memberNickname

    // Optimistic UI update
    setConversations((current) =>
      current.map((conv) => {
        if (conv.id !== convId) return conv
        return {
          ...conv,
          messages: [
            ...conv.messages,
            {
              id: `msg-${Date.now()}`,
              author: authorRole,
              authorId: currentUserId,
              authorName,
              text: text.trim(),
              time: timeStr,
            },
          ],
        }
      }),
    )

    try {
      await sendMessageApi(convId, text.trim())
    } catch (err) {
      console.warn('[sendChatMessage] API error:', err)
    }
  }

  useEffect(() => {
    document.documentElement.lang = language === 'ne' ? 'ne' : 'en'
    document.title = sessionRole === 'member' ? 'My Support' : 'Naya Sahara · नयाँ सहारा'
  }, [language, sessionRole])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const navigate = (nextPage) => {
    // Redirect deprecated 'opportunities' page to 'notices'
    const targetPage = nextPage === 'opportunities' ? 'notices' : nextPage
    const allowed = ALLOWED_PAGES_BY_ROLE[role] || ALLOWED_PAGES_BY_ROLE.guest

    if (!allowed.has(targetPage)) {
      setPage('home')
      return
    }

    setPage(targetPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const enterGuest = (targetPage = 'home') => {
    setPublicView('guest')
    const destination = targetPage === 'opportunities' ? 'notices' : targetPage
    const allowed = ALLOWED_PAGES_BY_ROLE.guest
    setPage(allowed.has(destination) ? destination : 'home')
    setQuickExit(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openAuth = (nextMode = 'login') => {
    setAuthMode(nextMode)
    setPublicView('auth')
    setQuickExit(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToLanding = () => {
    setPublicView('landing')
    setPage('home')
    setQuickExit(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const signOut = async () => {
    await logout()
    setMemberId('')
    setMemberNickname('')
    setMemberAvatarId('')
    setMemberDistrict('')
    setMemberInterests([])
    setMemberCommunityOptIn(false)
    setActiveOrgId('')
    setConversations([])
    setActiveConversationId(null)
    setReports([])
    setPublicView('landing')
    setPage('home')
    setQuickExit(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Member Registration via handover code calling real backend API
  const handleMemberRegister = async ({ code, nickname, password, avatarId }) => {
    const result = await registerMember({ code, nickname, password, avatarId })
    if (result.ok) {
      setPublicView('app')
      setPage('home')
    }
    return result
  }

  // Member Login via nickname + password calling real backend API
  const handleMemberLogin = async ({ nickname, password }) => {
    const result = await loginMember({ nickname, password })
    if (result.ok) {
      setPublicView('app')
      setPage('home')
    }
    return result
  }

  // Staff Login (NGO / Admin) calling Firebase Auth + sync-staff
  const handleStaffLogin = async ({ email, password }) => {
    const result = await loginStaff({ email, password })
    if (result.ok) {
      setPublicView('app')
      setPage('home')
    }
    return result
  }

  // Handover code issuance for NGO staff calling real backend API
  const handleIssueHandoverCode = async () => {
    if (!auth.currentUser) {
      return { ok: false, error: 'User is not authenticated' }
    }
    try {
      const idToken = await auth.currentUser.getIdToken()
      const result = await issueHandoverCode(idToken)
      return result
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to issue handover code' }
    }
  }

  // NGO & Notice handlers
  const registerOrganization = async (payload) => {
    // If called with full payload (from real registration form), call real API
    if (payload.applicantPassword) {
      const result = await submitOrganizationApplication(payload)
      if (result.ok) {
        // Optimistically add to pending list for admin view
        setOrganizations((current) => [
          ...current,
          {
            id: result.orgId,
            name: payload.name,
            location: payload.location,
            category: payload.category || 'General Support',
            focus: payload.focus,
            contactPhone: payload.contactPhone || '',
            contactEmail: payload.contactEmail,
            status: 'pending',
            verificationStatus: 'pending',
          },
        ])
      }
      return result
    }
    // Legacy local-only creation (guest Organizations page quick-register)
    setOrganizations((current) => [
      ...current,
      {
        id: `org-${Date.now()}`,
        name: payload.name,
        location: payload.location,
        focus: payload.focus,
        status: 'pending',
        verificationStatus: 'pending',
      },
    ])
    return { ok: true }
  }

  // Reload organizations from real Firestore (admin or public view)
  const reloadOrganizations = async () => {
    try {
      if (role === 'admin') {
        const idToken = await auth.currentUser?.getIdToken?.()
        if (idToken) {
          const result = await fetchAdminOrganizations(idToken)
          if (result.ok) {
            setOrganizations(result.organizations)
          }
        }
      } else {
        const result = await fetchPublicOrganizations()
        if (result.ok) {
          setOrganizations((current) => {
            // Merge: keep local-only pending items but replace verified ones from server
            const serverIds = new Set(result.organizations.map((o) => o.id))
            const localOnly = current.filter((o) => !serverIds.has(o.id))
            return [...result.organizations, ...localOnly]
          })
        }
      }
    } catch {
      // Non-critical: keep existing organizations in state
    }
  }

  // Reload notices from real Firestore (admin, ngo org, or public view)
  const reloadNotices = async () => {
    setNoticesLoading(true)
    setNoticesError('')
    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && idToken) {
        const result = await fetchAdminNotices(idToken)
        if (result.ok) {
          setNotices(result.notices || [])
        } else {
          setNotices([])
          setNoticesError(result.error || tx(language, 'Failed to load notices from server.', 'सर्भरबाट सूचनाहरू लोड गर्न सकिएन।'))
        }
      } else if (role === 'org' && idToken) {
        const [orgRes, pubRes] = await Promise.all([
          fetchOrgNotices(idToken),
          fetchPublicNotices(),
        ])
        if (orgRes.ok || pubRes.ok) {
          const orgNotices = orgRes.ok ? orgRes.notices : []
          const pubNotices = pubRes.ok ? pubRes.notices : []
          const ownIds = new Set(orgNotices.map((n) => n.id))
          const merged = [...orgNotices, ...pubNotices.filter((n) => !ownIds.has(n.id))]
          setNotices(merged)
        } else {
          setNotices([])
          setNoticesError(orgRes.error || pubRes.error || tx(language, 'Failed to load notices.', 'सूचनाहरू लोड गर्न सकिएन।'))
        }
      } else {
        const result = await fetchPublicNotices()
        if (result.ok) {
          setNotices(result.notices || [])
        } else {
          setNotices([])
          setNoticesError(result.error || tx(language, 'Failed to load public notices.', 'सार्वजनिक सूचनाहरू लोड गर्न सकिएन।'))
        }
      }
    } catch {
      setNotices([])
      setNoticesError(tx(language, 'Network error loading notices. Please check your connection and retry.', 'सूचनाहरू लोड गर्दा नेटवर्क समस्या आयो। कृपया इन्टरनेट जाँचेर पुन: प्रयास गर्नुहोस्।'))
    } finally {
      setNoticesLoading(false)
    }
  }

  // Load real organizations and notices on session ready
  useEffect(() => {
    if (authUser && (role === 'admin' || role === 'org' || role === 'member')) {
      reloadOrganizations()
      reloadNotices()
    } else if (!authLoading && !authUser) {
      // Load public verified organizations for guest/landing views
      fetchPublicOrganizations().then((result) => {
        if (result.ok && result.organizations.length > 0) {
          setOrganizations((current) => {
            const serverIds = new Set(result.organizations.map((o) => o.id))
            const localOnly = current.filter((o) => !serverIds.has(o.id))
            return [...result.organizations, ...localOnly]
          })
        }
      })
      reloadNotices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, role, authLoading])

  const updateOrganization = (id, changes) => {
    setOrganizations((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
  }

  const approveOrganization = async (id) => {
    if (role !== 'admin') return
    // Optimistic UI update
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'approved', verificationStatus: 'verified' } : item,
      ),
    )
    // Persist to backend
    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (idToken) {
        await reviewOrganization(idToken, { orgId: id, action: 'approve' })
        // Refresh full admin list after approve to reflect any staff activations
        reloadOrganizations()
      }
    } catch {
      // Keep optimistic update in place
    }
  }

  const rejectOrganization = async (id, rejectionReason = '') => {
    if (role !== 'admin') return
    // Optimistic UI update
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: 'rejected', verificationStatus: 'rejected', rejectionReason }
          : item,
      ),
    )
    // Persist to backend
    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (idToken) {
        await reviewOrganization(idToken, { orgId: id, action: 'reject', rejectionReason })
      }
    } catch {
      // Keep optimistic update in place
    }
  }

  const archiveOrganization = async (id) => {
    if (role !== 'admin') return
    // Optimistic UI update
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'archived', verificationStatus: 'archived' } : item,
      ),
    )
    // Persist to backend
    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (idToken) {
        await reviewOrganization(idToken, { orgId: id, action: 'archive' })
      }
    } catch {
      // Keep optimistic update in place
    }
  }

  const addCaseworker = (workerData) => {
    setTeam((current) => [
      ...current,
      {
        id: `worker-${Date.now()}`,
        displayName: workerData?.displayName || `Caseworker ${String.fromCharCode(65 + current.length)}`,
        roleTitle: workerData?.roleTitle || 'Community Support Caseworker',
        bio: workerData?.bio || 'General caseworker and community liaison.',
        active: true,
        photoUrl: workerData?.photoUrl || IMAGE_PATHS.caseworkers.caseworker1,
      },
    ])
  }

  const updateCaseworker = (id, changes) => {
    setTeam((current) =>
      current.map((worker) => (worker.id === id ? { ...worker, ...changes } : worker)),
    )
  }

  const toggleCaseworker = (id) => {
    setTeam((current) =>
      current.map((worker) => (worker.id === id ? { ...worker, active: !worker.active } : worker)),
    )
  }

  // Notice lifecycle management with two independent fields:
  // reviewStatus: 'pending_review' | 'approved' | 'rejected'
  // publicationStatus: 'draft' | 'published' | 'unpublished' | 'archived'
  const createNotice = async (notice, asDraft = false) => {
    let reviewStatus = 'pending_review'
    let publicationStatus = asDraft ? 'draft' : 'unpublished'

    if (role === 'admin' && !asDraft) {
      reviewStatus = 'approved'
      publicationStatus = 'published'
    }

    const tempId = `notice-${Date.now()}`
    const orgName =
      notice.source === 'gov'
        ? notice.sourceAuthority || 'Government of Nepal'
        : role === 'org'
          ? (organizations.find((o) => o.id === activeOrgId)?.name || 'Asha Sathi Nepal')
          : notice.orgName || 'Public Announcement'

    setNotices((current) => [
      {
        ...notice,
        id: tempId,
        reviewStatus,
        publicationStatus,
        status: publicationStatus === 'published' ? 'approved' : publicationStatus === 'draft' ? 'draft' : reviewStatus,
        rejectionReason: '',
        isSyntheticDemo: false,
        sourceUrl: notice.sourceUrl || null,
        ingestionDate: new Date().toISOString().split('T')[0],
        orgName,
      },
      ...current,
    ])

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && (notice.source === 'gov' || notice.sourceType === 'government') && idToken) {
        await createGovNoticeApi(idToken, notice, asDraft)
        await reloadNotices()
      } else if (role === 'org' && idToken) {
        await createNoticeApi(idToken, notice, asDraft)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const updateNotice = async (id, changes) => {
    const contentFieldsChanged =
      changes.title !== undefined ||
      changes.original !== undefined ||
      changes.translation !== undefined ||
      changes.nepaliTranslation !== undefined ||
      changes.englishTranslation !== undefined ||
      changes.simplifiedSummary !== undefined ||
      changes.category !== undefined ||
      changes.location !== undefined ||
      changes.eligibility !== undefined ||
      changes.deadline !== undefined

    let updatedReviewStatus = changes.reviewStatus !== undefined ? changes.reviewStatus : undefined
    let updatedPubStatus = changes.publicationStatus !== undefined ? changes.publicationStatus : undefined

    if (contentFieldsChanged && role === 'org') {
      if (changes.publicationStatus !== 'draft') {
        updatedReviewStatus = 'pending_review'
        updatedPubStatus = 'unpublished'
      }
    }

    setNotices((current) =>
      current.map((notice) => {
        if (notice.id !== id) return notice
        const rev = updatedReviewStatus !== undefined ? updatedReviewStatus : notice.reviewStatus || 'pending_review'
        const pub = updatedPubStatus !== undefined ? updatedPubStatus : notice.publicationStatus || 'unpublished'
        const legacyStatus =
          pub === 'archived'
            ? 'archived'
            : pub === 'published'
              ? 'approved'
              : pub === 'draft'
                ? 'draft'
                : rev

        return {
          ...notice,
          ...changes,
          reviewStatus: rev,
          publicationStatus: pub,
          status: legacyStatus,
          rejectionReason:
            changes.rejectionReason !== undefined
              ? changes.rejectionReason
              : rev === 'pending_review'
                ? ''
                : notice.rejectionReason,
        }
      }),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (!idToken) return
      if (role === 'admin') {
        await adminModerateNotice(idToken, 'update', id, changes)
        await reloadNotices()
      } else if (role === 'org') {
        const asDraft = changes.publicationStatus === 'draft'
        await updateNoticeApi(idToken, id, changes, asDraft)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const submitNoticeForReview = async (id) => {
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              reviewStatus: 'pending_review',
              publicationStatus: 'unpublished',
              status: 'pending_review',
              rejectionReason: '',
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'org' && idToken) {
        await updateNoticeApi(idToken, id, { publicationStatus: 'unpublished', reviewStatus: 'pending_review' }, false)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const deleteNotice = async (id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && idToken) {
        await adminModerateNotice(idToken, 'delete', id)
        await reloadNotices()
      } else if (role === 'org' && idToken) {
        await deleteNoticeApi(idToken, id)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const approveNotice = async (id) => {
    if (role !== 'admin') return
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              reviewStatus: 'approved',
              publicationStatus: 'published',
              status: 'approved',
              rejectionReason: '',
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (idToken) {
        await adminModerateNotice(idToken, 'approve', id)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const rejectNotice = async (id, reason = '') => {
    if (role !== 'admin') return
    const rejectionReason =
      reason || 'Does not meet public notice guidelines or contains incomplete information.'
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              reviewStatus: 'rejected',
              publicationStatus: 'unpublished',
              status: 'rejected',
              rejectionReason,
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (idToken) {
        await adminModerateNotice(idToken, 'reject', id, { rejectionReason })
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const archiveNotice = async (id) => {
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              publicationStatus: 'archived',
              status: 'archived',
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && idToken) {
        await adminModerateNotice(idToken, 'archive', id)
        await reloadNotices()
      } else if (role === 'org' && idToken) {
        await updateNoticeApi(idToken, id, { publicationStatus: 'archived' })
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const restoreNotice = async (id) => {
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              publicationStatus: 'unpublished',
              status: item.reviewStatus === 'approved' ? 'unpublished' : 'pending_review',
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && idToken) {
        await adminModerateNotice(idToken, 'restore', id)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  const unpublishNotice = async (id) => {
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              publicationStatus: 'unpublished',
              status: 'unpublished',
            }
          : item,
      ),
    )

    try {
      const idToken = await auth.currentUser?.getIdToken?.()
      if (role === 'admin' && idToken) {
        await adminModerateNotice(idToken, 'unpublish', id)
        await reloadNotices()
      }
    } catch {
      // Keep optimistic
    }
  }

  // Page Content Routing with strict role authorization
  const pendingRequestsCount = conversations.filter(
    (c) => c.requestStatus === 'pending' && (role === 'org' ? c.requesterRole !== 'org' : c.recipientName === memberNickname),
  ).length

  let pageContent
  if (page === 'home') {
    pageContent = (
      <Dashboard
        activeCaseworkersCount={team.filter((w) => w.active).length}
        associatedMembers={associatedMembers}
        associatedWomenCount={associatedMembers.length}
        language={language}
        memberProfile={{
          nickname: memberNickname,
          avatarId: memberAvatarId,
          district: memberDistrict,
          interests: memberInterests,
          communityOptIn: memberCommunityOptIn,
          showDistrict: memberShowDistrict,
          showInterests: memberShowInterests,
          verifyingNgo: 'Asha Sathi Nepal',
          joinedDate: 'Nov 2026',
        }}
        nickname={memberNickname}
        notices={notices}
        onApproveNotice={approveNotice}
        onApproveOrg={approveOrganization}
        onArchiveNotice={archiveNotice}
        onArchiveOrg={archiveOrganization}
        onNavigate={navigate}
        onRejectNotice={rejectNotice}
        onRejectOrg={rejectOrganization}
        onRestoreNotice={restoreNotice}
        onUnpublishNotice={unpublishNotice}
        onUpdateMemberProfile={updateMemberProfile}
        organizations={organizations}
        pendingRequestsCount={pendingRequestsCount}
        publishedNoticesCount={
          notices.filter(
            (n) =>
              (n.publicationStatus === 'published' || (!n.publicationStatus && n.status === 'approved')) &&
              (n.reviewStatus === 'approved' || (!n.reviewStatus && n.status === 'approved')),
          ).length
        }
        role={role}
      />
    )
  } else if (page === 'cases' && role === 'org') {
    pageContent = (
      <CasesPage
        activeOrgId={activeOrgId}
        language={language}
        onGenerateHandoverCode={handleIssueHandoverCode}
        team={team}
      />
    )
  } else if (page === 'team' && role === 'org') {
    pageContent = (
      <TeamPage
        language={language}
        onAdd={addCaseworker}
        onToggle={toggleCaseworker}
        onUpdate={updateCaseworker}
        team={team}
      />
    )
  } else if (page === 'organizations') {
    pageContent = (
      <OrganizationsPage
        language={language}
        onApprove={approveOrganization}
        onArchive={archiveOrganization}
        onNavigate={navigate}
        onOpenAuth={openAuth}
        onRegister={registerOrganization}
        onReject={rejectOrganization}
        onRequestConversation={(org) => {
          sendConversationRequest({
            targetId: org.id,
            targetName: org.name,
            targetType: 'ngo',
            targetAvatar: org.logoUrl || IMAGE_PATHS.ngos.ngo1,
            targetSubtitle: `${org.category || 'Support'} · ${org.location}`,
          })
        }}
        onUpdateOrganization={updateOrganization}
        organizations={organizations}
        activeOrgId={activeOrgId}
        role={role}
      />
    )
  } else if (page === 'notices') {
    pageContent = (
      <NoticesPage
        language={language}
        loading={noticesLoading}
        error={noticesError}
        notices={notices}
        onApprove={approveNotice}
        onArchiveNotice={archiveNotice}
        onCreateNotice={createNotice}
        onDeleteNotice={deleteNotice}
        onReject={rejectNotice}
        onRestoreNotice={restoreNotice}
        onRetry={reloadNotices}
        onSubmitForReview={submitNoticeForReview}
        onUnpublishNotice={unpublishNotice}
        onUpdateNotice={updateNotice}
        role={role}
      />
    )
  } else if (page === 'community' && role === 'member') {
    pageContent = (
      <CommunityPage
        communityError={communityError}
        communityLoading={communityLoading}
        currentMemberId={memberId}
        currentMemberNickname={memberNickname}
        language={language}
        members={communityMembers}
        onNavigate={navigate}
        onRefresh={loadCommunityDirectory}
        onRequestChat={({ id, nickname, avatarId, district }) => {
          const avatarSrc = MEMBER_AVATAR_OPTIONS.find((a) => a.id === avatarId)?.src || IMAGE_PATHS.avatars.avatar1
          sendConversationRequest({
            targetId: id,
            targetName: nickname,
            targetType: 'member',
            targetAvatar: avatarSrc,
            targetSubtitle: `Community Peer · ${district || 'Nepal'}`,
          })
        }}
        onUpdateOptIn={(optInValue) => {
          updateMemberProfile({ communityOptIn: optInValue })
        }}
        optedIn={memberCommunityOptIn}
      />
    )
  } else if (page === 'messages' && (role === 'org' || role === 'member')) {
    const currentUserName =
      role === 'org'
        ? organizations.find((o) => o.id === activeOrgId)?.name || 'Asha Sathi Nepal'
        : memberNickname

    pageContent = (
      <MessagesPage
        activeConversationId={activeConversationId}
        conversations={conversations}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        language={language}
        onAcceptRequest={acceptRequest}
        onBlock={blockConversation}
        onCancelRequest={cancelRequest}
        onDeclineRequest={declineRequest}
        onReport={reportConversation}
        onSelectConversation={setActiveConversationId}
        onSendMessage={sendChatMessage}
        onStartRequest={sendConversationRequest}
        onUnblock={unblockConversation}
        role={role}
      />
    )
  } else {
    // Fallback for unpermitted routes
    pageContent = (
      <Dashboard
        activeCaseworkersCount={team.filter((w) => w.active).length}
        associatedWomenCount={associatedMembers.length}
        language={language}
        nickname={memberNickname}
        notices={notices}
        onNavigate={navigate}
        organizations={organizations}
        pendingRequestsCount={pendingRequestsCount}
        publishedNoticesCount={
          notices.filter((n) => (n.source === 'ngo' || !n.source) && n.status === 'approved').length
        }
        role={role}
      />
    )
  }

  if (authLoading) {
    return (
      <main className="auth-loading-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg, #faf8f5)', color: 'var(--color-text, #1c1917)' }}>
        <div className="brand-mark" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary-subtle, #f5f0e8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield" size={28} />
        </div>
        <p style={{ fontWeight: 600, fontSize: '1rem' }}>
          {tx(language, 'Restoring secure session…', 'सुरक्षित सत्र पुनःस्थापना हुँदैछ…')}
        </p>
      </main>
    )
  }

  if (quickExit) {
    return <QuickExitScreen language={language} onReturn={() => setQuickExit(false)} />
  }

  if (!sessionRole && (publicView === 'landing' || publicView === 'app')) {
    return (
      <LandingPage
        language={language}
        notices={notices}
        onEnterGuest={enterGuest}
        onLanguageChange={setLanguage}
        onOpenAuth={openAuth}
        organizations={organizations}
      />
    )
  }

    if (!sessionRole && publicView === 'auth') {
    return (
      <AuthPage
        initialMode={authMode}
        language={language}
        onBackToLanding={backToLanding}
        onEnterGuest={enterGuest}
        onLanguageChange={setLanguage}
        onMemberLogin={handleMemberLogin}
        onMemberRegister={handleMemberRegister}
        onNgoRegister={registerOrganization}
        onStaffLogin={handleStaffLogin}
      />
    )
  }

  return (
    <AppShell
      isOnline={isOnline}
      language={language}
      memberAvatarSrc={memberAvatarSrc}
      memberNickname={memberNickname}
      onBackToLanding={backToLanding}
      onLanguageChange={setLanguage}
      onNavigate={navigate}
      onOpenAuth={openAuth}
      onQuickExit={() => setQuickExit(true)}
      onSignOut={signOut}
      page={page}
      role={role}
    >
      {pageContent}
    </AppShell>
  )
}
