import { useState, useEffect, useCallback } from 'react'
import { AssetImage, Badge, Button, Card, Field, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS, MEMBER_AVATAR_OPTIONS } from '../config/images.js'
import { tx } from '../i18n.js'
import { auth } from '../firebase/config.js'
import { fetchAssociatedMembers } from '../services/ngoService.js'
import {
  fetchCases,
  createCaseApi,
  updateCaseApi,
  fetchCaseNotesApi,
  addCaseNoteApi,
} from '../services/caseService.js'

const CASE_CATEGORIES = [
  'Reintegration',
  'Livelihood & Skills',
  'Legal Support',
  'Health & Wellbeing',
  'Emergency Shelter',
  'Family Counseling',
  'General Support',
]

const CASE_STATUSES = ['all', 'open', 'in_progress', 'on_hold', 'resolved', 'closed']

function getStatusBadge(status, language) {
  switch (status) {
    case 'open':
      return <Badge dot tone="peach">{tx(language, 'Open', 'खुला')}</Badge>
    case 'in_progress':
      return <Badge dot tone="lavender">{tx(language, 'In Progress', 'प्रक्रियामा')}</Badge>
    case 'on_hold':
      return <Badge dot tone="neutral">{tx(language, 'On Hold', 'स्थगित')}</Badge>
    case 'resolved':
      return <Badge dot tone="mint">{tx(language, 'Resolved', 'समाधान भएको')}</Badge>
    case 'closed':
      return <Badge dot tone="green">{tx(language, 'Closed', 'सकिएको')}</Badge>
    default:
      return <Badge dot tone="neutral">{status}</Badge>
  }
}

function getPriorityBadge(priority, language) {
  switch (priority) {
    case 'urgent':
      return <Badge dot tone="rose">{tx(language, 'Urgent', 'अति जरुरी')}</Badge>
    case 'high':
      return <Badge dot tone="peach">{tx(language, 'High', 'उच्च')}</Badge>
    case 'medium':
      return <Badge dot tone="lavender">{tx(language, 'Medium', 'मध्यम')}</Badge>
    case 'low':
      return <Badge dot tone="neutral">{tx(language, 'Low', 'सामान्य')}</Badge>
    default:
      return <Badge dot tone="neutral">{priority}</Badge>
  }
}

function CaseCreateModal({
  open,
  onClose,
  members = [],
  team = [],
  onSubmit,
  language,
}) {
  const [memberId, setMemberId] = useState('')
  const [caseTitle, setCaseTitle] = useState('')
  const [category, setCategory] = useState('Reintegration')
  const [priority, setPriority] = useState('medium')
  const [assignedStaffId, setAssignedStaffId] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setMemberId(members[0]?.id || '')
      setCaseTitle('')
      setCategory('Reintegration')
      setPriority('medium')
      setAssignedStaffId(team[0]?.id || '')
      setDescription('')
      setError('')
      setSubmitting(false)
    }
  }, [open, members, team])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!memberId) {
      setError(tx(language, 'Please select an associated member.', 'कृपया सम्बद्ध सदस्य चयन गर्नुहोस्।'))
      return
    }
    if (!caseTitle.trim()) {
      setError(tx(language, 'Case title is required.', 'मामिलाको शीर्षक अनिवार्य छ।'))
      return
    }

    setSubmitting(true)
    setError('')

    const assignedStaff = team.find((w) => w.id === assignedStaffId)
    const result = await onSubmit({
      memberId,
      caseTitle: caseTitle.trim(),
      category,
      priority,
      assignedStaffId: assignedStaffId || null,
      assignedStaffName: assignedStaff?.displayName || null,
      description: description.trim(),
    })

    setSubmitting(false)
    if (result?.ok) {
      onClose()
    } else {
      setError(result?.error || 'Failed to create case')
    }
  }

  return (
    <Modal
      description={tx(
        language,
        'Create a confidential support case for a verified woman associated with your organization.',
        'संस्थासँग आबद्ध महिलाका लागि गोप्य सहयोग मामिला सिर्जना गर्नुहोस्।',
      )}
      onClose={onClose}
      open={open}
      size="large"
      title={tx(language, 'New Support Case', 'नयाँ सहयोग मामिला')}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        {error && (
          <div className="notice-inline notice-inline-danger">
            <Icon name="error" />
            <span>{error}</span>
          </div>
        )}

        <div className="form-row">
          <Field label={tx(language, 'Associated Member', 'सम्बद्ध महिला सदस्य')}>
            <select
              className="input-control"
              onChange={(e) => setMemberId(e.target.value)}
              required
              value={memberId}
            >
              {members.length === 0 ? (
                <option value="">{tx(language, 'No associated members found', 'कुनै सदस्य फेला परेन')}</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname} ({m.district || 'Nepal'})
                  </option>
                ))
              )}
            </select>
          </Field>

          <Field label={tx(language, 'Case Category', 'मामिला वर्ग')}>
            <select
              className="input-control"
              onChange={(e) => setCategory(e.target.value)}
              value={category}
            >
              {CASE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={tx(language, 'Case Title', 'मामिला शीर्षक')}>
          <input
            className="input-control"
            onChange={(e) => setCaseTitle(e.target.value)}
            placeholder={tx(
              language,
              'e.g. Tailoring Apprenticeship & Micro-stipend Assistance',
              'जस्तै: सिलाई तालिम र जीविकोपार्जन सहयोग',
            )}
            required
            value={caseTitle}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Initial Priority', 'प्राथमिकता')}>
            <select
              className="input-control"
              onChange={(e) => setPriority(e.target.value)}
              value={priority}
            >
              <option value="low">{tx(language, 'Low', 'सामान्य')}</option>
              <option value="medium">{tx(language, 'Medium', 'मध्यम')}</option>
              <option value="high">{tx(language, 'High', 'उच्च')}</option>
              <option value="urgent">{tx(language, 'Urgent', 'अति जरुरी')}</option>
            </select>
          </Field>

          <Field label={tx(language, 'Assign Caseworker', 'जिम्मेवार सहजकर्ता')}>
            <select
              className="input-control"
              onChange={(e) => setAssignedStaffId(e.target.value)}
              value={assignedStaffId}
            >
              <option value="">{tx(language, 'Unassigned', 'जिम्मा नतोकिएको')}</option>
              {team.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.displayName} ({worker.roleTitle || 'Caseworker'})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={tx(language, 'Support Plan & Initial Notes', 'सहयोग योजना र प्रारम्भिक विवरण')}>
          <textarea
            className="input-control textarea-control"
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tx(
              language,
              'Outline the transition goals, required resources, and immediate steps…',
              'पुनर्स्थापना लक्ष्य, आवश्यक सहयोग र तत्काल गर्नुपर्ने कामहरू लेख्नुहोस्…',
            )}
            rows={4}
            value={description}
          />
        </Field>

        <div className="notice-inline notice-inline-info">
          <Icon name="verified_user" />
          <span>
            {tx(
              language,
              'Zero offense or court records: Only record pseudonymous vocational, shelter, and reintegration progress.',
              'मुद्दा वा अदालतको विवरण राखिँदैन। पुनर्स्थापना र जीविकोपार्जन सहयोग विवरण मात्र लेख्नुहोस्।',
            )}
          </span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} type="button" variant="secondary">
            {tx(language, 'Cancel', 'रद्द गर्नुहोस्')}
          </Button>
          <Button disabled={submitting || members.length === 0} icon="add" type="submit">
            {submitting ? tx(language, 'Creating…', 'बन्दैछ…') : tx(language, 'Create Support Case', 'मामिला सिर्जना गर्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CaseDetailModal({
  open,
  onClose,
  caseItem,
  team = [],
  onUpdateStatus,
  onUpdatePriority,
  onAssignStaff,
  onAddNote,
  language,
}) {
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [noteContent, setNoteContent] = useState('')
  const [noteVisibility, setNoteVisibility] = useState('internal')
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError] = useState('')

  const loadNotes = useCallback(async () => {
    if (!caseItem?.id) return
    setLoadingNotes(true)
    const token = await auth.currentUser?.getIdToken?.()
    if (token) {
      const res = await fetchCaseNotesApi(token, caseItem.id)
      if (res.ok) {
        setNotes(res.notes)
      }
    }
    setLoadingNotes(false)
  }, [caseItem?.id])

  useEffect(() => {
    if (open && caseItem?.id) {
      loadNotes()
      setNoteContent('')
      setNoteVisibility('internal')
      setNoteError('')
    }
  }, [open, caseItem?.id, loadNotes])

  if (!open || !caseItem) return null

  const handleCreateNote = async (e) => {
    e.preventDefault()
    if (!noteContent.trim()) return

    setAddingNote(true)
    setNoteError('')
    const token = await auth.currentUser?.getIdToken?.()
    if (token) {
      const res = await onAddNote({
        caseId: caseItem.id,
        content: noteContent.trim(),
        visibility: noteVisibility,
      })
      if (res?.ok) {
        setNoteContent('')
        loadNotes()
      } else {
        setNoteError(res?.error || 'Failed to add note')
      }
    }
    setAddingNote(false)
  }

  return (
    <Modal
      description={`${tx(language, 'Associated Member:', 'सम्बद्ध सदस्य:')} ${caseItem.memberNickname || 'Member'} · ${caseItem.category}`}
      onClose={onClose}
      open={open}
      size="large"
      title={caseItem.caseTitle}
    >
      <div className="form-stack">
        {/* Case Metadata & Quick Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {getStatusBadge(caseItem.status, language)}
            {getPriorityBadge(caseItem.priority, language)}
            <Badge tone="neutral">{caseItem.category}</Badge>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>{tx(language, 'Status:', 'स्थिति:')}</label>
            <select
              className="input-control"
              onChange={(e) => onUpdateStatus(caseItem.id, e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
              value={caseItem.status}
            >
              <option value="open">{tx(language, 'Open', 'खुला')}</option>
              <option value="in_progress">{tx(language, 'In Progress', 'प्रक्रियामा')}</option>
              <option value="on_hold">{tx(language, 'On Hold', 'स्थगित')}</option>
              <option value="resolved">{tx(language, 'Resolved', 'समाधान भएको')}</option>
              <option value="closed">{tx(language, 'Closed', 'सकिएको')}</option>
            </select>

            <label style={{ fontSize: '12px', fontWeight: 600 }}>{tx(language, 'Priority:', 'प्राथमिकता:')}</label>
            <select
              className="input-control"
              onChange={(e) => onUpdatePriority(caseItem.id, e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
              value={caseItem.priority}
            >
              <option value="low">{tx(language, 'Low', 'सामान्य')}</option>
              <option value="medium">{tx(language, 'Medium', 'मध्यम')}</option>
              <option value="high">{tx(language, 'High', 'उच्च')}</option>
              <option value="urgent">{tx(language, 'Urgent', 'अति जरुरी')}</option>
            </select>
          </div>
        </div>

        {/* Assigned Staff Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-muted, #f8f6f3)', padding: '10px 14px', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tx(language, 'Assigned Caseworker', 'जिम्मेवार सहजकर्ता')}</span>
            <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
              <Icon name="badge" size={16} /> {caseItem.assignedStaffName || tx(language, 'Unassigned', 'जिम्मा नतोकिएको')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px' }}>{tx(language, 'Reassign:', 'पुनः तोक्नुहोस्:')}</span>
            <select
              className="input-control"
              onChange={(e) => {
                const worker = team.find((w) => w.id === e.target.value)
                onAssignStaff(caseItem.id, e.target.value || null, worker?.displayName || null)
              }}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
              value={caseItem.assignedStaffId || ''}
            >
              <option value="">{tx(language, 'Unassigned', 'जिम्मा नतोकिएको')}</option>
              {team.map((w) => (
                <option key={w.id} value={w.id}>{w.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Case Description */}
        {caseItem.description && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
            <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {tx(language, 'Initial Case Description & Goals', 'प्रारम्भिक योजना तथा लक्ष्य')}
            </strong>
            <p style={{ margin: '6px 0 0', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {caseItem.description}
            </p>
          </div>
        )}

        {/* Dated Progress Notes Section */}
        <div style={{ marginTop: '8px' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="history_edu" size={20} />
            {tx(language, 'Dated Progress Notes & Case History', 'मिति अनुसार प्रगति विवरण तथा इतिहास')}
            <Badge tone="lavender">{notes.length}</Badge>
          </h3>

          {/* Add Note Form */}
          <form onSubmit={handleCreateNote} style={{ marginBottom: '16px', background: 'var(--surface-muted, #f8f6f3)', padding: '12px', borderRadius: '8px' }}>
            {noteError && (
              <div className="notice-inline notice-inline-danger" style={{ marginBottom: '8px' }}>
                <Icon name="error" />
                <span>{noteError}</span>
              </div>
            )}
            <textarea
              className="input-control textarea-control"
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={tx(
                language,
                'Record dated milestone, counseling visit, or support update…',
                'प्रगति विवरण, परामर्श वा सहयोगको विवरण लेख्नुहोस्…',
              )}
              required
              rows={2}
              value={noteContent}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500 }}>{tx(language, 'Visibility:', 'दृश्यता:')}</label>
                <select
                  className="input-control"
                  onChange={(e) => setNoteVisibility(e.target.value)}
                  style={{ width: 'auto', padding: '3px 8px', fontSize: '12px' }}
                  value={noteVisibility}
                >
                  <option value="internal">{tx(language, 'Staff internal only', 'संस्था सहजकर्तामा मात्र')}</option>
                  <option value="member_visible">{tx(language, 'Share with member', 'सदस्यले हेर्न मिल्ने')}</option>
                </select>
              </div>
              <Button disabled={addingNote || !noteContent.trim()} icon="send" size="small" type="submit">
                {addingNote ? tx(language, 'Saving…', 'बचत हुँदैछ…') : tx(language, 'Add Note', 'विवरण थप्नुहोस्')}
              </Button>
            </div>
          </form>

          {/* Notes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {loadingNotes ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {tx(language, 'Loading history notes…', 'प्रगति विवरण लोड हुँदैछ…')}
              </p>
            ) : notes.length ? (
              notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--plum)' }}>
                      <Icon name="person" size={14} /> {note.authorName} ({note.authorRole})
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {note.visibility === 'member_visible' ? (
                        <Badge tone="green">{tx(language, 'Shared with member', 'सदस्यसँग साझा')}</Badge>
                      ) : (
                        <Badge tone="neutral">{tx(language, 'Internal only', 'आन्तरिक मात्र')}</Badge>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{note.content}</p>
                </div>
              ))
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>
                {tx(language, 'No progress notes recorded yet.', 'हालसम्म कुनै प्रगति विवरण थपिएको छैन।')}
              </p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Close', 'बन्द गर्नुहोस्')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function CasesPage({
  activeOrgId = '',
  onGenerateHandoverCode,
  team = [],
  language,
}) {
  const [activeTab, setActiveTab] = useState('cases') // 'cases' | 'roster' | 'codes'
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Handover Codes state
  const [copiedCode, setCopiedCode] = useState('')
  const [newlyGenerated, setNewlyGenerated] = useState(null)
  const [newlyExpiresAt, setNewlyExpiresAt] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [codeFilter, setCodeFilter] = useState('all')
  const [codes, setCodes] = useState([])

  // Associated Members state
  const [realMembers, setRealMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [memberError, setMemberError] = useState('')

  // Cases state
  const [cases, setCases] = useState([])
  const [loadingCases, setLoadingCases] = useState(true)
  const [caseError, setCaseError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCase, setSelectedCase] = useState(null)

  const loadMembers = useCallback(async () => {
    if (!activeOrgId) {
      setLoadingMembers(false)
      return
    }
    setLoadingMembers(true)
    setMemberError('')
    const res = await fetchAssociatedMembers(activeOrgId)
    if (res.ok) {
      setRealMembers(res.members)
    } else {
      setMemberError(res.error)
    }
    setLoadingMembers(false)
  }, [activeOrgId])

  const loadCases = useCallback(async () => {
    if (!activeOrgId) {
      setLoadingCases(false)
      return
    }
    setLoadingCases(true)
    setCaseError('')
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (token) {
        const res = await fetchCases(token)
        if (res.ok) {
          setCases(res.cases)
        } else {
          setCaseError(res.error || 'Failed to load cases')
        }
      }
    } catch (err) {
      setCaseError(err.message || 'Error loading cases')
    } finally {
      setLoadingCases(false)
    }
  }, [activeOrgId])

  useEffect(() => {
    loadMembers()
    loadCases()
  }, [loadMembers, loadCases])

  // Case Actions
  const handleCreateCase = async (caseData) => {
    const token = await auth.currentUser?.getIdToken?.()
    if (!token) return { ok: false, error: 'Authentication required' }

    const res = await createCaseApi(token, caseData)
    if (res.ok) {
      await loadCases()
      return { ok: true }
    }
    return res
  }

  const handleUpdateStatus = async (caseId, newStatus) => {
    // Optimistic UI update
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c)),
    )
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase((prev) => ({ ...prev, status: newStatus }))
    }

    const token = await auth.currentUser?.getIdToken?.()
    if (token) {
      await updateCaseApi(token, caseId, { status: newStatus })
      await loadCases()
    }
  }

  const handleUpdatePriority = async (caseId, newPriority) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, priority: newPriority } : c)),
    )
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase((prev) => ({ ...prev, priority: newPriority }))
    }

    const token = await auth.currentUser?.getIdToken?.()
    if (token) {
      await updateCaseApi(token, caseId, { priority: newPriority })
      await loadCases()
    }
  }

  const handleAssignStaff = async (caseId, staffId, staffName) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? { ...c, assignedStaffId: staffId, assignedStaffName: staffName }
          : c,
      ),
    )
    if (selectedCase && selectedCase.id === caseId) {
      setSelectedCase((prev) => ({
        ...prev,
        assignedStaffId: staffId,
        assignedStaffName: staffName,
      }))
    }

    const token = await auth.currentUser?.getIdToken?.()
    if (token) {
      await updateCaseApi(token, caseId, {
        assignedStaffId: staffId,
        assignedStaffName: staffName,
      })
      await loadCases()
    }
  }

  const handleAddNote = async ({ caseId, content, visibility }) => {
    const token = await auth.currentUser?.getIdToken?.()
    if (!token) return { ok: false, error: 'Authentication required' }

    return addCaseNoteApi(token, {
      caseId,
      content,
      visibility,
      authorName: auth.currentUser?.displayName || 'Caseworker',
      authorRole: 'Caseworker',
    })
  }

  // Handover Codes Handlers
  const handleCopy = (code) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(''), 3000)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerationError('')
    try {
      const res = await onGenerateHandoverCode?.()
      if (res?.ok && res.code) {
        setNewlyGenerated(res.code)
        setNewlyExpiresAt(res.expiresAt)
        handleCopy(res.code)
        setCodes((prev) => [
          {
            code: res.code,
            issuedAt: 'Just now',
            expiresAt: '72 hours from issue',
            status: 'available',
          },
          ...prev,
        ])
      } else {
        setGenerationError(res?.error || 'Failed to issue handover code')
      }
    } catch (err) {
      setGenerationError(err.message || 'Error communicating with server')
    } finally {
      setIsGenerating(false)
    }
  }

  const availableCodes = codes.filter((c) => c.status === 'available')
  const usedCodes = codes.filter((c) => c.status === 'used')
  const displayedCodes =
    codeFilter === 'available'
      ? availableCodes
      : codeFilter === 'used'
        ? usedCodes
        : codes

  // Filtered lists
  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      const searchStr = `${c.caseTitle} ${c.memberNickname} ${c.category} ${c.assignedStaffName || ''}`.toLowerCase()
      if (!searchStr.includes(q)) return false
    }
    return true
  })

  const filteredMembers = realMembers.filter((item) =>
    (item.nickname || '').toLowerCase().includes(query.toLowerCase()) ||
    (item.district && item.district.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'Manage individualized reintegration support cases, assign caseworkers, issue 72-hour handover codes, and track progress notes.',
          'व्यक्तिगत पुनर्स्थापना मामिला व्यवस्थापन गर्नुहोस्, सहजकर्ता तोक्नुहोस्, ७२-घण्टे कोड जारी गर्नुहोस् र प्रगति विवरण राख्नुहोस्।',
        )}
        eyebrow={tx(language, 'ORGANIZATION WORKSPACE', 'संस्था कार्यस्थल')}
        title={tx(language, 'Cases & Member Support', 'सहयोग मामिला तथा सदस्य व्यवस्थापन')}
        action={
          activeTab === 'cases' ? (
            <Button icon="add" onClick={() => setShowCreateModal(true)}>
              {tx(language, 'New Support Case', 'नयाँ सहयोग मामिला')}
            </Button>
          ) : (
            <Button disabled={isGenerating} icon={isGenerating ? 'sync' : 'key'} onClick={handleGenerate}>
              {isGenerating
                ? tx(language, 'Issuing Code…', 'कोड जारी हुँदैछ…')
                : tx(language, 'Generate Handover Code', 'हस्तान्तरण कोड जारी गर्नुहोस्')}
            </Button>
          )
        }
      />

      {/* Main Section Navigation Tabs */}
      <div className="notices-main-tabs" role="tablist" style={{ marginBottom: '16px' }}>
        <button
          aria-selected={activeTab === 'cases'}
          className={`notice-tab-btn ${activeTab === 'cases' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('cases')}
          role="tab"
          type="button"
        >
          <Icon name="folder_open" size={18} />
          <span>{tx(language, 'Support Cases', 'सहयोग मामिलाहरू')}</span>
          <Badge tone={activeTab === 'cases' ? 'lavender' : 'neutral'}>{cases.length}</Badge>
        </button>

        <button
          aria-selected={activeTab === 'roster'}
          className={`notice-tab-btn ${activeTab === 'roster' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('roster')}
          role="tab"
          type="button"
        >
          <Icon name="groups" size={18} />
          <span>{tx(language, 'Associated Women Roster', 'सम्बद्ध महिलाहरूको सूची')}</span>
          <Badge tone={activeTab === 'roster' ? 'mint' : 'neutral'}>{realMembers.length}</Badge>
        </button>

        <button
          aria-selected={activeTab === 'codes'}
          className={`notice-tab-btn ${activeTab === 'codes' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setActiveTab('codes')}
          role="tab"
          type="button"
        >
          <Icon name="vpn_key" size={18} />
          <span>{tx(language, 'Handover Codes', 'हस्तान्तरण कोड')}</span>
          <Badge tone={activeTab === 'codes' ? 'peach' : 'neutral'}>{codes.length}</Badge>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: CASES
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'cases' && (
        <section aria-label="Support Cases">
          {/* Toolbar: Search & Status Filters */}
          <div className="list-toolbar">
            <div className="search-field">
              <Icon name="search" />
              <input
                aria-label={tx(language, 'Search cases', 'मामिला खोज्नुहोस्')}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tx(language, 'Search cases by title, member, category…', 'शीर्षक, सदस्य वा वर्ग खोज्नुहोस्…')}
                value={query}
              />
            </div>

            <div className="filter-pills" role="group">
              {CASE_STATUSES.map((st) => (
                <button
                  aria-pressed={statusFilter === st}
                  className={`filter-pill ${statusFilter === st ? 'filter-pill-active' : ''}`}
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  type="button"
                >
                  {st === 'all'
                    ? tx(language, 'All Statuses', 'सबै स्थिति')
                    : st === 'open'
                      ? tx(language, 'Open', 'खुला')
                      : st === 'in_progress'
                        ? tx(language, 'In Progress', 'प्रक्रियामा')
                        : st === 'on_hold'
                          ? tx(language, 'On Hold', 'स्थगित')
                          : st === 'resolved'
                            ? tx(language, 'Resolved', 'समाधान भएको')
                            : tx(language, 'Closed', 'सकिएको')}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {caseError && (
            <div className="notice-inline notice-inline-danger" style={{ marginBottom: '16px' }}>
              <Icon name="error" />
              <span>{caseError}</span>
              <Button onClick={loadCases} size="small" variant="secondary">
                {tx(language, 'Retry', 'पुनः प्रयास')}
              </Button>
            </div>
          )}

          {/* Cases List */}
          {loadingCases ? (
            <Card className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
              <Icon name="sync" size={32} />
              <p style={{ marginTop: '8px' }}>
                {tx(language, 'Loading organization support cases from Firestore…', 'फायरस्टोरबाट मामिलाहरू लोड हुँदैछ…')}
              </p>
            </Card>
          ) : filteredCases.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredCases.map((c) => (
                <Card className="case-card" key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                        {getStatusBadge(c.status, language)}
                        {getPriorityBadge(c.priority, language)}
                      </div>
                      <h3 style={{ margin: '4px 0 2px', fontSize: '16px' }}>{c.caseTitle}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.category}</span>
                    </div>
                  </div>

                  {/* Member & Caseworker Info */}
                  <div style={{ background: 'var(--surface-muted, #f8f6f3)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{tx(language, 'Member:', 'सदस्य:')}</span>
                      <strong>{c.memberNickname}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{tx(language, 'Caseworker:', 'सहजकर्ता:')}</span>
                      <span>{c.assignedStaffName || <em style={{ color: 'var(--text-muted)' }}>{tx(language, 'Unassigned', 'तोकिएको छैन')}</em>}</span>
                    </div>
                  </div>

                  {c.description && (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {c.updatedAt ? `${tx(language, 'Updated:', 'अपडेट:')} ${new Date(c.updatedAt).toLocaleDateString()}` : ''}
                    </span>
                    <Button icon="visibility" onClick={() => setSelectedCase(c)} size="small" variant="secondary">
                      {tx(language, 'Details & Notes', 'विवरण तथा टिपोट')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="empty-state" style={{ padding: '3rem', textAlign: 'center' }}>
              <Icon name="folder_open" size={36} />
              <strong style={{ display: 'block', margin: '0.5rem 0', fontSize: '1rem' }}>
                {query.trim() || statusFilter !== 'all'
                  ? tx(language, 'No cases match your filters', 'कुनै मामिला भेटिएन')
                  : tx(language, 'No support cases created yet', 'हालसम्म कुनै मामिला सिर्जना गरिएको छैन')}
              </strong>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1rem', fontSize: '0.9rem' }}>
                {tx(
                  language,
                  'Create an individualized case to track reintegration milestones, assign caseworkers, and record progress notes for associated women.',
                  'सम्बद्ध महिलाका लागि व्यक्तिगत मामिला सिर्जना गरी प्रगति विवरण र सहजकर्ता व्यवस्थापन गर्नुहोस्।',
                )}
              </p>
              <Button icon="add" onClick={() => setShowCreateModal(true)}>
                {tx(language, 'Create Support Case', 'सहयोग मामिला सिर्जना गर्नुहोस्')}
              </Button>
            </Card>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: ASSOCIATED MEMBERS ROSTER
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'roster' && (
        <section aria-label="Associated Members">
          <div className="list-toolbar">
            <div className="search-field">
              <Icon name="search" />
              <input
                aria-label={tx(language, 'Search associated women', 'सम्बद्ध महिला खोज्नुहोस्')}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx(language, 'Search by nickname or district…', 'उपनाम वा जिल्ला खोज्नुहोस्…')}
                value={query}
              />
            </div>
          </div>

          <Card className="table-card">
            <div className="table-card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>{tx(language, 'Associated Women Roster', 'सम्बद्ध महिलाहरूको सूची')}</h2>
                <span>
                  {loadingMembers
                    ? tx(language, 'Loading records…', 'रेकर्डहरू लोड हुँदैछ…')
                    : `${filteredMembers.length} ${tx(language, 'pseudonymous records', 'उपनाम रेकर्डहरू')}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  disabled={loadingMembers}
                  icon="refresh"
                  onClick={loadMembers}
                  size="small"
                  variant="secondary"
                >
                  {tx(language, 'Refresh', 'ताजा गर्नुहोस्')}
                </Button>
                <Badge dot tone="lavender">{tx(language, 'Pseudonymous only', 'उपनाम मात्र')}</Badge>
              </div>
            </div>

            {loadingMembers ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Icon name="sync" size={28} />
                <p style={{ marginTop: '8px', fontSize: '0.95rem' }}>
                  {tx(language, 'Loading associated members from Firestore…', 'फायरस्टोरबाट सम्बद्ध सदस्यहरू लोड हुँदैछ…')}
                </p>
              </div>
            ) : memberError ? (
              <div className="notice-inline notice-inline-danger" style={{ margin: '16px' }}>
                <Icon name="error" />
                <span>{memberError}</span>
                <Button onClick={loadMembers} size="small" variant="secondary">
                  {tx(language, 'Retry', 'पुनः प्रयास')}
                </Button>
              </div>
            ) : filteredMembers.length ? (
              <div className="associated-members-grid">
                {filteredMembers.map((member) => {
                  const avatarSrc =
                    MEMBER_AVATAR_OPTIONS.find((a) => a.id === member.avatarId)?.src || IMAGE_PATHS.avatars.avatar1
                  return (
                    <div className="associated-member-card" key={member.id}>
                      <div className="member-card-avatar">
                        <AssetImage
                          alt={`${member.nickname} avatar`}
                          className="avatar-img"
                          fallbackSrc={IMAGE_PATHS.avatars.avatar1}
                          src={avatarSrc}
                        />
                      </div>
                      <div className="member-card-info">
                        <strong>{member.nickname}</strong>
                        <span>
                          <Icon name="location_on" size={14} />
                          {member.district || tx(language, 'Nepal', 'नेपाल')}
                        </span>
                        <small>{tx(language, 'Joined', 'आबद्ध')}: {member.joinedDate}</small>
                      </div>
                      <div className="member-card-meta">
                        <Badge dot tone="green">{tx(language, 'Verified', 'प्रमाणित')}</Badge>
                        <span className="member-status-sub">
                          {member.communityOptIn
                            ? tx(language, 'Community: Opted In', 'समुदाय: सामेल')
                            : tx(language, 'Community: Private', 'समुदाय: गोप्य')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <Icon name="groups" size={36} />
                <strong style={{ display: 'block', margin: '0.5rem 0', fontSize: '1rem' }}>
                  {query.trim()
                    ? tx(language, 'No members match your search', 'कुनै सदस्य भेटिएन')
                    : tx(language, 'No associated women registered yet', 'हालसम्म कुनै महिला सदस्य दर्ता हुनुभएको छैन')}
                </strong>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto', fontSize: '0.9rem' }}>
                  {query.trim()
                    ? tx(language, 'Try a different nickname or search term.', 'अन्य उपनाम वा खोजी शब्द प्रयोग गर्नुहोस्।')
                    : tx(
                        language,
                        'Generate and share a 72-hour handover code to safely onboard a woman to your organization.',
                        'आफ्नो संस्थामा महिलाहरूलाई सुरक्षित रूपमा आबद्ध गर्न ७२-घण्टे कोड जारी गरी साझा गर्नुहोस्।',
                      )}
                </p>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: HANDOVER CODES
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'codes' && (
        <section aria-label="Handover Codes" className="handover-generation-panel">
          <Card className="handover-card">
            <div className="handover-card-header">
              <span className="handover-icon"><Icon name="vpn_key" size={24} /></span>
              <div>
                <h3>{tx(language, '72-Hour Handover Code Generator', '७२-घण्टे हस्तान्तरण कोड प्रणाली')}</h3>
                <p>
                  {tx(
                    language,
                    'Women use this single-use code to register safely with a nickname, password, and avatar—no email or phone required. Codes generated here are cryptographically hashed and stored in Firestore.',
                    'महिलाहरूले इमेल वा फोनबिनै उपनाम, पासवर्ड र अवतार छानी खाता खोल्न यो एकपटक प्रयोग हुने कोड प्रयोग गर्छन्। यहाँ जारी गरिएको कोड सुरक्षित रूपमा फायरस्टोरमा भण्डारण हुन्छ।',
                  )}
                </p>
              </div>
            </div>

            {generationError && (
              <div className="notice-inline notice-inline-danger" style={{ margin: '12px 0' }}>
                <Icon name="error" />
                <span>{generationError}</span>
              </div>
            )}

            {newlyGenerated && (
              <div className="new-code-banner">
                <span className="new-code-label">{tx(language, 'NEW CODE GENERATED', 'नयाँ कोड जारी भयो')}</span>
                <strong className="new-code-display">{newlyGenerated}</strong>
                <div className="new-code-meta">
                  <Badge dot tone="peach">
                    {newlyExpiresAt
                      ? `${tx(language, 'Valid until', 'मान्य मिति')}: ${new Date(newlyExpiresAt).toLocaleString()}`
                      : tx(language, 'Valid for 72 hours · Single use', '७२ घण्टा मान्य · एकपटक मात्र')}
                  </Badge>
                  <Button
                    icon={copiedCode === newlyGenerated ? 'check' : 'content_copy'}
                    onClick={() => handleCopy(newlyGenerated)}
                    variant="secondary"
                  >
                    {copiedCode === newlyGenerated
                      ? tx(language, 'Copied to clipboard', 'प्रतिलिपि भयो')
                      : tx(language, 'Copy code', 'कोड प्रतिलिपि')}
                  </Button>
                </div>
              </div>
            )}

            <div className="handover-status-tabs">
              <div className="code-filter-tabs">
                <button
                  aria-pressed={codeFilter === 'all'}
                  className={`code-filter-btn ${codeFilter === 'all' ? 'code-filter-btn-active' : ''}`}
                  onClick={() => setCodeFilter('all')}
                  type="button"
                >
                  {tx(language, 'Session Codes', 'सत्रका कोड')} ({codes.length})
                </button>
                <button
                  aria-pressed={codeFilter === 'available'}
                  className={`code-filter-btn ${codeFilter === 'available' ? 'code-filter-btn-active' : ''}`}
                  onClick={() => setCodeFilter('available')}
                  type="button"
                >
                  {tx(language, 'Available', 'उपलब्ध')} ({availableCodes.length})
                </button>
                <button
                  aria-pressed={codeFilter === 'used'}
                  className={`code-filter-btn ${codeFilter === 'used' ? 'code-filter-btn-active' : ''}`}
                  onClick={() => setCodeFilter('used')}
                  type="button"
                >
                  {tx(language, 'Used / Registered', 'प्रयोग भएको')} ({usedCodes.length})
                </button>
              </div>
            </div>

            <div className="codes-table-list">
              {displayedCodes.length ? (
                displayedCodes.map((item) => (
                  <div className="code-table-row" key={item.code}>
                    <div className="code-table-main">
                      <code className="handover-code-text">{item.code}</code>
                      <div className="code-table-meta">
                        <span><Icon name="schedule" size={14} />{item.issuedAt || 'Recent'}</span>
                        <span><Icon name="timer" size={14} />{item.expiresAt || '72h'}</span>
                      </div>
                    </div>

                    <div className="code-table-status">
                      {item.status === 'available' ? (
                        <Badge dot tone="green">{tx(language, 'Available for registration', 'दर्ताका लागि उपलब्ध')}</Badge>
                      ) : (
                        <Badge dot tone="lavender">
                          {tx(language, 'Registered', 'दर्ता भएको')}
                        </Badge>
                      )}

                      {item.status === 'available' && (
                        <button
                          className="code-copy-icon-btn"
                          onClick={() => handleCopy(item.code)}
                          title={tx(language, 'Copy code', 'कोड प्रतिलिपि')}
                          type="button"
                        >
                          <Icon name={copiedCode === item.code ? 'check' : 'content_copy'} size={16} />
                          <span>{copiedCode === item.code ? tx(language, 'Copied', 'भयो') : tx(language, 'Copy', 'प्रतिलिपि')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  {tx(
                    language,
                    'No handover codes issued in this session yet. Click "Generate Handover Code" above to issue a single-use onboarding code.',
                    'यस सत्रमा कुनै कोड जारी गरिएको छैन। नयाँ आबद्धता कोड जारी गर्न माथि "हस्तान्तरण कोड जारी गर्नुहोस्" थिच्नुहोस्।',
                  )}
                </p>
              )}
            </div>

            <div className="notice-inline notice-inline-info">
              <Icon name="verified_user" />
              <span>
                {tx(
                  language,
                  'Cryptographic issuance: Handover codes are generated using secure random bytes and hashed with SHA-256 before storage in Firestore. The plaintext code is only shown once.',
                  'सुरक्षित सर्भर प्रणाली: कोडहरू क्रिप्टोग्राफिक रूपमा सिर्जना भई SHA-256 ह्याससहित सुरक्षित फायरस्टोरमा भण्डारण हुन्छन्।',
                )}
              </span>
            </div>
          </Card>
        </section>
      )}

      {/* Modals */}
      <CaseCreateModal
        language={language}
        members={realMembers}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCase}
        open={showCreateModal}
        team={team}
      />

      {selectedCase && (
        <CaseDetailModal
          caseItem={selectedCase}
          language={language}
          onAddNote={handleAddNote}
          onAssignStaff={handleAssignStaff}
          onClose={() => setSelectedCase(null)}
          onUpdatePriority={handleUpdatePriority}
          onUpdateStatus={handleUpdateStatus}
          open={Boolean(selectedCase)}
          team={team}
        />
      )}

      <div className="privacy-banner" style={{ marginTop: '24px' }}>
        <div className="privacy-banner-icon"><Icon name="shield_lock" /></div>
        <div>
          <strong>{tx(language, 'Confidential support & case boundaries', 'गोपनीय सहयोग तथा मामिला सीमाहरू')}</strong>
          <p>
            {tx(
              language,
              'Court hearing dates, offense histories, medical files, and legal records are never collected. All records belong exclusively to your organization and are kept isolated.',
              'अदालती सुनुवाइ मिति, कसुर इतिहास, स्वास्थ्य विवरण वा कानुनी फाइल कहिल्यै संकलन गरिँदैन। सबै विवरण तपाईंको संस्थामा मात्र सुरक्षित र अलग रहन्छ।',
            )}
          </p>
        </div>
      </div>
    </>
  )
}
