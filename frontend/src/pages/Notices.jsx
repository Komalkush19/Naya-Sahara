import { useMemo, useState } from 'react'
import { AssetImage, Badge, Button, Card, Field, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS } from '../config/images.js'
import { tx } from '../i18n.js'

const NGO_CATEGORIES = [
  'All categories',
  'Training',
  'Job',
  'Aid',
  'Workshop',
  'Education',
  'Rehabilitation',
]

const ADMIN_STATUS_FILTERS = [
  'All statuses',
  'Published',
  'Pending Review',
  'Draft',
  'Archived',
  'Rejected',
]

function AdminRejectModal({ open, onClose, onConfirm, notice, language }) {
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
        'Provide a clear, mandatory reason explaining why this notice cannot be published.',
        'यो सूचना किन प्रकाशित गर्न सकिँदैन भन्ने स्पष्ट र अनिवार्य कारण उल्लेख गर्नुहोस्।',
      )}
      onClose={() => {
        setReason('')
        onClose()
      }}
      open={open}
      title={tx(language, 'Reject notice with mandatory reason', 'कारणसहित सूचना अस्वीकार')}
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label={tx(language, 'Notice title', 'सूचनाको शीर्षक')}>
          <input className="input-control" disabled value={notice.title} />
        </Field>

        <Field label={tx(language, 'Reason for rejection (mandatory)', 'अस्वीकारको कारण (अनिवार्य)')}>
          <textarea
            className="input-control textarea-control"
            onChange={(e) => setReason(e.target.value)}
            placeholder={tx(
              language,
              'e.g. Incomplete eligibility requirements, unverified claims, or missing service contact details.',
              'जस्तै: अपूर्ण योग्यता वा सम्पर्क विवरण नखुलेको।',
            )}
            required
            rows={3}
            value={reason}
          />
        </Field>

        <div className="notice-inline notice-inline-warning">
          <Icon name="info" />
          <span>{tx(language, 'The creating organization will see this reason to make required corrections.', 'संस्थाले यो कारण हेरेर आवश्यक सुधार गरी पुनः पेस गर्न सक्नेछ।')}</span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Cancel', 'रद्द गर्नुहोस्')}
          </Button>
          <Button disabled={!reason.trim()} icon="close" type="submit" variant="danger">
            {tx(language, 'Confirm rejection', 'अस्वीकार पुष्टि गर्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function NoticeDraftModal({
  open,
  onClose,
  onSubmit,
  initialData = null,
  language,
  defaultSource = 'ngo',
  role = 'org',
}) {
  const [source, setSource] = useState(initialData?.source || defaultSource)
  const [category, setCategory] = useState(initialData?.category || 'Training')
  const [title, setTitle] = useState(initialData?.title || '')
  const [original, setOriginal] = useState(initialData?.original || '')
  const [originalLanguage, setOriginalLanguage] = useState(initialData?.originalLanguage || 'ne')
  const [nepaliTranslation, setNepaliTranslation] = useState(initialData?.nepaliTranslation || initialData?.translation || '')
  const [englishTranslation, setEnglishTranslation] = useState(initialData?.englishTranslation || '')
  const [simplifiedSummary, setSimplifiedSummary] = useState(initialData?.simplifiedSummary || '')
  const [location, setLocation] = useState(initialData?.location || '')
  const [eligibility, setEligibility] = useState(initialData?.eligibility || '')
  const [deadline, setDeadline] = useState(initialData?.deadline || '')
  const [sourceAuthority, setSourceAuthority] = useState(initialData?.sourceAuthority || '')
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl || '')
  const [ocrNoticeMessage, setOcrNoticeMessage] = useState('')

  const close = () => {
    setTitle('')
    setOriginal('')
    setNepaliTranslation('')
    setEnglishTranslation('')
    setSimplifiedSummary('')
    setLocation('')
    setEligibility('')
    setDeadline('')
    setSourceAuthority('')
    setSourceUrl('')
    setOcrNoticeMessage('')
    onClose()
  }

  // Simulated OCR / PDF extraction handler (honestly labelled as simulated demonstration)
  const handleSimulatedOcr = () => {
    setTitle('Vocational Skills Training Stipend Notice (Scanned Gazette Demo)')
    setSource('gov')
    setSourceAuthority('Ministry of Women, Children and Senior Citizens (Demonstration metadata)')
    setSourceUrl('') // As instructed: Use sourceUrl: null if no official source has been verified; never fabricate link
    setOriginalLanguage('ne')
    setLocation('Bagmati Province')
    setEligibility('Adult women community members; verify through local district social office.')
    setDeadline('Dec 30, 2026')
    setOriginal(
      'नेपाल सरकार महिला, बालबालिका तथा ज्येष्ठ नागरिक मन्त्रालयको राजपत्र सूचना अनुसार पुनर्स्थापना केन्द्रहरूलाई लक्षित गरी आयआर्जनमूलक व्यावसायिक अनुदान विनियोजन गरिएको छ। (Scanned PDF OCR Demo Extract)',
    )
    setNepaliTranslation('आयआर्जनमूलक सीप विकासका लागि प्रादेशिक व्यावसायिक तालिम भत्ताका लागि आवेदन खुला गरिएको छ।')
    setEnglishTranslation('Provincial vocational training stipends announced to support women in income-generating livelihoods.')
    setSimplifiedSummary('सरकारी व्यावसायिक तालिम अनुदान सूचना। स्थानीय सामाजिक विकास कार्यालयमार्फत आवेदन दिन सकिनेछ।')
    setOcrNoticeMessage(
      tx(
        language,
        'Draft populated from simulated OCR demonstration. All extracted fields are editable and remain unpublished until admin verification.',
        'सिम्युलेटेड OCR डेमोबाट मस्यौदा भरियो। सबै विवरणहरू सम्पादनयोग्य छन् र प्रशासकीय प्रमाणीकरण नभएसम्म प्रकाशित हुँदैनन्।',
      ),
    )
  }

  const handleAction = (asDraft) => {
    if (!title.trim() || !original.trim()) return
    onSubmit(
      {
        source,
        sourceType: source === 'gov' ? 'government' : 'ngo',
        category: source === 'ngo' ? category : 'General',
        title: title.trim(),
        original: original.trim(),
        originalLanguage,
        nepaliTranslation: nepaliTranslation.trim() || original.trim(),
        englishTranslation: englishTranslation.trim(),
        simplifiedSummary: simplifiedSummary.trim(),
        translation: nepaliTranslation.trim() || original.trim(),
        location: location.trim() || 'Bagmati Province',
        eligibility: eligibility.trim() || 'Open to all community members.',
        deadline: deadline.trim() || 'Open',
        sourceAuthority: sourceAuthority.trim() || (source === 'gov' ? 'Government of Nepal (Demo attribution)' : 'NGO Partner'),
        sourceUrl: sourceUrl.trim() || null,
        isSyntheticDemo: true,
        aiGenerated: Boolean(nepaliTranslation || englishTranslation || simplifiedSummary),
        reviewStatus: role === 'admin' && !asDraft ? 'approved' : 'pending_review',
        publicationStatus: asDraft ? 'draft' : role === 'admin' ? 'published' : 'unpublished',
        status: asDraft ? 'draft' : role === 'admin' ? 'approved' : 'pending_review',
      },
      asDraft,
    )
    close()
  }

  return (
    <Modal
      description={tx(
        language,
        'Enter public notice details. Preserve original notice text separately from translations and plain-language summaries.',
        'सार्वजनिक सूचना विवरण राख्नुहोस्। मूल सूचनाको पाठ अनुवाद र सरल व्याख्याभन्दा छुट्टै राख्नुपर्छ।',
      )}
      onClose={close}
      open={open}
      size="large"
      title={
        initialData
          ? tx(language, 'Edit notice', 'सूचना सम्पादन')
          : tx(language, 'Create public notice', 'सार्वजनिक सूचना सिर्जना')
      }
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault()
          handleAction(false)
        }}
      >
        {/* Simulated OCR Demo Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f0eb', padding: '10px 14px', borderRadius: '8px' }}>
          <div>
            <strong style={{ fontSize: '13px' }}>{tx(language, 'Simulated PDF / Gazette OCR Extract (Demo)', 'नमुना PDF / राजपत्र OCR पाठ संकलन (डेमो)')}</strong>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              {tx(language, 'Demonstrates accessibility ingestion from public gazette scans without live cloud processing.', 'क्लाउड प्रशोधन बिना सार्वजनिक राजपत्रबाट नमुना पाठ संकलनको प्रदर्शन।')}
            </p>
          </div>
          <Button icon="document_scanner" onClick={handleSimulatedOcr} size="small" type="button" variant="secondary">
            {tx(language, 'Run OCR Demo', 'OCR डेमो चलाउनुहोस्')}
          </Button>
        </div>

        {ocrNoticeMessage && (
          <div className="notice-inline notice-inline-info">
            <Icon name="verified_user" />
            <span>{ocrNoticeMessage}</span>
          </div>
        )}

        <div className="form-row">
          <Field label={tx(language, 'Notice type', 'सूचनाको प्रकार')}>
            <select
              className="input-control"
              disabled={role === 'org'}
              onChange={(e) => setSource(e.target.value)}
              value={source}
            >
              <option value="ngo">{tx(language, 'NGO Notice / Opportunity', 'संस्थागत सूचना / अवसर')}</option>
              {role === 'admin' && <option value="gov">{tx(language, 'Government Notice', 'सरकारी सूचना')}</option>}
            </select>
          </Field>

          {source === 'ngo' ? (
            <Field label={tx(language, 'Category', 'वर्ग')}>
              <select
                className="input-control"
                onChange={(e) => setCategory(e.target.value)}
                value={category}
              >
                {NGO_CATEGORIES.slice(1).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={tx(language, 'Original Language', 'मूल भाषा')}>
              <select
                className="input-control"
                onChange={(e) => setOriginalLanguage(e.target.value)}
                value={originalLanguage}
              >
                <option value="ne">Nepali (नेपाली)</option>
                <option value="en">English</option>
              </select>
            </Field>
          )}
        </div>

        <Field label={tx(language, 'Notice title', 'सूचनाको शीर्षक')}>
          <input
            className="input-control"
            onChange={(event) => setTitle(event.target.value)}
            placeholder={tx(language, 'e.g. Vocational skills grant notice', 'जस्तै: सीप विकास अनुदान सूचना')}
            required
            value={title}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Source Authority / Issuing Body', 'जारी गर्ने आधिकारिक निकाय')}>
            <input
              className="input-control"
              onChange={(e) => setSourceAuthority(e.target.value)}
              placeholder="e.g. Ministry of Women, Children and Senior Citizens"
              value={sourceAuthority}
            />
          </Field>
          <Field label={tx(language, 'Source URL (Leave blank if unverified in demo)', 'स्रोत लिङ्क (प्रमाणित नभए खाली छोड्नुहोस्)')}>
            <input
              className="input-control"
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Official portal URL only, or leave empty"
              value={sourceUrl}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Original Public Text (Official Gazette / Flyer Text)', 'मूल सार्वजनिक पाठ (राजपत्र वा सूचनाको मूल पाठ)')}>
          <textarea
            className="input-control textarea-control"
            onChange={(event) => setOriginal(event.target.value)}
            placeholder={tx(language, 'Paste exact official public notification text…', 'आधिकारिक सूचनाको मूल पाठ राख्नुहोस्…')}
            required
            rows={3}
            value={original}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Nepali Translation / Plain-Language Version', 'नेपाली सरल व्याख्या / अनुवाद')}>
            <textarea
              className="input-control textarea-control"
              onChange={(event) => setNepaliTranslation(event.target.value)}
              placeholder={tx(language, 'Accessible Nepali explanation in plain words…', 'सजिलो नेपाली भाषामा स्पष्ट व्याख्या…')}
              rows={2}
              value={nepaliTranslation}
            />
          </Field>

          <Field label={tx(language, 'English Translation (Optional)', 'अंग्रेजी अनुवाद (ऐच्छिक)')}>
            <textarea
              className="input-control textarea-control"
              onChange={(event) => setEnglishTranslation(event.target.value)}
              placeholder="Clear English translation of the notice…"
              rows={2}
              value={englishTranslation}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Plain-Language Summary (Short & Simple)', 'छोटो तथा सरल सारांश')}>
          <input
            className="input-control"
            onChange={(e) => setSimplifiedSummary(e.target.value)}
            placeholder={tx(language, 'One-sentence simple summary for quick understanding…', 'छिटो बुझ्नका लागि एक वाक्यको सरल सारांश…')}
            value={simplifiedSummary}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Location', 'स्थान')}>
            <input
              className="input-control"
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Lalitpur, Bagmati"
              value={location}
            />
          </Field>
          <Field label={tx(language, 'Deadline / Date', 'अन्तिम मिति')}>
            <input
              className="input-control"
              onChange={(event) => setDeadline(event.target.value)}
              placeholder="e.g. Dec 25, 2026"
              value={deadline}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Eligibility / Requirements', 'योग्यता / आवश्यकता')}>
          <input
            className="input-control"
            onChange={(event) => setEligibility(event.target.value)}
            placeholder="e.g. Open to all women in community"
            value={eligibility}
          />
        </Field>

        {initialData?.reviewStatus === 'approved' && role === 'org' && (
          <div className="notice-inline notice-inline-warning">
            <Icon name="info" />
            <span>
              {tx(
                language,
                'Saving edits to an already approved notice will return it to Admin review and unpublish it.',
                'स्वीकृत सूचना सम्पादन गर्दा पुनः प्रशासकीय समीक्षामा जानेछ र अप्रकाशित हुनेछ।',
              )}
            </span>
          </div>
        )}

        <div className="notice-inline notice-inline-info">
          <Icon name="verified_user" />
          <span>{tx(language, 'All public notices require Admin review before publication. No personal or court case records.', 'सबै सार्वजनिक सूचना प्रशासकीय समीक्षापछि मात्र प्रकाशित हुन्छन्।')}</span>
        </div>

        <div className="modal-actions modal-actions-split">
          <Button onClick={close} type="button" variant="secondary">{tx(language, 'Cancel', 'रद्द गर्नुहोस्')}</Button>
          <div className="button-group-end">
            <Button
              icon="save"
              onClick={() => handleAction(true)}
              type="button"
              variant="secondary"
            >
              {tx(language, 'Save as draft', 'मस्यौदा बचत')}
            </Button>
            <Button icon={role === 'admin' ? 'publish' : 'send'} type="submit">
              {role === 'admin'
                ? tx(language, 'Approve & Publish', 'स्वीकृत तथा प्रकाशित')
                : tx(language, 'Submit for review', 'समीक्षाका लागि पेस')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function NoticeDetailModal({ open, onClose, notice, language }) {
  const [viewMode, setViewMode] = useState('simplified') // 'simplified' | 'original' | 'english'
  const [speechActive, setSpeechActive] = useState(false)

  if (!open || !notice) return null

  const isGov = notice.source === 'gov' || notice.sourceType === 'government'

  const readContent = () => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return
    window.speechSynthesis.cancel()

    let textToRead
    let lang

    if (viewMode === 'english' && notice.englishTranslation) {
      textToRead = `${notice.title}. ${notice.englishTranslation}`
      lang = 'en-US'
    } else if (viewMode === 'original') {
      textToRead = `${notice.title}. ${notice.original}`
      lang = notice.originalLanguage === 'en' ? 'en-US' : 'ne-NP'
    } else {
      textToRead = `${notice.nepaliTitle || notice.title}. ${notice.simplifiedSummary || notice.nepaliTranslation || notice.translation || notice.original}`
      lang = 'ne-NP'
    }

    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.lang = lang
    utterance.onend = () => setSpeechActive(false)
    utterance.onerror = () => setSpeechActive(false)
    setSpeechActive(true)
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeechActive(false)
  }

  return (
    <Modal
      description={tx(
        language,
        'Full notice text, source attribution, and accessible plain-language translation.',
        'पूर्ण सूचना पाठ, आधिकारिक स्रोत विवरण र सरल भाषामा व्याख्या।',
      )}
      onClose={() => {
        stopSpeech()
        onClose()
      }}
      open={open}
      size="large"
      title={notice.nepaliTitle && language === 'ne' ? notice.nepaliTitle : notice.title}
    >
      <div className="form-stack">
        {/* Source and Verification Banner */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isGov ? (
              <Badge tone="peach">{tx(language, 'Verified Government Notice', 'प्रमाणित सरकारी सूचना')}</Badge>
            ) : (
              <Badge tone="mint">{tx(language, 'Verified NGO Notice', 'प्रमाणित संस्थागत सूचना')}</Badge>
            )}
            <Badge tone="neutral">{notice.category || 'Public Support'}</Badge>
            <Badge tone="lavender">{tx(language, 'Demonstration Record', 'नमुना अभिलेख')}</Badge>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <Button
              icon={speechActive ? 'volume_off' : 'record_voice_over'}
              onClick={speechActive ? stopSpeech : readContent}
              size="small"
              variant={speechActive ? 'danger' : 'secondary'}
            >
              {speechActive ? tx(language, 'Stop listening', 'रोक्नुहोस्') : tx(language, 'Listen (Read-Aloud)', 'सुन्नुहोस्')}
            </Button>
          </div>
        </div>

        {/* Provenance Metadata Grid */}
        <div className="member-data-grid" style={{ margin: '4px 0' }}>
          <div>
            <span>{tx(language, 'Issuing Authority', 'जारी गर्ने निकाय')}</span>
            <strong>{notice.sourceAuthority || notice.orgName || (isGov ? 'Government of Nepal' : 'NGO')}</strong>
          </div>
          <div>
            <span>{tx(language, 'Location', 'स्थान')}</span>
            <strong>{notice.location || 'Nepal'}</strong>
          </div>
          <div>
            <span>{tx(language, 'Publication Date', 'प्रकाशन मिति')}</span>
            <strong>{notice.publicationDate || 'Nov 2026 (Demo)'}</strong>
          </div>
          <div>
            <span>{tx(language, 'Ingestion Date', 'संकलन मिति')}</span>
            <strong>{notice.ingestionDate || 'Nov 2026 (Demo)'}</strong>
          </div>
        </div>

        {/* Verified Source URL or honest demonstration fallback */}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          <strong>{tx(language, 'Official Source Link:', 'आधिकारिक स्रोत लिङ्क:')}</strong>{' '}
          {notice.sourceUrl ? (
            <a href={notice.sourceUrl} rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }} target="_blank">
              {notice.sourceUrl}
            </a>
          ) : (
            <span>{tx(language, 'None provided in synthetic demonstration (sourceUrl: null).', 'नमुना प्रदर्शनमा कुनै बाह्य लिङ्क समावेश छैन (sourceUrl: null)।')}</span>
          )}
        </div>

        {/* Content View Mode Switcher */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: '8px' }}>
          <button
            className={`filter-pill ${viewMode === 'simplified' ? 'filter-pill-active' : ''}`}
            onClick={() => setViewMode('simplified')}
            type="button"
          >
            {tx(language, 'Plain-Language Simplification (Nepali)', 'नेपाली सरल व्याख्या')}
          </button>
          <button
            className={`filter-pill ${viewMode === 'original' ? 'filter-pill-active' : ''}`}
            onClick={() => setViewMode('original')}
            type="button"
          >
            {tx(language, 'Original Public Text', 'मूल सार्वजनिक पाठ')}
          </button>
          {notice.englishTranslation && (
            <button
              className={`filter-pill ${viewMode === 'english' ? 'filter-pill-active' : ''}`}
              onClick={() => setViewMode('english')}
              type="button"
            >
              English Translation
            </button>
          )}
        </div>

        {/* Content Display Card */}
        <div style={{ background: viewMode === 'original' ? '#fdfcf9' : '#f8f9fa', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              {viewMode === 'original'
                ? tx(language, 'Official Notification Text (Unaltered)', 'आधिकारिक सार्वजनिक सूचना पाठ')
                : viewMode === 'english'
                  ? 'English Translation'
                  : tx(language, 'Plain-Language Explanation', 'सरल भाषामा स्पष्टीकरण')}
            </span>
            {viewMode !== 'original' && (
              <Badge tone="lavender">{tx(language, 'AI-Assisted Simplification', 'AI-सहयोगित सरल व्याख्या')}</Badge>
            )}
            {viewMode === 'original' && (
              <Badge tone="neutral">{tx(language, 'Original Official Record', 'मूल आधिकारिक अभिलेख')}</Badge>
            )}
          </div>

          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {viewMode === 'original'
              ? notice.original
              : viewMode === 'english'
                ? notice.englishTranslation || notice.translation || notice.original
                : notice.simplifiedSummary || notice.nepaliTranslation || notice.translation || notice.original}
          </p>
        </div>

        {/* Structured Requirements */}
        <div className="notice-extracted" style={{ marginTop: '8px' }}>
          <span><Icon name="checklist" size={16} /><strong>{tx(language, 'Eligibility', 'योग्यता')}:</strong> {notice.eligibility || 'Open to community members'}</span>
          <span><Icon name="calendar_month" size={16} /><strong>{tx(language, 'Deadline', 'अन्तिम मिति')}:</strong> {notice.deadline || 'Open'}</span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">{tx(language, 'Close', 'बन्द गर्नुहोस्')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function readNotice(notice, language) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false
  const textToRead = `${notice.nepaliTitle && language === 'ne' ? notice.nepaliTitle : notice.title}. ${notice.simplifiedSummary || notice.nepaliTranslation || notice.translation || notice.original}`
  const utterance = new SpeechSynthesisUtterance(textToRead)
  utterance.lang = language === 'ne' ? 'ne-NP' : 'en-US'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

export default function NoticesPage({
  notices = [],
  role,
  onCreateNotice,
  onUpdateNotice,
  onDeleteNotice,
  onSubmitForReview,
  onApprove,
  onReject,
  onArchiveNotice,
  onRestoreNotice,
  onUnpublishNotice,
  language,
}) {
  const [activeTab, setActiveTab] = useState('ngo') // 'ngo' | 'gov'
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [adminStatusFilter, setAdminStatusFilter] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingNotice, setEditingNotice] = useState(null)
  const [selectedDetailNotice, setSelectedDetailNotice] = useState(null)
  const [rejectingNotice, setRejectingNotice] = useState(null)
  const [speechStatus, setSpeechStatus] = useState('')

  const isAdmin = role === 'admin'
  const isOrg = role === 'org'

  // Voice Search / Speech-to-Text Handler (with honest browser support check)
  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechStatus(
        tx(
          language,
          'Speech recognition is not supported in this browser. Please type your search query.',
          'यो ब्राउजरमा आवाज पहिचान (Speech-to-text) उपलब्ध छैन। कृपया किबोर्डबाट खोज्नुहोस्।',
        ),
      )
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = language === 'ne' ? 'ne-NP' : 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      setSpeechStatus(tx(language, 'Listening… Speak your search query.', 'सुन्दैछ… आफ्नो खोजी बोल्नुहोस्।'))

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript
        if (transcript) {
          setQuery(transcript)
          setSpeechStatus(
            tx(
              language,
              `Search set from voice: "${transcript}"`,
              `आवाजबाट खोजी सेट भयो: "${transcript}"`,
            ),
          )
        }
      }

      recognition.onerror = (event) => {
        setSpeechStatus(
          tx(
            language,
            `Speech recognition notice: ${event.error}. Please type your query.`,
            `आवाज पहिचान समस्या: ${event.error}। कृपया लेखेर खोज्नुहोस्।`,
          ),
        )
      }

      recognition.start()
    } catch {
      setSpeechStatus(
        tx(
          language,
          'Could not start microphone. Please check browser permissions.',
          'माइक्रोफोन सुरु हुन सकेन। कृपया ब्राउजर अनुमति जाँच्नुहोस्।',
        ),
      )
    }
  }

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const isNoticePublished =
        (notice.publicationStatus === 'published' || (!notice.publicationStatus && notice.status === 'approved')) &&
        (notice.reviewStatus === 'approved' || (!notice.reviewStatus && notice.status === 'approved'))

      // Visibility Rules:
      // Members/Guests ONLY see approved & published notices!
      // NGOs see their own notices (all statuses: draft, pending_review, approved, rejected, archived) plus approved gov notices
      // Admins see all notices (draft, pending_review, approved, rejected, archived)
      if (!isAdmin && !isOrg && !isNoticePublished) return false
      if (isOrg && (notice.source === 'gov' || notice.sourceType === 'government') && !isNoticePublished) return false

      // Tab match
      const isGovSource = notice.source === 'gov' || notice.sourceType === 'government'
      const sourceMatch = activeTab === 'gov' ? isGovSource : !isGovSource
      if (!sourceMatch) return false

      // Admin Status Filter
      if (isAdmin && adminStatusFilter !== 'All statuses') {
        if (adminStatusFilter === 'Published' && notice.publicationStatus !== 'published' && notice.status !== 'approved') return false
        if (adminStatusFilter === 'Pending Review') {
          if (notice.publicationStatus !== 'unpublished' || notice.reviewStatus !== 'pending_review') {
            return false
          }
        }
        if (adminStatusFilter === 'Draft' && notice.publicationStatus !== 'draft' && notice.status !== 'draft') return false
        if (adminStatusFilter === 'Archived' && notice.publicationStatus !== 'archived' && notice.status !== 'archived') return false
        if (adminStatusFilter === 'Rejected' && notice.reviewStatus !== 'rejected' && notice.status !== 'rejected') return false
      }

      // Category filter (applicable for NGO notices)
      if (activeTab === 'ngo' && categoryFilter !== 'All categories' && notice.category !== categoryFilter) {
        return false
      }

      // Keyword query
      if (query.trim()) {
        const q = query.toLowerCase()
        const text = `${notice.title} ${notice.nepaliTitle || ''} ${notice.location || ''} ${notice.original || ''} ${notice.translation || ''} ${notice.nepaliTranslation || ''} ${notice.englishTranslation || ''} ${notice.category || ''} ${notice.rejectionReason || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      return true
    })
  }, [notices, isAdmin, isOrg, activeTab, adminStatusFilter, categoryFilter, query])

  const ngoCount = notices.filter((n) => {
    const isGov = n.source === 'gov' || n.sourceType === 'government'
    if (isGov) return false
    if (!isAdmin && !isOrg) {
      return (n.publicationStatus === 'published' || (!n.publicationStatus && n.status === 'approved')) &&
             (n.reviewStatus === 'approved' || (!n.reviewStatus && n.status === 'approved'))
    }
    return true
  }).length

  const govCount = notices.filter((n) => {
    const isGov = n.source === 'gov' || n.sourceType === 'government'
    if (!isGov) return false
    if (!isAdmin && !isOrg) {
      return (n.publicationStatus === 'published' || (!n.publicationStatus && n.status === 'approved')) &&
             (n.reviewStatus === 'approved' || (!n.reviewStatus && n.status === 'approved'))
    }
    return true
  }).length

  const getStatusBadge = (notice) => {
    const pubStatus = notice.publicationStatus || (notice.status === 'approved' ? 'published' : 'draft')
    const revStatus = notice.reviewStatus || (notice.status === 'approved' ? 'approved' : notice.status === 'rejected' ? 'rejected' : 'pending_review')

    if (pubStatus === 'archived') {
      return <Badge dot tone="neutral">{tx(language, 'Archived', 'अभिलेख')}</Badge>
    }
    if (pubStatus === 'published' && revStatus === 'approved') {
      return <Badge dot tone="green">{tx(language, 'Published', 'प्रकाशित')}</Badge>
    }
    if (pubStatus === 'unpublished') {
      return <Badge dot tone="peach">{tx(language, 'Unpublished', 'अप्रकाशित')}</Badge>
    }
    if (revStatus === 'rejected') {
      return <Badge dot tone="rose">{tx(language, 'Rejected', 'अस्वीकृत')}</Badge>
    }
    if (pubStatus === 'draft') {
      return <Badge dot tone="neutral">{tx(language, 'Draft', 'मस्यौदा')}</Badge>
    }
    return <Badge dot tone="peach">{tx(language, 'Pending Review', 'समीक्षा बाँकी')}</Badge>
  }

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'Browse public NGO opportunities, training programs, financial aid, and verified government notices across Nepal.',
          'नेपालभरिका गैरसरकारी संस्थाका अवसर, तालिम कार्यक्रम, आर्थिक सहयोग र प्रमाणित सरकारी सूचनाहरू हेर्नुहोस्।',
        )}
        eyebrow={tx(language, 'PUBLIC INFORMATION', 'सार्वजनिक जानकारी')}
        title={tx(language, 'Notices & Support Opportunities', 'सूचना तथा सहयोगका अवसरहरू')}
        action={
          (isAdmin || isOrg) && (
            <Button icon="add" onClick={() => setShowNew(true)}>
              {isAdmin ? tx(language, 'Add notice', 'सूचना थप्नुहोस्') : tx(language, 'Create NGO notice', 'संस्थागत सूचना सिर्जना')}
            </Button>
          )
        }
      />

      {speechStatus && (
        <div aria-live="polite" className="speech-status">
          <Icon name="record_voice_over" size={18} />
          <span>{speechStatus}</span>
          <button aria-label="Dismiss" className="plain-icon-button" onClick={() => setSpeechStatus('')} type="button">
            <Icon name="close" size={17} />
          </button>
        </div>
      )}

      {/* Main Section Tabs: NGO Notices vs Government Notices */}
      <div className="notices-main-tabs" role="tablist">
        <button
          aria-selected={activeTab === 'ngo'}
          className={`notice-tab-btn ${activeTab === 'ngo' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => { setActiveTab('ngo'); setCategoryFilter('All categories') }}
          role="tab"
          type="button"
        >
          <Icon name="handshake" size={18} />
          <span>{tx(language, 'NGO Notices & Opportunities', 'संस्थागत सूचना तथा अवसरहरू')}</span>
          <Badge tone={activeTab === 'ngo' ? 'lavender' : 'neutral'}>{ngoCount}</Badge>
        </button>

        <button
          aria-selected={activeTab === 'gov'}
          className={`notice-tab-btn ${activeTab === 'gov' ? 'notice-tab-btn-active' : ''}`}
          onClick={() => { setActiveTab('gov'); setCategoryFilter('All categories') }}
          role="tab"
          type="button"
        >
          <Icon name="account_balance" size={18} />
          <span>{tx(language, 'Government Notices', 'सरकारी सूचनाहरू')}</span>
          <Badge tone={activeTab === 'gov' ? 'peach' : 'neutral'}>{govCount}</Badge>
        </button>
      </div>

      <div className="list-toolbar">
        <div className="search-field" style={{ display: 'flex', alignItems: 'center' }}>
          <Icon name="search" />
          <input
            aria-label={tx(language, 'Search notices', 'सूचना खोज्नुहोस्')}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tx(language, 'Search by title, location, or keywords…', 'शीर्षक, स्थान वा शब्द खोज्नुहोस्…')}
            value={query}
          />
          {/* Honest Speech-to-Text Microphone button */}
          <button
            className="plain-icon-button"
            onClick={handleVoiceSearch}
            style={{ marginRight: '6px' }}
            title={tx(language, 'Voice search (Speech-to-text)', 'आवाजबाट खोजी (Speech-to-text)')}
            type="button"
          >
            <Icon name="mic" size={19} />
          </button>
        </div>

        {/* Category filter for NGO notices */}
        {activeTab === 'ngo' && (
          <div aria-label={tx(language, 'Filter by category', 'वर्ग अनुसार छान्नुहोस्')} className="filter-pills" role="group">
            {NGO_CATEGORIES.map((cat) => (
              <button
                aria-pressed={categoryFilter === cat}
                className={categoryFilter === cat ? 'filter-pill filter-pill-active' : 'filter-pill'}
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Status filters for Platform Admin */}
        {isAdmin && (
          <div aria-label="Admin Status Filter" className="filter-pills" role="group">
            {ADMIN_STATUS_FILTERS.map((st) => (
              <button
                aria-pressed={adminStatusFilter === st}
                className={adminStatusFilter === st ? 'filter-pill filter-pill-active' : 'filter-pill'}
                key={st}
                onClick={() => setAdminStatusFilter(st)}
                type="button"
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="notice-list">
        {filteredNotices.map((notice) => {
          const isGov = notice.source === 'gov' || notice.sourceType === 'government'
          const isPublished = (notice.publicationStatus === 'published' || (!notice.publicationStatus && notice.status === 'approved'))
          const isArchived = notice.publicationStatus === 'archived'

          return (
            <Card className="notice-card" key={notice.id}>
              <div className="notice-card-header">
                <span className={`notice-icon ${isGov ? 'notice-icon-gov' : 'notice-icon-ngo'}`}>
                  <Icon name={isGov ? 'account_balance' : 'campaign'} />
                </span>
                <div className="notice-heading-copy">
                  <div className="notice-title-line">
                    <h2>{language === 'ne' && notice.nepaliTitle ? notice.nepaliTitle : notice.title}</h2>
                    {notice.category && (
                      <Badge tone="mint">{notice.category}</Badge>
                    )}
                    {getStatusBadge(notice)}
                  </div>
                  <div className="notice-subline">
                    {notice.sourceAuthority && <span className="notice-org-tag"><Icon name={isGov ? 'account_balance' : 'apartment'} size={14} />{notice.sourceAuthority}</span>}
                    {!notice.sourceAuthority && notice.orgName && <span className="notice-org-tag"><Icon name="apartment" size={14} />{notice.orgName}</span>}
                    <span><Icon name="location_on" size={14} />{notice.location}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="read-button"
                    onClick={() =>
                      setSpeechStatus(
                        readNotice(notice, language)
                          ? tx(language, 'Read-aloud started on your device.', 'तपाईंको उपकरणमा पढ्न सुरु भयो।')
                          : tx(language, 'Read-aloud is not supported on this browser.', 'यो ब्राउजरमा पढेर सुनाउने सुविधा छैन।'),
                      )
                    }
                    type="button"
                  >
                    <Icon name="record_voice_over" size={18} />
                    <span>{tx(language, 'Listen', 'सुन्नुहोस्')}</span>
                  </button>
                  <Button
                    icon="open_in_new"
                    onClick={() => setSelectedDetailNotice(notice)}
                    size="small"
                    variant="secondary"
                  >
                    {tx(language, 'Details', 'विवरण')}
                  </Button>
                </div>
              </div>

              <div className="notice-content-grid">
                <div className="notice-content-box">
                  <span className="content-label">{tx(language, 'ORIGINAL PUBLIC TEXT', 'मूल सार्वजनिक सूचना')}</span>
                  <p>{notice.original}</p>
                </div>
                <div className="notice-content-box notice-translation-box">
                  <span className="content-label">
                    {tx(language, 'SIMPLIFIED PLAIN-LANGUAGE', 'सरल व्याख्या')}
                    <Badge tone="lavender" style={{ marginLeft: '6px' }}>{tx(language, 'AI-Assisted', 'AI-सहयोगित')}</Badge>
                  </span>
                  <p>{notice.simplifiedSummary || notice.nepaliTranslation || notice.translation || notice.original}</p>
                </div>
              </div>

              <div className="notice-extracted">
                <span><Icon name="location_on" size={16} /><strong>{tx(language, 'Location', 'स्थान')}:</strong> {notice.location}</span>
                <span><Icon name="checklist" size={16} /><strong>{tx(language, 'Eligibility', 'योग्यता')}:</strong> {notice.eligibility}</span>
                <span><Icon name="calendar_month" size={16} /><strong>{tx(language, 'Deadline', 'अन्तिम मिति')}:</strong> {notice.deadline}</span>
              </div>

              {notice.reviewStatus === 'rejected' && notice.rejectionReason && (
                <div className="notice-inline notice-inline-danger">
                  <Icon name="report" />
                  <span>
                    <strong>{tx(language, 'Rejection reason: ', 'अस्वीकारको कारण: ')}</strong>
                    {notice.rejectionReason}
                  </span>
                </div>
              )}

              {/* Admin Moderation Controls */}
              {isAdmin && (
                <div className="notice-card-footer">
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <strong>{tx(language, 'Review Status:', 'समीक्षा स्थिति:')}</strong> {notice.reviewStatus || 'pending_review'} · <strong>{tx(language, 'Publication:', 'प्रकाशन:')}</strong> {notice.publicationStatus || 'draft'}
                  </span>
                  <div className="notice-action-buttons">
                    {!isPublished && (
                      <Button
                        icon="check_circle"
                        onClick={() => onApprove(notice.id)}
                        size="small"
                      >
                        {tx(language, 'Approve & Publish', 'स्वीकृत तथा प्रकाशित')}
                      </Button>
                    )}

                    {(notice.reviewStatus === 'pending_review' || notice.status === 'needs_review' || notice.status === 'pending_review') && (
                      <Button
                        icon="cancel"
                        onClick={() => setRejectingNotice(notice)}
                        size="small"
                        variant="danger"
                      >
                        {tx(language, 'Reject with reason', 'कारणसहित अस्वीकार')}
                      </Button>
                    )}

                    {isPublished && onUnpublishNotice && (
                      <Button
                        icon="visibility_off"
                        onClick={() => onUnpublishNotice(notice.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Unpublish', 'अप्रकाशित')}
                      </Button>
                    )}

                    {!isArchived && onArchiveNotice && (
                      <Button
                        icon="archive"
                        onClick={() => onArchiveNotice(notice.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Archive', 'अभिलेख')}
                      </Button>
                    )}

                    {isArchived && onRestoreNotice && (
                      <Button
                        icon="unarchive"
                        onClick={() => onRestoreNotice(notice.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Restore', 'पुनर्स्थापना')}
                      </Button>
                    )}

                    <Button
                      icon="edit"
                      onClick={() => setEditingNotice(notice)}
                      size="small"
                      variant="secondary"
                    >
                      {tx(language, 'Edit', 'सम्पादन')}
                    </Button>

                    {onDeleteNotice && (
                      <Button
                        icon="delete"
                        onClick={() => onDeleteNotice(notice.id)}
                        size="small"
                        variant="danger"
                      >
                        {tx(language, 'Delete', 'हटाउनुहोस्')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* NGO Notice Lifecycle Controls (Draft / Pending / Approved / Rejected) */}
              {isOrg && (notice.source === 'ngo' || !notice.source) && (
                <div className="notice-card-footer notice-org-actions-footer">
                  <div className="notice-status-meta">
                    {notice.publicationStatus === 'draft' && (
                      <span className="notice-status-text">
                        <Icon name="edit_note" size={14} />
                        {tx(language, 'Draft (private to your NGO)', 'मस्यौदा (तपाईंको संस्थामा मात्र सीमित)')}
                      </span>
                    )}
                    {(notice.reviewStatus === 'pending_review' || notice.status === 'pending_review' || notice.status === 'needs_review') && (
                      <span className="notice-status-text notice-status-pending">
                        <Icon name="hourglass_top" size={14} />
                        {tx(language, 'Submitted for Admin Review (not public)', 'प्रशासक समीक्षामा पेस गरिएको (सार्वजनिक छैन)')}
                      </span>
                    )}
                    {isPublished && (
                      <span className="notice-status-text notice-status-published">
                        <Icon name="visibility" size={14} />
                        {tx(language, 'Publicly Published', 'सार्वजनिक रूपमा प्रकाशित')}
                      </span>
                    )}
                    {notice.reviewStatus === 'rejected' && (
                      <span className="notice-status-text notice-status-rejected">
                        <Icon name="error_outline" size={14} />
                        {tx(language, 'Rejected by Admin', 'प्रशासकद्वारा अस्वीकृत')}
                      </span>
                    )}
                    {isArchived && (
                      <span className="notice-status-text">
                        <Icon name="archive" size={14} />
                        {tx(language, 'Archived Notice', 'अभिलेख गरिएको सूचना')}
                      </span>
                    )}
                  </div>

                  <div className="notice-action-buttons">
                    <Button
                      icon="edit"
                      onClick={() => setEditingNotice(notice)}
                      size="small"
                      variant="secondary"
                    >
                      {tx(language, 'Edit', 'सम्पादन')}
                    </Button>

                    {(notice.publicationStatus === 'draft' || notice.reviewStatus === 'rejected') && onSubmitForReview && (
                      <Button
                        icon="send"
                        onClick={() => onSubmitForReview(notice.id)}
                        size="small"
                      >
                        {tx(language, 'Submit for review', 'समीक्षाका लागि पेस')}
                      </Button>
                    )}

                    {!isArchived && onArchiveNotice && (
                      <Button
                        icon="archive"
                        onClick={() => onArchiveNotice(notice.id)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Archive', 'अभिलेख')}
                      </Button>
                    )}

                    {onDeleteNotice && (
                      <Button
                        icon="delete"
                        onClick={() => onDeleteNotice(notice.id)}
                        size="small"
                        variant="danger"
                      >
                        {tx(language, 'Delete', 'हटाउनुहोस्')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {!filteredNotices.length && (
          <Card className="empty-card">
            <AssetImage
              alt=""
              className="empty-illustration-img"
              fallbackSrc={IMAGE_PATHS.illustrations.emptyNotices}
              src={IMAGE_PATHS.illustrations.emptyNotices}
            />
            <strong>{tx(language, 'No notices available in this category.', 'यो वर्गमा कुनै सूचना उपलब्ध छैन।')}</strong>
          </Card>
        )}
      </div>

      <NoticeDraftModal
        defaultSource={activeTab}
        language={language}
        onClose={() => setShowNew(false)}
        onSubmit={onCreateNotice}
        open={showNew}
        role={role}
      />

      {editingNotice && (
        <NoticeDraftModal
          defaultSource={editingNotice.source || 'ngo'}
          initialData={editingNotice}
          language={language}
          onClose={() => setEditingNotice(null)}
          onSubmit={(changes, asDraft) => {
            if (onUpdateNotice) {
              onUpdateNotice(editingNotice.id, {
                ...changes,
                publicationStatus: asDraft ? 'draft' : role === 'admin' ? 'published' : 'unpublished',
                reviewStatus: role === 'admin' && !asDraft ? 'approved' : 'pending_review',
              })
            }
            setEditingNotice(null)
          }}
          open={Boolean(editingNotice)}
          role={role}
        />
      )}

      {selectedDetailNotice && (
        <NoticeDetailModal
          language={language}
          notice={selectedDetailNotice}
          onClose={() => setSelectedDetailNotice(null)}
          open={Boolean(selectedDetailNotice)}
        />
      )}

      {rejectingNotice && (
        <AdminRejectModal
          language={language}
          notice={rejectingNotice}
          onClose={() => setRejectingNotice(null)}
          onConfirm={(id, reason) => {
            if (onReject) onReject(id, reason)
            setRejectingNotice(null)
          }}
          open={Boolean(rejectingNotice)}
        />
      )}
    </>
  )
}
