import { useEffect, useState } from 'react'
import AppShell from './components/AppShell.jsx'
import { Button, Icon } from './components/ui.jsx'
import { IMAGE_PATHS, MEMBER_AVATAR_OPTIONS } from './config/images.js'
import { tx } from './i18n.js'
import {
  initialAssociatedMembers,
  initialNotices,
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
  const [publicView, setPublicView] = useState('landing') // 'landing' | 'auth' | 'app' | 'guest'
  const [authMode, setAuthMode] = useState('login')
  const [sessionRole, setSessionRole] = useState(null) // null | 'member' | 'org' | 'admin'
  const [page, setPage] = useState('home')
  const [language, setLanguage] = useState('ne')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [quickExit, setQuickExit] = useState(false)

  // Demo synthetic data
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [notices, setNotices] = useState(initialNotices)
  const [associatedMembers, setAssociatedMembers] = useState(initialAssociatedMembers)
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

  // Handover codes with status tracking
  const [handoverCodes, setHandoverCodes] = useState([
    {
      code: 'NS-240001',
      issuedAt: 'Today',
      expiresAt: '72 hours from issue',
      status: 'available',
    },
    {
      code: 'NS-110042',
      issuedAt: 'Yesterday',
      expiresAt: 'Used / Registered',
      status: 'used',
      usedBy: 'Prakriti',
    },
  ])

  // Demo member authentication state with stable IDs
  const [memberId, setMemberId] = useState('mem-1')
  const [memberNickname, setMemberNickname] = useState('Sajilo')
  const [memberAvatarId, setMemberAvatarId] = useState('avatar1')
  const [memberDistrict, setMemberDistrict] = useState('Lalitpur')
  const [memberInterests, setMemberInterests] = useState(['Tailoring', 'Handicrafts'])
  const [memberCommunityOptIn, setMemberCommunityOptIn] = useState(true)
  const [memberShowDistrict, setMemberShowDistrict] = useState(true)
  const [memberShowInterests, setMemberShowInterests] = useState(true)
  const [demoMembers, setDemoMembers] = useState([
    { id: 'mem-1', nickname: 'Sajilo', password: 'demo-member-password', avatarId: 'avatar1' },
    { id: 'mem-2', nickname: 'Prakriti', password: 'demo-member-password', avatarId: 'avatar2' },
  ])

  // Active NGO organization state for staff sessions
  const [activeOrgId, setActiveOrgId] = useState('org-asha')

  // Reports state for retaining report reasons in demonstration
  const [_reports, setReports] = useState([])

  // Member profile update handler
  const updateMemberProfile = ({
    nickname,
    avatarId,
    district,
    interests,
    communityOptIn,
    showDistrict,
    showInterests,
  }) => {
    if (nickname && nickname.trim()) {
      setMemberNickname(nickname.trim())
    }
    if (avatarId) {
      setMemberAvatarId(avatarId)
    }
    if (district !== undefined) {
      setMemberDistrict(district)
    }
    if (interests !== undefined) {
      setMemberInterests(interests)
    }
    if (communityOptIn !== undefined) {
      setMemberCommunityOptIn(communityOptIn)
    }
    if (showDistrict !== undefined) {
      setMemberShowDistrict(showDistrict)
    }
    if (showInterests !== undefined) {
      setMemberShowInterests(showInterests)
    }

    // Keep associatedMembers roster in sync so community directory updates immediately
    setAssociatedMembers((current) =>
      current.map((mem) =>
        mem.id === memberId || mem.nickname === memberNickname
          ? {
              ...mem,
              nickname: nickname ? nickname.trim() : mem.nickname,
              avatarId: avatarId || mem.avatarId,
              district: district !== undefined ? district : mem.district,
              interests: interests !== undefined ? interests : mem.interests,
              communityOptIn: communityOptIn !== undefined ? communityOptIn : mem.communityOptIn,
            }
          : mem,
      ),
    )
  }

  // Messaging state (text-only MVP supporting Woman <-> Woman and Woman <-> NGO with explicit stable IDs)
  const [conversations, setConversations] = useState([
    {
      id: 'conv-asha',
      type: 'ngo', // 'ngo' | 'member'
      requesterId: 'mem-1',
      requesterRole: 'member',
      requesterName: 'Sajilo',
      requesterAvatar: IMAGE_PATHS.avatars.avatar1,
      recipientId: 'org-asha',
      recipientRole: 'org',
      recipientName: 'Asha Sathi Nepal',
      recipientAvatar: IMAGE_PATHS.ngos.ngo1,
      organizationId: 'org-asha',
      participantAvatar: IMAGE_PATHS.ngos.ngo1,
      participantSubtitle: 'Verifying Support NGO · Lalitpur',
      requestStatus: 'accepted', // 'none' | 'pending' | 'accepted' | 'declined'
      blocked: false,
      reported: false,
      messages: [
        {
          id: 'msg-1',
          author: 'org',
          authorId: 'org-asha',
          authorName: 'Asha Sathi Nepal',
          text: 'Namaste Sajilo, welcome to Naya Sahara. How can our team support you today?',
          time: '10:30 AM',
        },
      ],
    },
    {
      id: 'conv-prakriti',
      type: 'member',
      requesterId: 'mem-2',
      requesterRole: 'member',
      requesterName: 'Prakriti',
      requesterAvatar: IMAGE_PATHS.avatars.avatar2,
      recipientId: 'mem-1',
      recipientRole: 'member',
      recipientName: 'Sajilo',
      recipientAvatar: IMAGE_PATHS.avatars.avatar1,
      organizationId: null,
      participantAvatar: IMAGE_PATHS.avatars.avatar2,
      participantSubtitle: 'Community Peer · Kathmandu',
      requestStatus: 'pending',
      blocked: false,
      reported: false,
      messages: [],
    },
  ])

  const [activeConversationId, setActiveConversationId] = useState('conv-asha')

  // Helper to get active session user ID, role, and avatar
  const role = sessionRole || 'guest'
  const currentUserId = role === 'org' ? activeOrgId : role === 'member' ? memberId : null
  const memberAvatarSrc =
    MEMBER_AVATAR_OPTIONS.find((item) => item.id === memberAvatarId)?.src || IMAGE_PATHS.avatars.avatar1

  // Request-gated messaging handlers with strict authorization checks
  const sendConversationRequest = ({ targetId, targetName, targetType, targetAvatar, targetSubtitle }) => {
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

    // Check if conversation already exists by participant IDs
    const existing = conversations.find((c) => {
      const isParticipantMatch =
        (c.requesterId === currentUserId && c.recipientId === targetId) ||
        (c.requesterId === targetId && c.recipientId === currentUserId)
      return isParticipantMatch
    })

    if (existing) {
      if (existing.blocked) {
        return { ok: false, error: tx(language, 'This contact is currently blocked.', 'यो सम्पर्क हाल रोकिएको छ।') }
      }
      if (existing.requestStatus === 'pending') {
        setActiveConversationId(existing.id)
        setPage('messages')
        return { ok: true, notice: tx(language, 'A request is already pending.', 'अनुरोध पहिले नै विचाराधीन छ।') }
      }
      if (existing.requestStatus === 'accepted') {
        setActiveConversationId(existing.id)
        setPage('messages')
        return { ok: true }
      }
      // If declined previously, reset to pending
      setConversations((current) =>
        current.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                requestStatus: 'pending',
                requesterId: currentUserId,
                requesterRole: role,
                requesterName: role === 'org' ? (organizations.find((o) => o.id === activeOrgId)?.name || 'NGO') : memberNickname,
                recipientId: targetId,
                recipientRole: targetType,
                recipientName: targetName,
              }
            : c,
        ),
      )
      setActiveConversationId(existing.id)
      setPage('messages')
      return { ok: true }
    }

    // Create new pending conversation with explicit participant IDs
    const newId = `conv-${Date.now()}`
    const isNgoTarget = targetType === 'ngo'
    const orgId = role === 'org' ? activeOrgId : isNgoTarget ? targetId : null
    const requesterDisplayName = role === 'org' ? (organizations.find((o) => o.id === activeOrgId)?.name || 'Asha Sathi Nepal') : memberNickname
    const requesterAvatarSrc = role === 'org' ? (IMAGE_PATHS.ngos.ngo1) : memberAvatarSrc

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

  // Central handler: acceptRequest - only the intended recipient can accept
  const acceptRequest = (convId) => {
    setConversations((current) =>
      current.map((c) => {
        if (c.id !== convId) return c
        // Authorization check: Only the intended recipient can accept
        const isRecipient = c.recipientId === currentUserId
        if (!isRecipient) return c
        return { ...c, requestStatus: 'accepted' }
      }),
    )
  }

  // Central handler: declineRequest - only the intended recipient can decline
  const declineRequest = (convId) => {
    setConversations((current) =>
      current.map((c) => {
        if (c.id !== convId) return c
        // Authorization check: Only the intended recipient can decline
        const isRecipient = c.recipientId === currentUserId
        if (!isRecipient) return c
        return { ...c, requestStatus: 'declined' }
      }),
    )
  }

  // Central handler: blockConversation - only actual participants can block
  const blockConversation = (convId) => {
    setConversations((current) =>
      current.map((c) => {
        if (c.id !== convId) return c
        // Authorization check: must be a participant
        const isParticipant = c.requesterId === currentUserId || c.recipientId === currentUserId
        if (!isParticipant) return c
        return { ...c, blocked: true }
      }),
    )
  }

  // Central handler: unblockConversation - only actual participants can unblock
  // IMPORTANT: unblocking preserves the underlying requestStatus (does NOT make a declined or pending request accepted)
  const unblockConversation = (convId) => {
    setConversations((current) =>
      current.map((c) => {
        if (c.id !== convId) return c
        // Authorization check: must be a participant
        const isParticipant = c.requesterId === currentUserId || c.recipientId === currentUserId
        if (!isParticipant) return c
        return { ...c, blocked: false }
      }),
    )
  }

  // Central handler: reportConversation - records report reason in state with metadata
  const reportConversation = (convId, reason) => {
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
      current.map((c) => {
        if (c.id !== convId) return c
        const isParticipant = c.requesterId === currentUserId || c.recipientId === currentUserId
        if (!isParticipant) return c
        return { ...c, reported: true }
      }),
    )
  }

  // Central handler: sendChatMessage - verifies participant, acceptance, and unblocked state
  const sendChatMessage = (convId, text) => {
    if (!text.trim()) return

    const timeStr = new Date().toLocaleTimeString(language === 'ne' ? 'ne-NP' : 'en', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const authorRole = role === 'org' ? 'org' : 'member'
    const authorName = role === 'org' ? (organizations.find((o) => o.id === activeOrgId)?.name || 'NGO Caseworker') : memberNickname

    setConversations((current) =>
      current.map((conv) => {
        if (conv.id !== convId) return conv

        // Authorization check: User MUST be an actual participant
        const isParticipant = conv.requesterId === currentUserId || conv.recipientId === currentUserId
        if (!isParticipant) return conv

        // Status check: Must be accepted and NOT blocked
        if (conv.blocked || conv.requestStatus !== 'accepted') return conv

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
    setSessionRole(null)
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

  const signOut = () => {
    setSessionRole(null)
    setPublicView('landing')
    setPage('home')
    setQuickExit(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Member Registration via handover code
  const handleMemberRegister = ({ code, nickname, password, avatarId }) => {
    const codeEntry = handoverCodes.find(
      (item) => item.code.toUpperCase() === code.trim().toUpperCase() && item.status === 'available',
    )

    if (!codeEntry) {
      return {
        ok: false,
        error: tx(
          language,
          'Invalid or already used handover code. In this frontend demo, try NS-240001 or generate a new code from the NGO dashboard.',
          'अमान्य वा प्रयोग भइसकेको हस्तान्तरण कोड। यस डेमोमा NS-240001 प्रयोग गर्नुहोस् वा संस्था ड्यासबोर्डबाट नयाँ कोड जारी गर्नुहोस्।',
        ),
      }
    }

    const exists = demoMembers.some((member) => member.nickname.toLowerCase() === nickname.toLowerCase())
    if (exists) {
      return {
        ok: false,
        error: tx(
          language,
          'That nickname is already taken. Choose another nickname.',
          'यो उपनाम पहिले नै प्रयोगमा छ। अर्को उपनाम छान्नुहोस्।',
        ),
      }
    }

    // Mark code as used
    setHandoverCodes((current) =>
      current.map((item) =>
        item.code.toUpperCase() === code.trim().toUpperCase()
          ? { ...item, status: 'used', usedBy: nickname }
          : item,
      ),
    )

    // Add newly registered woman to associated members roster
    const newMemberId = `mem-${Date.now()}`
    setAssociatedMembers((current) => [
      {
        id: newMemberId,
        nickname,
        avatarId,
        joinedDate: 'Just now',
        status: 'Active',
        district: 'Lalitpur',
        interests: ['Community Support'],
        communityOptIn: true,
      },
      ...current,
    ])

    setDemoMembers((current) => [...current, { id: newMemberId, nickname, password, avatarId }])
    setMemberId(newMemberId)
    setMemberNickname(nickname)
    setMemberAvatarId(avatarId)
    setSessionRole('member')
    setPublicView('app')
    setPage('home')
    return { ok: true }
  }

  // Member Login via nickname + password
  const handleMemberLogin = ({ nickname, password, preview = false }) => {
    const found = demoMembers.find(
      (member) =>
        member.nickname.toLowerCase() === nickname.toLowerCase() &&
        (preview || member.password === password),
    )

    if (!found && !preview) {
      return {
        ok: false,
        error: tx(
          language,
          'Invalid nickname or password. Use the demo preview button or register with NS-240001.',
          'गलत उपनाम वा पासवर्ड। डेमो पूर्वावलोकन बटन वा NS-240001 कोडबाट दर्ता गर्नुहोस्।',
        ),
      }
    }

    const resolvedId = found?.id || 'mem-1'
    setMemberId(resolvedId)
    setMemberNickname(found?.nickname || nickname)
    setMemberAvatarId(found?.avatarId || 'avatar1')
    setSessionRole('member')
    setPublicView('app')
    setPage('home')
    return { ok: true }
  }

  // Staff Login (NGO / Admin)
  const handleStaffLogin = ({ email, previewRole }) => {
    const targetRole = previewRole || (email.toLowerCase().includes('admin') ? 'admin' : 'org')
    setSessionRole(targetRole)
    if (targetRole === 'org') {
      const lowerEmail = (email || '').toLowerCase()
      if (lowerEmail.includes('samjhana')) {
        setActiveOrgId('org-samjhana')
      } else if (lowerEmail.includes('ujjwal')) {
        setActiveOrgId('org-ujjwal')
      } else {
        setActiveOrgId('org-asha')
      }
    }
    setPublicView('app')
    setPage('home')
    return { ok: true }
  }

  // Handover code generator for NGO
  const generateHandoverCode = () => {
    const code = `NS-${Math.floor(100000 + Math.random() * 900000)}`
    setHandoverCodes((current) => [
      {
        code,
        issuedAt: 'Just now',
        expiresAt: '72 hours from issue',
        status: 'available',
      },
      ...current,
    ])
    return code
  }

  // NGO & Notice handlers
  const registerOrganization = ({ name, location, focus }) => {
    setOrganizations((current) => [
      ...current,
      {
        id: `org-${Date.now()}`,
        name,
        location,
        focus,
        status: 'pending',
      },
    ])
  }

  const updateOrganization = (id, changes) => {
    setOrganizations((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
  }

  const approveOrganization = (id) => {
    if (role !== 'admin') return
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'approved', verificationStatus: 'verified' } : item,
      ),
    )
  }

  const rejectOrganization = (id) => {
    if (role !== 'admin') return
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'rejected', verificationStatus: 'rejected' } : item,
      ),
    )
  }

  const archiveOrganization = (id) => {
    if (role !== 'admin') return
    setOrganizations((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'archived', verificationStatus: 'archived' } : item,
      ),
    )
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
  const createNotice = (notice, asDraft = false) => {
    let reviewStatus = 'pending_review'
    let publicationStatus = asDraft ? 'draft' : 'unpublished'

    if (role === 'admin' && !asDraft) {
      reviewStatus = 'approved'
      publicationStatus = 'published'
    }

    setNotices((current) => [
      {
        ...notice,
        id: `notice-${Date.now()}`,
        reviewStatus,
        publicationStatus,
        status: publicationStatus === 'published' ? 'approved' : publicationStatus === 'draft' ? 'draft' : reviewStatus,
        rejectionReason: '',
        isSyntheticDemo: true,
        sourceUrl: notice.sourceUrl || null,
        ingestionDate: new Date().toISOString().split('T')[0],
        orgName:
          notice.source === 'gov'
            ? notice.orgName || 'Government of Nepal (Demo attribution)'
            : role === 'org'
              ? 'Asha Sathi Nepal'
              : notice.orgName || 'Public Announcement',
      },
      ...current,
    ])
  }

  const updateNotice = (id, changes) => {
    setNotices((current) =>
      current.map((notice) => {
        if (notice.id !== id) return notice

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

        let updatedReviewStatus = changes.reviewStatus !== undefined ? changes.reviewStatus : notice.reviewStatus || 'pending_review'
        let updatedPubStatus = changes.publicationStatus !== undefined ? changes.publicationStatus : notice.publicationStatus || 'unpublished'

        // Rule: If an NGO edits an approved or published notice,
        // changes must return to review (pending_review) and become unpublished until approved again.
        if (contentFieldsChanged && role === 'org') {
          if (changes.publicationStatus !== 'draft') {
            updatedReviewStatus = 'pending_review'
            updatedPubStatus = 'unpublished'
          }
        }

        const legacyStatus =
          updatedPubStatus === 'archived'
            ? 'archived'
            : updatedPubStatus === 'published'
              ? 'approved'
              : updatedPubStatus === 'draft'
                ? 'draft'
                : updatedReviewStatus

        return {
          ...notice,
          ...changes,
          reviewStatus: updatedReviewStatus,
          publicationStatus: updatedPubStatus,
          status: legacyStatus,
          rejectionReason:
            changes.rejectionReason !== undefined
              ? changes.rejectionReason
              : updatedReviewStatus === 'pending_review'
                ? ''
                : notice.rejectionReason,
        }
      }),
    )
  }

  const submitNoticeForReview = (id) => {
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
  }

  const deleteNotice = (id) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }

  const approveNotice = (id) => {
    // Only admin can approve notices
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
  }

  const rejectNotice = (id, reason = '') => {
    // Only admin can reject notices; mandatory reason
    if (role !== 'admin') return
    setNotices((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              reviewStatus: 'rejected',
              publicationStatus: 'unpublished',
              status: 'rejected',
              rejectionReason:
                reason ||
                'Does not meet public notice guidelines or contains incomplete information.',
            }
          : item,
      ),
    )
  }

  const archiveNotice = (id) => {
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
  }

  const restoreNotice = (id) => {
    // Restoring returns to draft or unpublished, NEVER automatically published
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
  }

  const unpublishNotice = (id) => {
    // Unpublishing removes from public and member visibility
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
        associatedMembers={associatedMembers}
        handoverCodes={handoverCodes}
        language={language}
        onGenerateHandoverCode={generateHandoverCode}
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
        role={role}
      />
    )
  } else if (page === 'notices') {
    pageContent = (
      <NoticesPage
        language={language}
        notices={notices}
        onApprove={approveNotice}
        onArchiveNotice={archiveNotice}
        onCreateNotice={createNotice}
        onDeleteNotice={deleteNotice}
        onReject={rejectNotice}
        onRestoreNotice={restoreNotice}
        onSubmitForReview={submitNoticeForReview}
        onUnpublishNotice={unpublishNotice}
        onUpdateNotice={updateNotice}
        role={role}
      />
    )
  } else if (page === 'community' && role === 'member') {
    pageContent = (
      <CommunityPage
        currentMemberNickname={memberNickname}
        language={language}
        members={associatedMembers}
        onNavigate={navigate}
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

  if (quickExit) {
    return <QuickExitScreen language={language} onReturn={() => setQuickExit(false)} />
  }

  if (!sessionRole && publicView === 'landing') {
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
