import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Field, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS, IMAGE_PLACEHOLDERS } from '../config/images.js'
import { tx } from '../i18n.js'

function EditOrganizationModal({ open, onClose, organization, onUpdate, language }) {
  const [name, setName] = useState(organization?.name || '')
  const [location, setLocation] = useState(organization?.location || 'Lalitpur')
  const [focus, setFocus] = useState(organization?.focus || '')
  const [contactPhone, setContactPhone] = useState(organization?.contactPhone || '')
  const [contactEmail, setContactEmail] = useState(organization?.contactEmail || '')
  const [category, setCategory] = useState(organization?.category || 'Skills & Reintegration')

  const submit = (event) => {
    event.preventDefault()
    if (!name.trim()) return
    onUpdate(organization.id, {
      name: name.trim(),
      location: location.trim(),
      focus: focus.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      category: category.trim(),
    })
    onClose()
  }

  return (
    <Modal
      description={tx(
        language,
        'Update your public organization profile. Changes are visible across the platform in this demonstration.',
        'तपाईंको संस्थाको सार्वजनिक विवरण अपडेट गर्नुहोस्। परिवर्तनहरू डेमोभर देखिनेछन्।',
      )}
      onClose={onClose}
      open={open}
      size="large"
      title={tx(language, 'Edit Organization Profile', 'संस्था प्रोफाइल सम्पादन')}
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="form-row">
          <Field label={tx(language, 'Organization name', 'संस्थाको नाम')}>
            <input
              className="input-control"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </Field>
          <Field label={tx(language, 'District / Location', 'जिल्ला / स्थान')}>
            <input
              className="input-control"
              onChange={(e) => setLocation(e.target.value)}
              required
              value={location}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Main area of support', 'मुख्य सहयोग क्षेत्र')}>
          <input
            className="input-control"
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Skills & Reintegration, Legal Aid, Wellbeing"
            value={category}
          />
        </Field>

        <Field label={tx(language, 'Public service description', 'सार्वजनिक सेवा विवरण')}>
          <textarea
            className="input-control textarea-control"
            onChange={(e) => setFocus(e.target.value)}
            required
            rows={3}
            value={focus}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Contact phone', 'सम्पर्क फोन')}>
            <input
              className="input-control"
              onChange={(e) => setContactPhone(e.target.value)}
              value={contactPhone}
            />
          </Field>
          <Field label={tx(language, 'Contact email', 'सम्पर्क इमेल')}>
            <input
              className="input-control"
              onChange={(e) => setContactEmail(e.target.value)}
              type="email"
              value={contactEmail}
            />
          </Field>
        </div>

        <div className="notice-inline notice-inline-info">
          <Icon name="verified_user" />
          <span>{tx(language, 'Demonstration mode: edits update local state without modifying server database.', 'डेमो मोड: सम्पादनले सर्भर डाटाबेस परिवर्तन नगरी स्थानीय रूपमा अपडेट गर्छ।')}</span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">{tx(language, 'Cancel', 'रद्द गर्नुहोस्')}</Button>
          <Button icon="save" type="submit">{tx(language, 'Save changes', 'परिवर्तन सुरक्षित')}</Button>
        </div>
      </form>
    </Modal>
  )
}

function RegisterOrganizationModal({ open, onClose, onRegister, language }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('Kathmandu')
  const [category, setCategory] = useState('Skills & Reintegration')
  const [focus, setFocus] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [applicantName, setApplicantName] = useState('')
  const [applicantPassword, setApplicantPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const close = () => {
    setName('')
    setFocus('')
    setContactPhone('')
    setContactEmail('')
    setApplicantName('')
    setApplicantPassword('')
    setError('')
    setSuccess('')
    onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!name.trim() || !focus.trim()) {
      setError(tx(language, 'Name and service description are required.', 'नाम र सेवा विवरण आवश्यक छ।'))
      return
    }
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError(tx(language, 'A valid contact email is required.', 'मान्य सम्पर्क इमेल आवश्यक छ।'))
      return
    }
    if (applicantPassword.length < 8) {
      setError(tx(language, 'Administrator password must be at least 8 characters.', 'प्रशासक पासवर्ड कम्तीमा ८ अक्षरको हुनुपर्छ।'))
      return
    }

    setSubmitting(true)
    try {
      const result = await onRegister?.({
        name: name.trim(),
        location,
        category,
        focus: focus.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        applicantName: applicantName.trim() || `${name.trim()} Admin`,
        applicantPassword,
      })

      if (result && !result.ok) {
        setError(result.error || tx(language, 'Failed to submit application.', 'आवेदन दर्ता गर्न सकिएन।'))
      } else {
        setSuccess(
          tx(
            language,
            'Organization application submitted successfully! It is now pending Platform Admin verification.',
            'संस्था दर्ता आवेदन सफलतापूर्वक पेश गरियो! यो अब प्रशासकको समीक्षाको प्रतीक्षामा छ।',
          ),
        )
        setTimeout(() => {
          close()
        }, 1800)
      }
    } catch (err) {
      setError(err.message || tx(language, 'Failed to submit application.', 'आवेदन दर्ता गर्न सकिएन।'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      description={tx(
        language,
        'Register your non-governmental organization to collaborate on community support and provide verified notices.',
        'सामुदायिक सहयोग र प्रमाणित सूचना प्रदान गर्न आफ्नो संस्था दर्ता गर्नुहोस्।',
      )}
      onClose={close}
      open={open}
      size="large"
      title={tx(language, 'Register an organization', 'संस्था दर्ता गर्नुहोस्')}
    >
      <form className="form-stack" onSubmit={submit}>
        {error && (
          <div className="notice-inline notice-inline-warning">
            <Icon name="error" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="notice-inline notice-inline-success">
            <Icon name="check_circle" />
            <span>{success}</span>
          </div>
        )}

        <div className="form-row">
          <Field label={tx(language, 'Organization name', 'संस्थाको नाम')}>
            <input
              className="input-control"
              disabled={submitting}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Sahara Foundation Nepal"
              required
              value={name}
            />
          </Field>
          <Field label={tx(language, 'Service location', 'सेवा स्थान')}>
            <select
              className="input-control"
              disabled={submitting}
              onChange={(event) => setLocation(event.target.value)}
              value={location}
            >
              <option>Kathmandu</option>
              <option>Lalitpur</option>
              <option>Bhaktapur</option>
              <option>Pokhara</option>
              <option>Chitwan</option>
              <option>Other</option>
            </select>
          </Field>
        </div>

        <div className="form-row">
          <Field label={tx(language, 'Primary support area', 'मुख्य सहयोग क्षेत्र')}>
            <input
              className="input-control"
              disabled={submitting}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Skills & Reintegration, Legal Aid"
              value={category}
            />
          </Field>
          <Field label={tx(language, 'Contact phone', 'सम्पर्क फोन')}>
            <input
              className="input-control"
              disabled={submitting}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+977-..."
              value={contactPhone}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Public service description', 'सार्वजनिक सेवा विवरण')}>
          <textarea
            className="input-control textarea-control"
            disabled={submitting}
            onChange={(event) => setFocus(event.target.value)}
            placeholder="Describe public services, transition assistance, or community support provided..."
            required
            rows={3}
            value={focus}
          />
        </Field>

        <div className="form-row">
          <Field label={tx(language, 'Organization Admin Email', 'संस्था प्रशासक इमेल')}>
            <input
              className="input-control"
              disabled={submitting}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="admin@organization.org.np"
              required
              type="email"
              value={contactEmail}
            />
          </Field>
          <Field label={tx(language, 'Representative Name', 'प्रतिनिधिको नाम')}>
            <input
              className="input-control"
              disabled={submitting}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="Full name"
              value={applicantName}
            />
          </Field>
        </div>

        <Field label={tx(language, 'Admin Login Password (min 8 chars)', 'प्रशासक पासवर्ड (कम्तीमा ८ अक्षर)')}>
          <input
            className="input-control"
            disabled={submitting}
            onChange={(e) => setApplicantPassword(e.target.value)}
            placeholder="Choose secure password"
            required
            type="password"
            value={applicantPassword}
          />
        </Field>

        <div className="notice-inline notice-inline-info">
          <Icon name="shield" />
          <span>{tx(language, 'No member or case data is collected. Applications remain pending until Platform Admin review.', 'सदस्य वा केसको जानकारी संकलन गरिँदैन। प्रशासकको समीक्षासम्म दर्ता विचाराधीन रहन्छ।')}</span>
        </div>

        <div className="modal-actions">
          <Button disabled={submitting} onClick={close} variant="secondary">
            {tx(language, 'Cancel', 'रद्द गर्नुहोस्')}
          </Button>
          <Button disabled={submitting} icon="send" type="submit">
            {submitting
              ? tx(language, 'Submitting...', 'पठाउँदै...')
              : tx(language, 'Submit for review', 'समीक्षाका लागि पठाउनुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function OrganizationDetailModal({ open, onClose, organization, onNavigate, onRequestConversation, role, language }) {
  if (!open || !organization) return null

  return (
    <Modal
      description={tx(
        language,
        'Verified demonstration partner organization profile on Naya Sahara.',
        'नयाँ सहारामा प्रमाणित नमुना साझेदार संस्थाको विवरण।',
      )}
      onClose={onClose}
      open={open}
      size="large"
      title={organization.name}
    >
      <div className="form-stack">
        <div className="featured-org-header" style={{ marginBottom: '10px' }}>
          <span className="featured-org-logo">
            <AssetImage
              alt={organization.name}
              className="organization-logo-img"
              fallbackSrc={IMAGE_PLACEHOLDERS.ngo}
              src={organization.logoUrl || IMAGE_PLACEHOLDERS.ngo}
            />
          </span>
          <div className="featured-org-headings">
            <div className="featured-org-title-line">
              <h2>{organization.name}</h2>
              <Badge dot tone={organization.status === 'approved' ? 'green' : 'peach'}>
                {organization.status === 'approved'
                  ? tx(language, 'Verified & Approved', 'प्रमाणित तथा स्वीकृत')
                  : tx(language, 'Pending Review', 'समीक्षा बाँकी')}
              </Badge>
            </div>
            <p className="featured-org-category">
              <Icon name="verified" size={16} />
              <span>{organization.category || 'Skills & Reintegration'} · {organization.location}, Nepal</span>
            </p>
          </div>
        </div>

        <Field label={tx(language, 'Services & Focus Area', 'सेवा तथा कार्यक्षेत्र')}>
          <p style={{ margin: '4px 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--text)' }}>
            {organization.focus}
          </p>
        </Field>

        <div className="featured-org-contacts" style={{ marginTop: '12px' }}>
          {organization.contactPhone && (
            <span className="org-contact-pill">
              <Icon name="call" size={15} />
              <strong>{tx(language, 'Phone', 'फोन')}:</strong> {organization.contactPhone}
            </span>
          )}
          {organization.contactEmail && (
            <span className="org-contact-pill">
              <Icon name="mail" size={15} />
              <strong>{tx(language, 'Email', 'इमेल')}:</strong> {organization.contactEmail}
            </span>
          )}
          <span className="org-contact-pill">
            <Icon name="location_on" size={15} />
            <strong>{tx(language, 'District', 'जिल्ला')}:</strong> {organization.location}
          </span>
        </div>

        <div className="notice-inline notice-inline-info">
          <Icon name="verified_user" />
          <span>{tx(language, 'Demonstration organization: all details are modeled for the hackathon prototype.', 'नमुना संस्था: सबै विवरणहरू ह्याकाथन प्रदर्शनका लागि तयार गरिएका हुन्।')}</span>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Close', 'बन्द गर्नुहोस्')}
          </Button>
          {role === 'member' && organization.status === 'approved' && (
            <Button
              icon="chat"
              onClick={() => {
                onClose()
                if (onRequestConversation) {
                  onRequestConversation(organization)
                } else {
                  onNavigate?.('messages')
                }
              }}
            >
              {tx(language, 'Request conversation', 'कुराकानी अनुरोध गर्नुहोस्')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function OrganizationsPage({
  organizations,
  role,
  onApprove,
  onReject,
  onArchive,
  onRegister,
  onUpdateOrganization,
  onRequestConversation,
  onNavigate,
  onOpenAuth,
  activeOrgId = '',
  language,
}) {
  const [showRegistration, setShowRegistration] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [query, setQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const isOrg = role === 'org'
  const isAdmin = role === 'admin'
  const isPublic = role === 'member' || role === 'guest'

  // The active NGO for Org Admin
  const myOrg = (activeOrgId ? organizations.find((org) => org.id === activeOrgId) : null) || organizations[0]

  // Filter locations and categories dynamically
  const locations = ['All', ...new Set(organizations.map((o) => o.location).filter(Boolean))]
  const categories = ['All', 'Skills & Reintegration', 'Employment & Peer Support', 'Wellbeing & Referrals']

  // F-4 Remediation: Use verificationStatus === 'verified' as the sole canonical
  // public visibility condition. The legacy status === 'approved' fallback is removed
  // because archived organizations can have status === 'archived' but a stale
  // status === 'approved' field, which could cause them to appear in the public list.
  const filteredOrganizations = (isPublic
    ? organizations.filter(
        (organization) => organization.verificationStatus === 'verified',
      )
    : organizations
  ).filter((org) => {
    if (locationFilter !== 'All' && org.location !== locationFilter) return false
    if (categoryFilter !== 'All' && org.category !== categoryFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      const searchStr = `${org.name} ${org.location} ${org.focus || ''} ${org.category || ''}`.toLowerCase()
      if (!searchStr.includes(q)) return false
    }
    return true
  })

  return (
    <>
      <PageHeader
        description={
          isOrg
            ? tx(
                language,
                'Manage your public profile, verified location, and support service details.',
                'तपाईंको सार्वजनिक संस्था प्रोफाइल, प्रमाणित स्थान र सेवा विवरण व्यवस्थापन गर्नुहोस्।',
              )
            : isAdmin
              ? tx(
                  language,
                  'Review applications before an organization can manage its profile or publish notices.',
                  'संस्थाले प्रोफाइल व्यवस्थापन वा सूचना प्रकाशित गर्नुअघि आवेदन समीक्षा गर्नुहोस्।',
                )
              : tx(
                  language,
                  'Explore verified organizations offering public support and services across Nepal.',
                  'नेपालभर सार्वजनिक सहयोग र सेवा दिने प्रमाणित संस्थाहरू हेर्नुहोस्।',
                )
        }
        eyebrow={
          isOrg
            ? tx(language, 'ORGANIZATION WORKSPACE', 'संस्था कार्यस्थल')
            : isAdmin
              ? tx(language, 'PLATFORM ADMIN', 'प्लेटफर्म प्रशासक')
              : tx(language, 'DIRECTORY', 'निर्देशिका')
        }
        title={
          isOrg
            ? tx(language, 'Organization Profile', 'संस्था प्रोफाइल')
            : isAdmin
              ? tx(language, 'Organization approvals', 'संस्था स्वीकृति')
              : tx(language, 'Organizations', 'संस्थाहरू')
        }
        action={
          isOrg ? (
            <Button icon="edit" onClick={() => setShowEditProfile(true)}>
              {tx(language, 'Edit Profile', 'प्रोफाइल सम्पादन')}
            </Button>
          ) : role === 'guest' ? (
            <Button icon="add_business" onClick={() => onOpenAuth?.('register')}>
              {tx(language, 'Register an NGO', 'गैरसरकारी संस्था दर्ता')}
            </Button>
          ) : null
        }
      />

      {/* Featured Own Organization Profile for Org Admin */}
      {isOrg && myOrg && (
        <Card className="featured-org-profile-card">
          <div className="featured-org-header">
            <span className="featured-org-logo">
              <AssetImage
                alt={myOrg.name}
                className="organization-logo-img"
                fallbackSrc={IMAGE_PLACEHOLDERS.ngo}
                src={myOrg.logoUrl || IMAGE_PATHS.ngos.ngo1}
              />
            </span>
            <div className="featured-org-headings">
              <div className="featured-org-title-line">
                <h2>{myOrg.name}</h2>
                <Badge dot tone="green">{tx(language, 'Verified & Approved', 'प्रमाणित तथा स्वीकृत')}</Badge>
              </div>
              <p className="featured-org-category">
                <Icon name="verified" size={16} />
                <span>{myOrg.category || 'Skills & Reintegration'} · {myOrg.location}</span>
              </p>
            </div>
            <Button icon="edit" onClick={() => setShowEditProfile(true)} variant="secondary">
              {tx(language, 'Edit Profile', 'सम्पादन')}
            </Button>
          </div>

          <p className="featured-org-focus">{myOrg.focus}</p>

          <div className="featured-org-contacts">
            {myOrg.contactPhone && (
              <span className="org-contact-pill">
                <Icon name="call" size={15} />
                <strong>{tx(language, 'Phone', 'फोन')}:</strong> {myOrg.contactPhone}
              </span>
            )}
            {myOrg.contactEmail && (
              <span className="org-contact-pill">
                <Icon name="mail" size={15} />
                <strong>{tx(language, 'Email', 'इमेल')}:</strong> {myOrg.contactEmail}
              </span>
            )}
            <span className="org-contact-pill">
              <Icon name="location_on" size={15} />
              <strong>{tx(language, 'Location', 'स्थान')}:</strong> {myOrg.location}, Nepal
            </span>
          </div>

          <div className="featured-org-footer">
            <Icon name="shield_lock" size={16} />
            <span>{tx(language, 'Only Platform Admins can modify verification status. Changes here update your demonstration profile.', 'प्लेटफर्म प्रशासकले मात्र स्वीकृति अवस्था परिवर्तन गर्न सक्छन्। यहाँ गरिएका सम्पादनले डेमो प्रोफाइल अपडेट गर्छ।')}</span>
          </div>
        </Card>
      )}

      {isOrg && (
        <div className="section-subheading">
          <h3>{tx(language, 'Network Organizations in Nepal', 'नेपालका अन्य साझेदार संस्थाहरू')}</h3>
        </div>
      )}

      {isAdmin && (
        <div className="notice-inline notice-inline-info approval-note">
          <Icon name="verified_user" />
          <span>{tx(language, 'Approved organizations can access only their own consented casework. No Member data appears in this directory.', 'स्वीकृत संस्थाले आफ्नै सहमतियुक्त केसमा मात्र पहुँच पाउँछन्। यस निर्देशिकामा सदस्यको विवरण देखिँदैन।')}</span>
        </div>
      )}

      {isPublic && (
        <div className="list-toolbar" style={{ marginBottom: '20px' }}>
          <div className="search-field" style={{ minWidth: '240px' }}>
            <Icon name="search" />
            <input
              aria-label={tx(language, 'Search organizations', 'संस्था खोज्नुहोस्')}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx(language, 'Search by NGO name, district, or focus…', 'नाम, जिल्ला वा सेवा खोज्नुहोस्…')}
              value={query}
            />
          </div>

          <div className="filter-select-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              aria-label={tx(language, 'Filter by location', 'स्थान अनुसार छान्नुहोस्')}
              className="input-control"
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={locationFilter}
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === 'All' ? tx(language, 'All Locations', 'सबै स्थानहरू') : loc}
                </option>
              ))}
            </select>

            <select
              aria-label={tx(language, 'Filter by category', 'वर्ग अनुसार छान्नुहोस्')}
              className="input-control"
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={categoryFilter}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? tx(language, 'All Categories', 'सबै वर्गहरू') : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="organization-grid">
        {filteredOrganizations.map((organization) => (
          <Card className="organization-card" key={organization.id}>
            <div className="organization-card-heading">
              <span className="organization-logo">
                <AssetImage
                  alt={organization.name}
                  className="organization-logo-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.ngo}
                  src={organization.logoUrl || IMAGE_PLACEHOLDERS.ngo}
                />
              </span>
              <div className="organization-title">
                <h2>{organization.name}</h2>
                <span><Icon name="location_on" size={16} />{organization.location}</span>
              </div>
              {organization.status === 'approved' ? (
                <Badge dot tone="green">{tx(language, 'Approved', 'स्वीकृत')}</Badge>
              ) : (
                <Badge dot tone="peach">{tx(language, 'Pending review', 'समीक्षामा')}</Badge>
              )}
            </div>
            <p>{organization.focus}</p>
            {organization.contactPhone && (
              <p className="organization-contact">
                <Icon name="call" size={15} /> {organization.contactPhone}
              </p>
            )}
            <div className="organization-card-footer">
              <Button
                icon="info"
                onClick={() => setSelectedOrg(organization)}
                size="small"
                variant="secondary"
              >
                {tx(language, 'View details', 'विवरण हेर्नुहोस्')}
              </Button>
              {isAdmin && (organization.status === 'pending' || organization.verificationStatus === 'pending') && (
                <>
                  <Button icon="task_alt" onClick={() => onApprove(organization.id)} size="small">
                    {tx(language, 'Verify NGO', 'संस्था प्रमाणित')}
                  </Button>
                  {onReject && (
                    <Button icon="cancel" onClick={() => onReject(organization.id)} size="small" variant="danger">
                      {tx(language, 'Reject', 'अस्वीकार')}
                    </Button>
                  )}
                </>
              )}
              {isAdmin && (organization.status === 'approved' || organization.verificationStatus === 'verified') && onArchive && (
                <Button icon="archive" onClick={() => onArchive(organization.id)} size="small" variant="secondary">
                  {tx(language, 'Archive', 'अभिलेख')}
                </Button>
              )}
              {!isAdmin && organization.status === 'approved' && role === 'member' && (
                <Button
                  icon="chat"
                  onClick={() => {
                    if (onRequestConversation) {
                      onRequestConversation(organization)
                    } else {
                      onNavigate?.('messages')
                    }
                  }}
                  size="small"
                  variant="secondary"
                >
                  {tx(language, 'Request chat', 'कुराकानी अनुरोध')}
                </Button>
              )}
            </div>
          </Card>
        ))}

        {!filteredOrganizations.length && (
          <Card className="empty-card" style={{ gridColumn: '1 / -1' }}>
            <p><strong>{tx(language, 'No organizations match your search or filter.', 'तपाईंको खोजी अनुसार कुनै संस्था फेला परेन।')}</strong></p>
          </Card>
        )}
      </div>

      <OrganizationDetailModal
        language={language}
        onClose={() => setSelectedOrg(null)}
        onNavigate={onNavigate}
        onRequestConversation={onRequestConversation}
        open={Boolean(selectedOrg)}
        organization={selectedOrg}
        role={role}
      />

      {myOrg && (
        <EditOrganizationModal
          language={language}
          onClose={() => setShowEditProfile(false)}
          onUpdate={onUpdateOrganization}
          open={showEditProfile}
          organization={myOrg}
        />
      )}

      <RegisterOrganizationModal
        language={language}
        onClose={() => setShowRegistration(false)}
        onRegister={onRegister}
        open={showRegistration}
      />
    </>
  )
}
