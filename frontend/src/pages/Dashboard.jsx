import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Field, Icon, Modal, PageHeader, StatCard } from '../components/ui.jsx'
import { IMAGE_PATHS, IMAGE_PLACEHOLDERS, MEMBER_AVATAR_OPTIONS } from '../config/images.js'
import { tx } from '../i18n.js'

function MemberProfileModal({ open, onClose, profile, onSave, language }) {
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [avatarId, setAvatarId] = useState(profile?.avatarId || 'avatar1')
  const [district, setDistrict] = useState(profile?.district || 'Lalitpur')
  const [interestsText, setInterestsText] = useState(
    Array.isArray(profile?.interests) ? profile.interests.join(', ') : '',
  )
  const [communityOptIn, setCommunityOptIn] = useState(profile?.communityOptIn !== false)
  const [showDistrict, setShowDistrict] = useState(profile?.showDistrict !== false)
  const [showInterests, setShowInterests] = useState(profile?.showInterests !== false)

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    const parsedInterests = interestsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    onSave({
      nickname: nickname.trim() || profile?.nickname,
      avatarId,
      district: district.trim(),
      interests: parsedInterests,
      communityOptIn,
      showDistrict,
      showInterests,
    })
    onClose()
  }

  return (
    <Modal
      description={tx(
        language,
        'Manage your pseudonym, illustrated avatar, and community directory visibility. Real identity details are never stored.',
        'तपाईंको उपनाम, चित्रित अवतार र समुदाय निर्देशिका दृश्यता व्यवस्थापन गर्नुहोस्। वास्तविक पहिचान विवरणहरू कहिल्यै राखिँदैन।',
      )}
      onClose={onClose}
      open={open}
      size="large"
      title={tx(language, 'Member Profile & Privacy Preferences', 'सदस्य प्रोफाइल र गोपनीयता प्राथमिकताहरू')}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="section-subheading">
          <h3>{tx(language, '1. Pseudonymous Account Identity', '१. उपनाम खाता पहिचान')}</h3>
        </div>

        <Field label={tx(language, 'Choose your illustrated avatar', 'आफ्नो चित्रित अवतार छान्नुहोस्')}>
          <div className="avatar-picker-grid">
            {MEMBER_AVATAR_OPTIONS.map((avatar) => {
              const isSelected = avatarId === avatar.id
              return (
                <button
                  className={`avatar-choice-card ${isSelected ? 'avatar-choice-selected' : ''}`}
                  key={avatar.id}
                  onClick={() => setAvatarId(avatar.id)}
                  type="button"
                >
                  <AssetImage
                    alt={avatar.label}
                    className="avatar-img-preview"
                    fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                    src={avatar.src}
                  />
                  <span>{avatar.label}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Nickname', 'उपनाम')}>
            <input
              className="input-control"
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Sajilo"
              required
              value={nickname}
            />
          </Field>

          <Field label={tx(language, 'Approximate District / Location', 'अनुमानित जिल्ला / स्थान')}>
            <input
              className="input-control"
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Lalitpur"
              value={district}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Skills & Interests (comma-separated)', 'सीप र रुचिहरू (अल्पविरामले छुट्याइएको)')}>
          <input
            className="input-control"
            onChange={(e) => setInterestsText(e.target.value)}
            placeholder="e.g. Tailoring, Cooking, Small Business, Computer Basics"
            value={interestsText}
          />
        </Field>

        <div className="section-subheading" style={{ marginTop: '16px' }}>
          <h3>{tx(language, '2. Community Directory & Visibility', '२. समुदाय निर्देशिका र दृश्यता')}</h3>
        </div>

        <div className="privacy-options-stack">
          <label className="checkbox-option">
            <input
              checked={communityOptIn}
              onChange={(e) => setCommunityOptIn(e.target.checked)}
              type="checkbox"
            />
            <div>
              <strong>{tx(language, 'Participate in the pseudonymous Community Directory', 'उपनाम समुदाय निर्देशिकामा सहभागी हुनुहोस्')}</strong>
              <p>{tx(language, 'Allows other verified women on Naya Sahara to see your avatar, nickname, and send you 1:1 message requests. Chat opens only after you accept.', 'नयाँ सहाराका अन्य महिलाहरूले तपाईंको उपनाम र अवतार हेर्न र सन्देश अनुरोध पठाउन पाउँछन्। तपाईंले स्वीकार गरेपछि मात्र च्याट खुल्छ।')}</p>
            </div>
          </label>

          {communityOptIn && (
            <>
              <label className="checkbox-option" style={{ marginLeft: '24px' }}>
                <input
                  checked={showDistrict}
                  onChange={(e) => setShowDistrict(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <strong>{tx(language, 'Display approximate district on community card', 'समुदाय कार्डमा अनुमानित जिल्ला देखाउनुहोस्')}</strong>
                  <small>{tx(language, 'Helps find peer support in your local region.', 'तपाईंको क्षेत्रमा साथी सहयोग पाउन मद्दत गर्छ।')}</small>
                </div>
              </label>

              <label className="checkbox-option" style={{ marginLeft: '24px' }}>
                <input
                  checked={showInterests}
                  onChange={(e) => setShowInterests(e.target.checked)}
                  type="checkbox"
                />
                <div>
                  <strong>{tx(language, 'Display interests and skills on community card', 'समुदाय कार्डमा रुचि तथा सीप देखाउनुहोस्')}</strong>
                  <small>{tx(language, 'Helps connect with women sharing similar vocational interests.', 'समान सीप वा रुचि भएका साथीहरूसँग जोडिन मद्दत गर्छ।')}</small>
                </div>
              </label>
            </>
          )}
        </div>

        <div className="notice-inline notice-inline-info" style={{ marginTop: '12px' }}>
          <Icon name="verified_user" />
          <span>{tx(language, 'Private Account Protection: Real names, phone numbers, email addresses, handover codes, and case records are never stored or displayed.', 'निजी खाता सुरक्षा: वास्तविक नाम, फोन, इमेल, हस्तान्तरण कोड वा कानुनी विवरणहरू कहिल्यै राखिँदैन।')}</span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Cancel', 'रद्द गर्नुहोस्')}
          </Button>
          <Button icon="save" type="submit">
            {tx(language, 'Save preferences', 'प्राथमिकताहरू सुरक्षित गर्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function OrgAdminHome({
  onNavigate,
  language,
  associatedWomenCount = 3,
  activeCaseworkersCount = 2,
  publishedNoticesCount = 4,
  pendingRequestsCount = 0,
}) {
  return (
    <>
      <PageHeader
        description={tx(
          language,
          'A clear view of today’s service work. All metrics shown here are demonstration data.',
          'आजको सेवा कार्यको स्पष्ट दृश्य। यहाँ देखाइएका सबै विवरणहरू नमुना प्रदर्शन डेटा हुन्।',
        )}
        eyebrow={tx(language, 'ORG ADMIN WORKSPACE', 'संस्था प्रशासक कार्यस्थल')}
        title={tx(language, 'Good morning, Asha Sathi', 'शुभ प्रभात, आशा साथी')}
        action={<Button icon="add" onClick={() => onNavigate('cases')}>{tx(language, 'Issue Handover Code', 'हस्तान्तरण कोड जारी गर्नुहोस्')}</Button>}
      />

      <div className="stat-grid">
        <StatCard
          icon="badge"
          label={tx(language, 'Associated Women', 'सम्बद्ध महिलाहरू')}
          note={tx(language, 'Demonstration members', 'नमुना सदस्य संख्या')}
          tone="mint"
          value={associatedWomenCount}
        />
        <StatCard
          icon="groups"
          label={tx(language, 'Active Caseworkers', 'सक्रिय केसकर्मीहरू')}
          note={tx(language, 'Roster entries', 'सूची प्रविष्टिहरू')}
          tone="lavender"
          value={activeCaseworkersCount}
        />
        <StatCard
          icon="campaign"
          label={tx(language, 'Published Notices', 'प्रकाशित सूचनाहरू')}
          note={tx(language, 'Training, jobs & aid', 'तालिम, रोजगारी र सहायता')}
          tone="peach"
          value={publishedNoticesCount}
        />
        <StatCard
          icon="mark_chat_unread"
          label={tx(language, 'Pending Requests', 'प्रतीक्षारत अनुरोधहरू')}
          note={tx(language, 'Member message requests', 'सदस्यका सन्देश अनुरोधहरू')}
          tone="lavender"
          value={pendingRequestsCount}
        />
      </div>

      <div className="dashboard-grid">
        <Card className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{tx(language, 'NGO ACTIONS', 'संस्था कार्यहरू')}</p>
              <h2>{tx(language, 'Quick workspace actions', 'छिटो कार्यस्थल पहुँच')}</h2>
            </div>
          </div>
          <div className="quick-action-list">
            <button className="quick-action" onClick={() => onNavigate('cases')} type="button">
              <span className="quick-action-icon"><Icon name="key" /></span>
              <span><strong>{tx(language, 'Associated Women & Handover Codes', 'सम्बद्ध महिला र हस्तान्तरण कोड')}</strong><small>{tx(language, 'Issue 72-hour registration codes or view pseudonymous roster', '७२-घण्टे दर्ता कोड जारी वा उपनाम सूची हेर्नुहोस्')}</small></span>
              <Icon name="chevron_right" />
            </button>
            <button className="quick-action" onClick={() => onNavigate('notices')} type="button">
              <span className="quick-action-icon quick-action-icon-mint"><Icon name="campaign" /></span>
              <span><strong>{tx(language, 'Publish an NGO Notice', 'संस्थागत सूचना प्रकाशित गर्नुहोस्')}</strong><small>{tx(language, 'Training, employment, financial aid, or practical support', 'तालिम, रोजगारी, आर्थिक सहयोग वा सहायता')}</small></span>
              <Icon name="chevron_right" />
            </button>
            <button className="quick-action" onClick={() => onNavigate('team')} type="button">
              <span className="quick-action-icon quick-action-icon-lavender"><Icon name="groups" /></span>
              <span><strong>{tx(language, 'Manage Caseworker Directory', 'केसकर्मी सूची व्यवस्थापन')}</strong><small>{tx(language, 'View caseworker designations and informational profiles', 'केसकर्मी पद र जानकारी प्रोफाइल हेर्नुहोस्')}</small></span>
              <Icon name="chevron_right" />
            </button>
            <button className="quick-action" onClick={() => onNavigate('messages')} type="button">
              <span className="quick-action-icon quick-action-icon-peach"><Icon name="forum" /></span>
              <span><strong>{tx(language, 'Open message requests', 'सन्देश अनुरोध खोल्नुहोस्')}</strong><small>{tx(language, 'Respond when a Member asks to connect', 'सदस्यको अनुरोधमा जवाफ दिनुहोस्')}</small></span>
              <Icon name="chevron_right" />
            </button>
          </div>
        </Card>

        <Card className="section-card admin-guidance">
          <div className="guidance-icon"><Icon name="shield_lock" size={26} /></div>
          <p className="eyebrow">{tx(language, 'DEMONSTRATION SAFE', 'सुरक्षित नमुना')}</p>
          <h2>{tx(language, 'Privacy-first support', 'गोपनीयता-केन्द्रित सहयोग')}</h2>
          <p>{tx(language, 'Naya Sahara connects women to support without storing court records, offence histories, medical diagnoses, or real identities. All metrics and profiles shown here are demonstration-safe.', 'नयाँ सहाराले कानुनी मुद्दा, कसुर इतिहास, स्वास्थ्य विवरण वा वास्तविक पहिचान नराखी महिलाहरूलाई सहयोगसँग जोड्छ। यहाँ देखाइएका सबै विवरणहरू नमुना र सुरक्षित छन्।')}</p>
          <Badge tone="green">{tx(language, 'Demo safe', 'डेमो सुरक्षित')}</Badge>
        </Card>
      </div>
    </>
  )
}

function AdminNoticeRejectModal({ open, onClose, onConfirm, notice, language }) {
  const [reason, setReason] = useState('')

  if (!open || !notice) return null

  const submit = (e) => {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(notice.id, reason.trim())
    setReason('')
    onClose()
  }

  return (
    <Modal
      description={tx(
        language,
        'Provide a mandatory reason explaining why this notice cannot be published.',
        'यो सूचना किन प्रकाशित गर्न सकिँदैन भन्ने अनिवार्य कारण उल्लेख गर्नुहोस्।',
      )}
      onClose={() => {
        setReason('')
        onClose()
      }}
      open={open}
      title={tx(language, 'Reject Notice (Mandatory Reason)', 'सूचना अस्वीकार (अनिवार्य कारण)')}
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label={tx(language, 'Notice title', 'सूचनाको शीर्षक')}>
          <input className="input-control" disabled value={notice.title} />
        </Field>
        <Field label={tx(language, 'Reason for rejection', 'अस्वीकारको कारण')}>
          <textarea
            className="input-control textarea-control"
            onChange={(e) => setReason(e.target.value)}
            placeholder={tx(
              language,
              'e.g. Missing service location details, unverified contact info, or unclear eligibility criteria.',
              'जस्तै: स्थान नखुलेको, सम्पर्क विवरण अपूर्ण वा योग्यता अस्पष्ट।',
            )}
            required
            rows={3}
            value={reason}
          />
        </Field>
        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">{tx(language, 'Cancel', 'रद्द गर्नुहोस्')}</Button>
          <Button disabled={!reason.trim()} icon="close" type="submit" variant="danger">
            {tx(language, 'Confirm rejection', 'अस्वीकार पुष्टि गर्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PlatformAdminHome({
  organizations = [],
  notices = [],
  associatedMembers = [],
  onNavigate,
  onApproveNotice,
  onRejectNotice,
  _onArchiveNotice,
  _onRestoreNotice,
  _onUnpublishNotice,
  onApproveOrg,
  onRejectOrg,
  onArchiveOrg,
  language,
}) {
  const [adminTab, setAdminTab] = useState('moderation') // 'moderation' | 'ngos' | 'members'
  const [moderationType, setModerationType] = useState('ngo') // 'ngo' | 'gov'
  const [rejectingNotice, setRejectingNotice] = useState(null)

  // Platform Metrics
  const totalNgos = organizations.length
  const verifiedNgos = organizations.filter((item) => item.status === 'approved' || item.verificationStatus === 'verified').length
  const pendingNgos = organizations.filter((item) => item.status === 'pending' || item.verificationStatus === 'pending').length
  const registeredWomenCount = associatedMembers.length
  const activeMembersCount = associatedMembers.filter((item) => item.status === 'Active').length
  const publishedNoticesCount = notices.filter(
    (item) => (item.publicationStatus === 'published' || item.status === 'approved') && (item.reviewStatus === 'approved' || item.status === 'approved'),
  ).length
  // Canonical helper predicate for explicitly submitted notices awaiting review
  const isPendingReviewNotice = (item) =>
    item.publicationStatus === 'unpublished' && item.reviewStatus === 'pending_review'

  const pendingNoticesCount = notices.filter(isPendingReviewNotice).length
  const archivedNoticesCount = notices.filter((item) => item.publicationStatus === 'archived').length

  // Filter pending review queues: exclude drafts, rejected, archived; only explicitly submitted unpublished notices
  const pendingNgoNotices = notices.filter(
    (n) => (n.source === 'ngo' || n.sourceType === 'ngo' || !n.source) && isPendingReviewNotice(n),
  )
  const pendingGovNotices = notices.filter(
    (n) => (n.source === 'gov' || n.sourceType === 'government') && isPendingReviewNotice(n),
  )

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'Platform administration: Review NGO verifications, moderate public notices, and monitor platform metrics.',
          'प्लेटफर्म प्रशासन: संस्था प्रमाणीकरण, सार्वजनिक सूचना समीक्षा र तथ्याङ्क अनुगमन गर्नुहोस्।',
        )}
        eyebrow={tx(language, 'PLATFORM ADMIN', 'प्लेटफर्म प्रशासक')}
        title={tx(language, 'Platform Overview & Moderation', 'प्लेटफर्म सारांश तथा समीक्षा')}
        action={
          <Button icon="campaign" onClick={() => onNavigate('notices')}>
            {tx(language, 'All Public Notices', 'सबै सार्वजनिक सूचना')}
          </Button>
        }
      />

      {/* 8 Platform Overview Metrics */}
      <div className="stat-grid">
        <StatCard
          icon="apartment"
          label={tx(language, 'Total NGOs', 'कुल संस्थाहरू')}
          note={tx(language, 'Registered partners', 'दर्ता भएका साझेदार')}
          tone="lavender"
          value={totalNgos}
        />
        <StatCard
          icon="verified"
          label={tx(language, 'Verified NGOs', 'प्रमाणित संस्थाहरू')}
          note={tx(language, 'Publicly listed', 'सार्वजनिक रूपमा देखिने')}
          tone="green"
          value={verifiedNgos}
        />
        <StatCard
          icon="how_to_reg"
          label={tx(language, 'Pending NGO Verification', 'स्वीकृति बाँकी संस्था')}
          note={tx(language, 'Applications in review', 'समीक्षामा रहेका आवेदन')}
          tone="peach"
          value={pendingNgos}
        />
        <StatCard
          icon="groups"
          label={tx(language, 'Registered Women (Demo)', 'दर्ता महिला (नमुना)')}
          note={tx(language, 'Pseudonymous profiles', 'उपनामयुक्त प्रोफाइल')}
          tone="mint"
          value={registeredWomenCount}
        />
        <StatCard
          icon="how_to_reg"
          label={tx(language, 'Active Members', 'सक्रिय सदस्यहरू')}
          note={tx(language, 'In community roster', 'समुदाय सूचीमा')}
          tone="mint"
          value={activeMembersCount}
        />
        <StatCard
          icon="campaign"
          label={tx(language, 'Published Notices', 'प्रकाशित सूचनाहरू')}
          note={tx(language, 'Active for members', 'सदस्यका लागि उपलब्ध')}
          tone="green"
          value={publishedNoticesCount}
        />
        <StatCard
          icon="hourglass_top"
          label={tx(language, 'Notices in Review', 'समीक्षामा सूचनाहरू')}
          note={tx(language, 'Admin approval required', 'प्रशासक स्वीकृति आवश्यक')}
          tone="peach"
          value={pendingNoticesCount}
        />
        <StatCard
          icon="archive"
          label={tx(language, 'Archived Notices', 'अभिलेख सूचनाहरू')}
          note={tx(language, 'Preserved in archive', 'अभिलेखमा सुरक्षित')}
          tone="neutral"
          value={archivedNoticesCount}
        />
      </div>

      {/* Admin Section Tabs */}
      <div className="notices-main-tabs" role="tablist" style={{ marginTop: '24px' }}>
        <button
          aria-selected={adminTab === 'moderation'}
          className={`notice-tab-btn ${adminTab === 'moderation' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setAdminTab('moderation')}
          role="tab"
          type="button"
        >
          <Icon name="fact_check" size={18} />
          <span>{tx(language, 'Notice Moderation Queues', 'सूचना समीक्षा सूची')}</span>
          <Badge tone={pendingNoticesCount > 0 ? 'peach' : 'neutral'}>{pendingNoticesCount}</Badge>
        </button>

        <button
          aria-selected={adminTab === 'ngos'}
          className={`notice-tab-btn ${adminTab === 'ngos' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setAdminTab('ngos')}
          role="tab"
          type="button"
        >
          <Icon name="apartment" size={18} />
          <span>{tx(language, 'NGO Verification Management', 'संस्था प्रमाणीकरण व्यवस्थापन')}</span>
          <Badge tone={pendingNgos > 0 ? 'peach' : 'neutral'}>{pendingNgos}</Badge>
        </button>

        <button
          aria-selected={adminTab === 'members'}
          className={`notice-tab-btn ${adminTab === 'members' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => setAdminTab('members')}
          role="tab"
          type="button"
        >
          <Icon name="badge" size={18} />
          <span>{tx(language, 'Non-Sensitive Member Directory', 'गैर-संवेदनशील सदस्य निर्देशिका')}</span>
          <Badge tone="lavender">{registeredWomenCount}</Badge>
        </button>
      </div>

      {/* Tab 1: Notice Moderation Queues */}
      {adminTab === 'moderation' && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`filter-pill ${moderationType === 'ngo' ? 'filter-pill-active' : ''}`}
              onClick={() => setModerationType('ngo')}
              type="button"
            >
              <Icon name="handshake" size={16} />
              <span>{tx(language, 'NGO Notices Awaiting Review', 'संस्थागत सूचना समीक्षा सूची')} ({pendingNgoNotices.length})</span>
            </button>
            <button
              className={`filter-pill ${moderationType === 'gov' ? 'filter-pill-active' : ''}`}
              onClick={() => setModerationType('gov')}
              type="button"
            >
              <Icon name="account_balance" size={16} />
              <span>{tx(language, 'Government Notices Awaiting Publication', 'सरकारी सूचना प्रकाशन सूची')} ({pendingGovNotices.length})</span>
            </button>
          </div>

          <div className="notice-list">
            {(moderationType === 'ngo' ? pendingNgoNotices : pendingGovNotices).map((notice) => (
              <Card className="notice-card" key={notice.id}>
                <div className="notice-card-header">
                  <span className={`notice-icon ${notice.source === 'gov' ? 'notice-icon-gov' : 'notice-icon-ngo'}`}>
                    <Icon name={notice.source === 'gov' ? 'account_balance' : 'campaign'} />
                  </span>
                  <div className="notice-heading-copy">
                    <div className="notice-title-line">
                      <h2>{notice.nepaliTitle && language === 'ne' ? notice.nepaliTitle : notice.title}</h2>
                      <Badge tone="peach">{tx(language, 'Pending Review', 'समीक्षा बाँकी')}</Badge>
                      {notice.sourceAuthority && <span className="notice-org-tag"><Icon name="account_balance" size={13} />{notice.sourceAuthority}</span>}
                    </div>
                    <div className="notice-subline">
                      <span><Icon name="location_on" size={14} />{notice.location}</span>
                      <span><Icon name="calendar_month" size={14} />{tx(language, 'Deadline:', 'अन्तिम मिति:')} {notice.deadline}</span>
                    </div>
                  </div>
                </div>

                <div className="notice-content-grid">
                  <div className="notice-content-box">
                    <span className="content-label">{tx(language, 'ORIGINAL PUBLIC NOTICE', 'मूल सार्वजनिक सूचना')}</span>
                    <p>{notice.original}</p>
                  </div>
                  <div className="notice-content-box notice-translation-box">
                    <span className="content-label">
                      {tx(language, 'AI-ASSISTED PLAIN-LANGUAGE EXPLANATION', 'AI-सहयोगित सरल व्याख्या')}
                      <Badge tone="lavender" style={{ marginLeft: '6px' }}>{tx(language, 'Preview', 'पूर्वावलोकन')}</Badge>
                    </span>
                    <p>{notice.simplifiedSummary || notice.nepaliTranslation || notice.translation || notice.original}</p>
                  </div>
                </div>

                <div className="notice-card-footer">
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Icon name="policy" size={14} />
                    {tx(language, 'Admin action required before this notice becomes visible to members or guests.', 'सदस्य वा अतिथिलाई देखिनुअघि प्रशासकको स्वीकृति आवश्यक छ।')}
                  </span>
                  <div className="notice-action-buttons">
                    <Button
                      icon="check_circle"
                      onClick={() => onApproveNotice?.(notice.id)}
                      size="small"
                    >
                      {tx(language, 'Approve & Publish', 'स्वीकृत तथा प्रकाशित')}
                    </Button>
                    <Button
                      icon="cancel"
                      onClick={() => setRejectingNotice(notice)}
                      size="small"
                      variant="danger"
                    >
                      {tx(language, 'Reject with reason', 'कारणसहित अस्वीकार')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {!(moderationType === 'ngo' ? pendingNgoNotices : pendingGovNotices).length && (
              <Card className="empty-card">
                <Icon name="task_alt" size={32} />
                <p style={{ margin: '8px 0 0' }}>
                  <strong>{tx(language, 'All caught up! No notices awaiting moderation in this queue.', 'सबै काम सकियो! यो सूचीमा कुनै समीक्षा बाँकी छैन।')}</strong>
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: NGO Verification Management */}
      {adminTab === 'ngos' && (
        <div style={{ marginTop: '16px' }}>
          <div className="organization-grid">
            {organizations.map((org) => {
              const isVerified = org.status === 'approved' || org.verificationStatus === 'verified'
              const isPending = org.status === 'pending' || org.verificationStatus === 'pending'
              const isArchived = org.status === 'archived' || org.verificationStatus === 'archived'

              return (
                <Card className="organization-card" key={org.id}>
                  <div className="organization-card-heading">
                    <span className="organization-logo">
                      <AssetImage
                        alt={org.name}
                        className="organization-logo-img"
                        fallbackSrc={IMAGE_PLACEHOLDERS.ngo}
                        src={org.logoUrl || IMAGE_PLACEHOLDERS.ngo}
                      />
                    </span>
                    <div className="organization-title">
                      <h2>{org.name}</h2>
                      <span><Icon name="location_on" size={16} />{org.location}</span>
                    </div>
                    {isVerified ? (
                      <Badge dot tone="green">{tx(language, 'Verified', 'प्रमाणित')}</Badge>
                    ) : isArchived ? (
                      <Badge tone="neutral">{tx(language, 'Archived', 'अभिलेख')}</Badge>
                    ) : (
                      <Badge dot tone="peach">{tx(language, 'Pending Verification', 'प्रमाणीकरण बाँकी')}</Badge>
                    )}
                  </div>

                  <p>{org.focus}</p>

                  <div className="member-data-grid" style={{ margin: '8px 0' }}>
                    <div>
                      <span>{tx(language, 'Category', 'वर्ग')}</span>
                      <strong>{org.category || 'Reintegration'}</strong>
                    </div>
                    <div>
                      <span>{tx(language, 'Caseworkers', 'केसकर्मी')}</span>
                      <strong>{org.caseworkerCount || 2}</strong>
                    </div>
                    <div>
                      <span>{tx(language, 'Associated Women', 'सम्बद्ध महिला')}</span>
                      <strong>{org.associatedCount || 3} (Demo)</strong>
                    </div>
                  </div>

                  <div className="organization-card-footer">
                    {isPending && (
                      <>
                        <Button
                          icon="task_alt"
                          onClick={() => onApproveOrg?.(org.id)}
                          size="small"
                        >
                          {tx(language, 'Verify NGO', 'संस्था प्रमाणित')}
                        </Button>
                        <Button
                          icon="cancel"
                          onClick={() => onRejectOrg?.(org.id)}
                          size="small"
                          variant="danger"
                        >
                          {tx(language, 'Reject', 'अस्वीकार')}
                        </Button>
                      </>
                    )}

                    {isVerified && !isArchived && (
                      <Button
                        icon="archive"
                        onClick={() => onArchiveOrg?.(org.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Archive NGO', 'संस्था अभिलेख')}
                      </Button>
                    )}

                    {isArchived && (
                      <Button
                        icon="unarchive"
                        onClick={() => onApproveOrg?.(org.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Restore NGO', 'पुनर्स्थापना')}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Non-Sensitive Member Directory */}
      {adminTab === 'members' && (
        <div style={{ marginTop: '16px' }}>
          <Card className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'METADATA ROSTER', 'मेटाडेटा सूची')}</p>
                <h2>{tx(language, 'Non-Sensitive Pseudonymous Member Roster', 'गैर-संवेदनशील उपनामयुक्त सदस्य सूची')}</h2>
              </div>
            </div>

            <div className="notice-inline notice-inline-info" style={{ marginBottom: '16px' }}>
              <Icon name="shield_lock" />
              <span>
                <strong>{tx(language, 'Strict Privacy Boundary:', 'कडा गोपनीयता सीमा:')}</strong>{' '}
                {tx(
                  language,
                  'Displays non-sensitive pseudonymous metadata only (nickname, avatar, registration date, verifying NGO, account status). Platform Administrators cannot access private messages, handover codes, credentials, or personal case records.',
                  'उपनामयुक्त मेटाडेटा मात्र देखिन्छ (उपनाम, अवतार, दर्ता मिति, प्रमाणीकरण गर्ने संस्था, खाता अवस्था)। प्रशासकहरूलाई निजी च्याट, हस्तान्तरण कोड, पासवर्ड वा कानुनी विवरणमा कुनै पहुँच हुँदैन।',
                )}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {associatedMembers.map((member) => {
                const avatar = MEMBER_AVATAR_OPTIONS.find((a) => a.id === member.avatarId)?.src || IMAGE_PATHS.avatars.avatar1

                return (
                  <div
                    key={member.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '16px',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="avatar">
                        <AssetImage
                          alt={member.nickname}
                          className="avatar-img"
                          fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                          src={avatar}
                        />
                      </span>
                      <div>
                        <strong style={{ fontSize: '15px' }}>{member.nickname}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          <Icon name="badge" size={13} /> {tx(language, 'Pseudonym Identity', 'उपनाम पहिचान')}
                        </div>
                      </div>
                      <Badge dot tone="mint" style={{ marginLeft: 'auto' }}>
                        {member.status || 'Active'}
                      </Badge>
                    </div>

                    <div className="member-data-grid" style={{ fontSize: '12px', marginTop: '4px' }}>
                      <div>
                        <span>{tx(language, 'Registered', 'दर्ता मिति')}</span>
                        <strong>{member.joinedDate || 'Nov 2026'}</strong>
                      </div>
                      <div>
                        <span>{tx(language, 'Verifying NGO', 'प्रमाणीकरण संस्था')}</span>
                        <strong>Asha Sathi Nepal</strong>
                      </div>
                      <div>
                        <span>{tx(language, 'Account Status', 'खाता अवस्था')}</span>
                        <strong>{tx(language, 'Active / Verified', 'सक्रिय / प्रमाणित')}</strong>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Reject Notice Modal */}
      {rejectingNotice && (
        <AdminNoticeRejectModal
          language={language}
          notice={rejectingNotice}
          onClose={() => setRejectingNotice(null)}
          onConfirm={(id, reason) => {
            onRejectNotice?.(id, reason)
            setRejectingNotice(null)
          }}
          open={Boolean(rejectingNotice)}
        />
      )}
    </>
  )
}

function MemberHome({
  language,
  onNavigate,
  claimCode,
  nickname = 'Sajilo',
  memberProfile,
  onUpdateMemberProfile,
  notices = [],
  organizations = [],
}) {
  const [showProfileModal, setShowProfileModal] = useState(false)

  const profile = memberProfile || {
    nickname,
    avatarId: 'avatar1',
    district: 'Lalitpur',
    interests: ['Tailoring', 'Handicrafts'],
    communityOptIn: true,
    showDistrict: true,
    showInterests: true,
    verifyingNgo: 'Asha Sathi Nepal',
    joinedDate: 'Nov 2026',
  }

  const avatarSrc =
    MEMBER_AVATAR_OPTIONS.find((item) => item.id === profile.avatarId)?.src || IMAGE_PATHS.avatars.avatar1

  // Filter approved and published notices only for public/member safety
  const approvedNgoNotices = notices.filter(
    (n) =>
      (n.source === 'ngo' || n.sourceType === 'ngo' || !n.source) &&
      (n.publicationStatus === 'published' || (!n.publicationStatus && n.status === 'approved')) &&
      (n.reviewStatus === 'approved' || (!n.reviewStatus && n.status === 'approved')),
  )
  const approvedGovNotices = notices.filter(
    (n) =>
      (n.source === 'gov' || n.sourceType === 'government') &&
      (n.publicationStatus === 'published' || (!n.publicationStatus && n.status === 'approved')) &&
      (n.reviewStatus === 'approved' || (!n.reviewStatus && n.status === 'approved')),
  )
  const verifiedNgos = organizations.filter((org) => org.status === 'approved' || org.verificationStatus === 'verified')

  return (
    <>
      <PageHeader
        action={
          <Button icon="manage_accounts" onClick={() => setShowProfileModal(true)} variant="secondary">
            {tx(language, 'Profile & Privacy', 'प्रोफाइल र गोपनीयता')}
          </Button>
        }
        description={tx(
          language,
          'Your safe, pseudonymous space. Browse verified support, training notices, and trusted connections in Nepal.',
          'तपाईंको सुरक्षित, उपनामयुक्त व्यक्तिगत क्षेत्र। नेपालभरका प्रमाणित सहयोग, तालिम सूचना र साथी सम्पर्क हेर्नुहोस्।',
        )}
        eyebrow={tx(language, 'MEMBER WORKSPACE', 'सदस्य कार्यस्थल')}
        title={tx(language, `Namaste, ${profile.nickname}`, `नमस्ते, ${profile.nickname}`)}
      />

      {claimCode && (
        <div className="claim-banner">
          <Icon name="key" />
          <div>
            <strong>{tx(language, 'Handover registration verified', 'हस्तान्तरण दर्ता प्रमाणित')}</strong>
            <span>{claimCode} · {tx(language, 'Single-use registration code', 'एकपटक प्रयोग हुने दर्ता कोड')}</span>
          </div>
        </div>
      )}

      {/* Member Banner with Avatar & Overview */}
      <div className="member-welcome">
        <div className="member-welcome-copy">
          <div className="member-avatar-badge-row">
            <span className="member-hero-avatar">
              <AssetImage
                alt={profile.nickname}
                className="member-hero-avatar-img"
                fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                src={avatarSrc}
              />
            </span>
            <div>
              <Badge dot tone="lavender">{tx(language, 'PSEUDONYMOUS MEMBER', 'उपनाम सदस्य')}</Badge>
              <h2 style={{ margin: '4px 0 0' }}>{tx(language, 'A fresh start, at your pace.', 'आफ्नो गतिमा नयाँ सुरुवात।')}</h2>
            </div>
          </div>
          <p>
            {tx(
              language,
              'Access verified support across Nepal. Your profile uses a chosen nickname and illustrated avatar—never your real name, phone, or email.',
              'नेपालभरिका प्रमाणित सहयोगहरू हेर्नुहोस्। तपाईंको खातामा केवल उपनाम र चित्रित अवतार प्रयोग हुन्छ—वास्तविक नाम, फोन वा इमेल कहिल्यै प्रयोग हुँदैन।',
            )}
          </p>
          <div className="member-welcome-actions">
            <Button icon="campaign" onClick={() => onNavigate('notices')}>
              {tx(language, 'Browse notices & support', 'सूचना र सहयोग हेर्नुहोस्')}
            </Button>
            <Button icon="apartment" onClick={() => onNavigate('organizations')} variant="secondary">
              {tx(language, 'Find verified NGOs', 'स्वीकृत संस्थाहरू खोज्नुहोस्')}
            </Button>
          </div>
        </div>

        <div aria-hidden="true" className="welcome-illustration">
          <AssetImage
            alt=""
            className="welcome-illustration-img"
            fallbackSrc={IMAGE_PATHS.illustrations.welcome}
            src={IMAGE_PATHS.illustrations.welcome}
          />
        </div>
      </div>

      {/* 4 Stat Overview for Member */}
      <div className="stat-grid">
        <StatCard
          icon="campaign"
          label={tx(language, 'NGO Opportunities', 'संस्थागत अवसरहरू')}
          note={tx(language, 'Jobs, training & aid', 'रोजगारी, तालिम र सहायता')}
          tone="mint"
          value={approvedNgoNotices.length}
        />
        <StatCard
          icon="account_balance"
          label={tx(language, 'Government Notices', 'सरकारी सूचनाहरू')}
          note={tx(language, 'Verified public grants', 'प्रमाणित सरकारी सूचना')}
          tone="peach"
          value={approvedGovNotices.length}
        />
        <StatCard
          icon="apartment"
          label={tx(language, 'Support NGOs', 'सहयोगी संस्थाहरू')}
          note={tx(language, 'Verified partners in Nepal', 'नेपालका स्वीकृत संस्थाहरू')}
          tone="lavender"
          value={verifiedNgos.length}
        />
        <StatCard
          icon="diversity_3"
          label={tx(language, 'Community Directory', 'समुदाय निर्देशिका')}
          note={profile.communityOptIn ? tx(language, 'Opted-in', 'समावेश हुनुभएको') : tx(language, 'Private / Hidden', 'निजी / लुकाइएको')}
          tone={profile.communityOptIn ? 'mint' : 'lavender'}
          value={profile.communityOptIn ? tx(language, 'Visible', 'देखिने') : tx(language, 'Private', 'निजी')}
        />
      </div>

      {/* Main Member Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Profile Card + Quick Links */}
        <div className="member-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card className="section-card member-info-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'ACCOUNT IDENTITY', 'खाता पहिचान')}</p>
                <h2>{tx(language, 'Your profile & privacy', 'तपाईंको प्रोफाइल र गोपनीयता')}</h2>
              </div>
              <Button icon="edit" onClick={() => setShowProfileModal(true)} size="small" variant="secondary">
                {tx(language, 'Edit', 'सम्पादन')}
              </Button>
            </div>

            <div className="member-profile-summary-header">
              <span className="member-summary-avatar">
                <AssetImage
                  alt={profile.nickname}
                  className="member-summary-avatar-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                  src={avatarSrc}
                />
              </span>
              <div>
                <strong>{profile.nickname}</strong>
                <span className="member-subline-text">
                  <Icon name="location_on" size={14} />
                  {profile.district || 'Lalitpur'}, Nepal
                </span>
              </div>
            </div>

            <div className="member-data-grid">
              <div>
                <span>{tx(language, 'Verifying NGO', 'प्रमाणीकरण गर्ने संस्था')}</span>
                <strong>{profile.verifyingNgo || 'Asha Sathi Nepal'}</strong>
              </div>
              <div>
                <span>{tx(language, 'Membership status', 'सदस्यता अवस्था')}</span>
                <strong>{tx(language, 'Verified Active', 'प्रमाणित सक्रिय')}</strong>
              </div>
              <div>
                <span>{tx(language, 'Community directory', 'समुदाय निर्देशिका')}</span>
                <strong>
                  {profile.communityOptIn
                    ? tx(language, 'Opted-in (Visible)', 'समावेश (देखिने)')
                    : tx(language, 'Hidden (Private)', 'लुकाइएको (निजी)')}
                </strong>
              </div>
              <div>
                <span>{tx(language, 'Peer chat permission', 'साथी च्याट अनुमति')}</span>
                <strong>{tx(language, 'Request-gated', 'अनुरोध स्वीकृतिपछि मात्र')}</strong>
              </div>
            </div>

            {profile.interests && profile.interests.length > 0 && (
              <div className="member-interests-preview">
                <span className="interests-label">{tx(language, 'Skills & Interests:', 'सीप तथा रुचिहरू:')}</span>
                <div className="interests-tags-row">
                  {profile.interests.map((interest) => (
                    <span className="interest-pill" key={interest}>{interest}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="member-consent-note">
              <Icon name="shield_lock" size={17} />
              <span>{tx(language, 'Privacy Guarantee: No court records, offence histories, medical diagnoses, real names, or handover codes are ever public.', 'गोपनीयता प्रत्याभूति: कुनै कानुनी मुद्दा, कसुर इतिहास, स्वास्थ्य विवरण वा वास्तविक नाम कहिल्यै सार्वजनिक गरिँदैन।')}</span>
            </div>
          </Card>

          {/* Suggested Support Categories Card */}
          <Card className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'SUPPORT CATEGORIES', 'सहयोगका वर्गहरू')}</p>
                <h2>{tx(language, 'Explore assistance by category', 'वर्ग अनुसार सहयोग खोज्नुहोस्')}</h2>
              </div>
            </div>
            <div className="support-categories-pills">
              {[
                { name: 'Training', icon: 'school', en: 'Tailoring & Garments', ne: 'सिलाइ तथा कपडा सीप' },
                { name: 'Job', icon: 'work', en: 'Community Employment', ne: 'सामुदायिक रोजगारी' },
                { name: 'Aid', icon: 'volunteer_activism', en: 'Winter Aid & Kits', ne: 'जाडो सहायता तथा किट' },
                { name: 'Workshop', icon: 'psychology', en: 'Small Business Basics', ne: 'साना व्यवसाय कक्षा' },
                { name: 'Rehabilitation', icon: 'favorite', en: 'Crisis Counseling & Shelter', ne: 'आवास तथा परामर्श' },
              ].map((cat) => (
                <button
                  className="category-pill-button"
                  key={cat.name}
                  onClick={() => onNavigate('notices')}
                  type="button"
                >
                  <Icon name={cat.icon} size={18} />
                  <div>
                    <strong>{cat.name}</strong>
                    <small>{tx(language, cat.en, cat.ne)}</small>
                  </div>
                  <Icon name="chevron_right" size={16} />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Recent Notices & Navigation */}
        <div className="member-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recent Approved NGO Notices */}
          <Card className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'RECENT OPPORTUNITIES', 'हालका अवसरहरू')}</p>
                <h2>{tx(language, 'NGO Notices & Programs', 'संस्थागत सूचना तथा कार्यक्रमहरू')}</h2>
              </div>
              <Button onClick={() => onNavigate('notices')} size="small" variant="secondary">
                {tx(language, 'View all', 'सबै हेर्नुहोस्')}
              </Button>
            </div>
            <div className="recent-notices-list">
              {approvedNgoNotices.slice(0, 3).map((notice) => (
                <div className="recent-notice-item" key={notice.id}>
                  <div className="recent-notice-top">
                    <Badge tone="mint">{notice.category || 'Support'}</Badge>
                    <span className="recent-notice-loc"><Icon name="location_on" size={13} />{notice.location}</span>
                  </div>
                  <strong>{language === 'ne' && notice.nepaliTitle ? notice.nepaliTitle : notice.title}</strong>
                  <p>{notice.translation || notice.original}</p>
                  <div className="recent-notice-meta">
                    <span><Icon name="apartment" size={14} />{notice.orgName || 'Asha Sathi Nepal'}</span>
                    <button className="link-button" onClick={() => onNavigate('notices')} type="button">
                      {tx(language, 'Read notice →', 'सूचना पढ्नुहोस् →')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Government Notices */}
          <Card className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'PUBLIC INFORMATION', 'सार्वजनिक जानकारी')}</p>
                <h2>{tx(language, 'Verified Government Notices', 'प्रमाणित सरकारी सूचनाहरू')}</h2>
              </div>
              <Button onClick={() => onNavigate('notices')} size="small" variant="secondary">
                {tx(language, 'View all', 'सबै हेर्नुहोस्')}
              </Button>
            </div>
            <div className="recent-notices-list">
              {approvedGovNotices.slice(0, 2).map((notice) => (
                <div className="recent-notice-item recent-gov-item" key={notice.id}>
                  <div className="recent-notice-top">
                    <Badge tone="peach">{tx(language, 'Government', 'सरकारी')}</Badge>
                    <span className="recent-notice-loc"><Icon name="location_on" size={13} />{notice.location}</span>
                  </div>
                  <strong>{language === 'ne' && notice.nepaliTitle ? notice.nepaliTitle : notice.title}</strong>
                  <p>{notice.translation || notice.original}</p>
                  <div className="recent-notice-meta">
                    <span><Icon name="account_balance" size={14} />{notice.orgName || 'Ministry of Women'}</span>
                    <button className="link-button" onClick={() => onNavigate('notices')} type="button">
                      {tx(language, 'Details & translation →', 'विवरण र अनुवाद →')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Space Navigation */}
          <Card className="section-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{tx(language, 'QUICK NAVIGATION', 'छिटो पहुँच')}</p>
                <h2>{tx(language, 'Explore your member space', 'तपाईंको सदस्य क्षेत्र अन्वेषण')}</h2>
              </div>
            </div>
            <div className="quick-action-list">
              <button className="quick-action" onClick={() => onNavigate('notices')} type="button">
                <span className="quick-action-icon quick-action-icon-peach"><Icon name="campaign" /></span>
                <span>
                  <strong>{tx(language, 'All public notices & opportunities', 'सबै सार्वजनिक सूचना र अवसरहरू')}</strong>
                  <small>{tx(language, 'Filter by category, district, and read simplified translations', 'वर्ग, जिल्ला अनुसार खोज्नुहोस् र अनुवाद पढ्नुहोस्')}</small>
                </span>
                <Icon name="chevron_right" />
              </button>
              <button className="quick-action" onClick={() => onNavigate('organizations')} type="button">
                <span className="quick-action-icon quick-action-icon-mint"><Icon name="apartment" /></span>
                <span>
                  <strong>{tx(language, 'Find verified NGOs', 'स्वीकृत संस्थाहरू खोज्नुहोस्')}</strong>
                  <small>{tx(language, 'Filter organizations offering rehabilitation and skills in Nepal', 'नेपालमा पुनस्र्थापना र सीप सहयोग गर्ने संस्थाहरू')}</small>
                </span>
                <Icon name="chevron_right" />
              </button>
              <button className="quick-action" onClick={() => onNavigate('community')} type="button">
                <span className="quick-action-icon quick-action-icon-lavender"><Icon name="diversity_3" /></span>
                <span>
                  <strong>{tx(language, 'Your community directory', 'तपाईंको समुदाय निर्देशिका')}</strong>
                  <small>{tx(language, 'Pseudonymous directory of women connecting across Nepal', 'उपनामबाट जोडिने महिलाहरूको सुरक्षित निर्देशिका')}</small>
                </span>
                <Icon name="chevron_right" />
              </button>
              <button className="quick-action" onClick={() => onNavigate('messages')} type="button">
                <span className="quick-action-icon quick-action-icon-peach"><Icon name="forum" /></span>
                <span>
                  <strong>{tx(language, 'Private 1:1 messages', 'निजी १:१ सन्देशहरू')}</strong>
                  <small>{tx(language, 'Text-only chats with request-gated safety', 'अनुरोध स्वीकृत भएपछि मात्र खुल्ने सुरक्षित संवाद')}</small>
                </span>
                <Icon name="chevron_right" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      <MemberProfileModal
        language={language}
        onClose={() => setShowProfileModal(false)}
        onSave={onUpdateMemberProfile}
        open={showProfileModal}
        profile={profile}
      />
    </>
  )
}

function GuestHome({ language, onNavigate }) {
  return (
    <>
      <PageHeader
        description={tx(language, 'Browse public support information. Private Member profiles and chats are not available to Guests.', 'सार्वजनिक सहयोग जानकारी हेर्नुहोस्। निजी सदस्य प्रोफाइल र च्याट अतिथिका लागि उपलब्ध छैनन्।')}
        eyebrow={tx(language, 'PUBLIC DIRECTORY', 'सार्वजनिक निर्देशिका')}
        title={tx(language, 'Welcome to Naya Sahara', 'नयाँ सहारामा स्वागत छ')}
      />
      <div className="guest-hero">
        <div className="guest-hero-symbol"><Icon name="volunteer_activism" size={36} /></div>
        <h2>{tx(language, 'Support that stays connected.', 'निरन्तर जोडिएको सहयोग।')}</h2>
        <p>{tx(language, 'Find public notices, training, financial aid, and verified organizations offering support across Nepal.', 'नेपालभर सहयोग गर्ने संस्था, सार्वजनिक सूचना, तालिम र आर्थिक सहायता खोज्नुहोस्।')}</p>
        <div className="guest-hero-actions">
          <Button icon="campaign" onClick={() => onNavigate('notices')}>{tx(language, 'Browse notices', 'सूचनाहरू हेर्नुहोस्')}</Button>
          <Button icon="apartment" onClick={() => onNavigate('organizations')} variant="secondary">{tx(language, 'Find an organization', 'संस्था खोज्नुहोस्')}</Button>
        </div>
      </div>
      <div className="privacy-banner"><div className="privacy-banner-icon"><Icon name="visibility_off" /></div><div><strong>{tx(language, 'Private by design', 'गोपनीयता प्राथमिकता')}</strong><p>{tx(language, 'Guest access is limited to content that an organization or administrator has made public.', 'अतिथि पहुँच संस्था वा प्रशासकले सार्वजनिक गरेको सामग्रीमा मात्र सीमित छ।')}</p></div></div>
    </>
  )
}

export default function Dashboard(props) {
  if (props.role === 'admin') return <PlatformAdminHome {...props} />
  if (props.role === 'member') return <MemberHome {...props} nickname={props.nickname} />
  if (props.role === 'guest') return <GuestHome {...props} />
  return <OrgAdminHome {...props} />
}
