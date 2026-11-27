import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Icon, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS, MEMBER_AVATAR_OPTIONS } from '../config/images.js'
import { tx } from '../i18n.js'

export default function CasesPage({
  handoverCodes = [],
  onGenerateHandoverCode,
  associatedMembers = [],
  language,
}) {
  const [query, setQuery] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [newlyGenerated, setNewlyGenerated] = useState(null)
  const [codeFilter, setCodeFilter] = useState('all') // 'all' | 'available' | 'used'

  const handleGenerate = () => {
    const code = onGenerateHandoverCode?.() || `NS-${Math.floor(100000 + Math.random() * 900000)}`
    setNewlyGenerated(code)
    handleCopy(code)
  }

  const handleCopy = (code) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(''), 3000)
    }
  }

  // Normalize codes array (handle object or string format)
  const normalizedCodes = handoverCodes.map((item) =>
    typeof item === 'string'
      ? { code: item, issuedAt: 'Today', expiresAt: '72 hours from issue', status: 'available' }
      : item,
  )

  const availableCodes = normalizedCodes.filter((c) => c.status === 'available')
  const usedCodes = normalizedCodes.filter((c) => c.status === 'used')

  const displayedCodes =
    codeFilter === 'available'
      ? availableCodes
      : codeFilter === 'used'
        ? usedCodes
        : normalizedCodes

  const filteredMembers = associatedMembers.filter((item) =>
    item.nickname.toLowerCase().includes(query.toLowerCase()) ||
    (item.district && item.district.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'Issue single-use 72-hour handover codes and view pseudonymous records for women associated with your organization.',
          'एकपटक प्रयोग हुने ७२-घण्टे हस्तान्तरण कोड जारी गर्नुहोस् र संस्थासँग जोडिएका महिलाहरूको उपनाम सूची हेर्नुहोस्।',
        )}
        eyebrow={tx(language, 'ORGANIZATION WORKSPACE', 'संस्था कार्यस्थल')}
        title={tx(language, 'Associated Women & Handover Codes', 'सम्बद्ध महिला र हस्तान्तरण कोड')}
        action={
          <Button icon="key" onClick={handleGenerate}>
            {tx(language, 'Generate Handover Code', 'हस्तान्तरण कोड जारी गर्नुहोस्')}
          </Button>
        }
      />

      {/* Handover Code Generator & Demonstration Management */}
      <div className="handover-generation-panel">
        <Card className="handover-card">
          <div className="handover-card-header">
            <span className="handover-icon"><Icon name="vpn_key" size={24} /></span>
            <div>
              <h3>{tx(language, '72-Hour Handover Code Generator', '७२-घण्टे हस्तान्तरण कोड प्रणाली')}</h3>
              <p>
                {tx(
                  language,
                  'Women use this single-use code to register safely with a nickname, password, and avatar—no email or phone required. Codes generated here immediately connect to the Member registration flow.',
                  'महिलाहरूले इमेल वा फोनबिनै उपनाम, पासवर्ड र अवतार छानी खाता खोल्न यो एकपटक प्रयोग हुने कोड प्रयोग गर्छन्। यहाँ जारी गरिएको कोड सदस्य दर्ता प्रक्रियामा तुरुन्त प्रयोग गर्न सकिन्छ।',
                )}
              </p>
            </div>
          </div>

          {newlyGenerated && (
            <div className="new-code-banner">
              <span className="new-code-label">{tx(language, 'NEW CODE GENERATED', 'नयाँ कोड जारी भयो')}</span>
              <strong className="new-code-display">{newlyGenerated}</strong>
              <div className="new-code-meta">
                <Badge dot tone="peach">{tx(language, 'Valid for 72 hours · Single use', '७२ घण्टा मान्य · एकपटक मात्र')}</Badge>
                <Button
                  icon={copiedCode === newlyGenerated ? 'check' : 'content_copy'}
                  onClick={() => handleCopy(newlyGenerated)}
                  variant="secondary"
                >
                  {copiedCode === newlyGenerated ? tx(language, 'Copied to clipboard', 'प्रतिलिपि भयो') : tx(language, 'Copy code', 'कोड प्रतिलिपि')}
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
                {tx(language, 'All Codes', 'सबै कोड')} ({normalizedCodes.length})
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
            {displayedCodes.map((item) => (
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
                      {tx(language, 'Registered', 'दर्ता भएको')} {item.usedBy ? `(${item.usedBy})` : ''}
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
            ))}
          </div>

          <div className="notice-inline notice-inline-warning">
            <Icon name="info" />
            <span>
              {tx(
                language,
                'Demonstration notice: Codes shown here update local React state and are not cryptographic server credentials. In production, codes are salted and hashed server-side.',
                'नमुना प्रदर्शन सूचना: यहाँ देखाइएका कोडहरू स्थानीय रूपमा व्यवस्थित छन्। वास्तविक प्रणालीमा कोडहरू सर्भरमा सुरक्षित रूपमा ह्यास गरिन्छ।',
              )}
            </span>
          </div>
        </Card>
      </div>

      {/* Associated Women Roster */}
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
        <div className="table-card-heading">
          <div>
            <h2>{tx(language, 'Associated Women Roster', 'सम्बद्ध महिलाहरूको सूची')}</h2>
            <span>{filteredMembers.length} {tx(language, 'pseudonymous records', 'उपनाम रेकर्डहरू')}</span>
          </div>
          <Badge dot tone="lavender">{tx(language, 'Pseudonymous only', 'उपनाम मात्र')}</Badge>
        </div>

        {filteredMembers.length ? (
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
                    <span><Icon name="location_on" size={14} />{member.district || 'Lalitpur'}</span>
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
          <div className="empty-state">
            <Icon name="search_off" size={27} />
            <strong>{tx(language, 'No members match your search', 'कुनै सदस्य भेटिएन')}</strong>
          </div>
        )}
      </Card>

      <div className="privacy-banner">
        <div className="privacy-banner-icon"><Icon name="shield_lock" /></div>
        <div>
          <strong>{tx(language, 'Strict privacy boundaries', 'कडा गोपनीयता सीमाहरू')}</strong>
          <p>
            {tx(
              language,
              'Court hearing dates, offence histories, medical records, and legal files are never collected or stored. All entries use pseudonymous nicknames and illustrated avatars.',
              'अदालती सुनुवाइ मिति, कसुर इतिहास, स्वास्थ्य विवरण वा कानुनी फाइल कहिल्यै संकलन वा भण्डारण गरिँदैन। सबै प्रविष्टिहरू उपनाम र चित्रित अवतारमा आधारित छन्।',
            )}
          </p>
        </div>
      </div>
    </>
  )
}
