import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS, IMAGE_PLACEHOLDERS, MEMBER_AVATAR_OPTIONS } from '../config/images.js'
import { tx } from '../i18n.js'

function MemberCommunityModal({ open, onClose, member, onRequestChat, isSelf, language }) {
  if (!open || !member) return null

  const avatarSrc =
    MEMBER_AVATAR_OPTIONS.find((a) => a.id === member.avatarId)?.src || IMAGE_PATHS.avatars.avatar1

  return (
    <Modal
      description={tx(
        language,
        'Limited pseudonymous community profile. Private verification details and contact info are never shared.',
        'उपनाम समुदाय प्रोफाइल। प्रमाणीकरण वा व्यक्तिगत विवरणहरू कहिल्यै साझा गरिँदैन।',
      )}
      onClose={onClose}
      open={open}
      title={tx(language, 'Community Member Profile', 'समुदाय सदस्य प्रोफाइल')}
    >
      <div className="form-stack">
        <div className="directory-card-top" style={{ marginBottom: '12px' }}>
          <span className="member-hero-avatar">
            <AssetImage
              alt={member.nickname}
              className="member-hero-avatar-img"
              fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
              src={avatarSrc}
            />
          </span>
          <div className="directory-member-headings">
            <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>{member.nickname}</h2>
            {member.district && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                <Icon name="location_on" size={15} />
                {member.district}, Nepal
              </span>
            )}
          </div>
          <Badge dot tone="lavender">{tx(language, 'Opted In', 'समावेश')}</Badge>
        </div>

        {member.interests && member.interests.length > 0 && (
          <div className="member-interests-preview" style={{ marginTop: '4px' }}>
            <span className="interests-label">{tx(language, 'Shared Skills & Interests:', 'साझा सीप तथा रुचिहरू:')}</span>
            <div className="interests-tags-row">
              {member.interests.map((skill) => (
                <span className="interest-pill" key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        <div className="notice-inline notice-inline-info">
          <Icon name="verified_user" />
          <span>
            {tx(
              language,
              'Peer safety: Sending a request allows 1:1 text chat only after acceptance. No phone or email required.',
              'साथी सुरक्षा: अनुरोध पठाउँदा स्वीकृतिपछि मात्र १:१ च्याट सुरु हुन्छ। फोन वा इमेल आवश्यक पर्दैन।',
            )}
          </span>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Close', 'बन्द गर्नुहोस्')}
          </Button>
          {!isSelf && (
            <Button
              icon="send"
              onClick={() => {
                onRequestChat?.(member)
                onClose()
              }}
            >
              {tx(language, 'Send message request', 'सन्देश अनुरोध पठाउनुहोस्')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function CommunityPage({
  members = [],
  currentMemberNickname = 'Sajilo',
  optedIn = true,
  onUpdateOptIn,
  onRequestChat,
  language,
}) {
  const [query, setQuery] = useState('')
  const [districtFilter, setDistrictFilter] = useState('All')
  const [selectedMember, setSelectedMember] = useState(null)
  const [feedbackNotice, setFeedbackNotice] = useState('')

  // Privacy Rule: Only members who have explicitly opted into the community directory appear!
  const optedInMembers = members.filter((m) => m.communityOptIn !== false)

  const districts = ['All', ...new Set(optedInMembers.map((m) => m.district).filter(Boolean))]

  const filteredMembers = optedInMembers.filter((member) => {
    if (districtFilter !== 'All' && member.district !== districtFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      const searchStr = `${member.nickname} ${member.district || ''} ${(member.interests || []).join(' ')}`.toLowerCase()
      if (!searchStr.includes(q)) return false
    }
    return true
  })

  const handleSendRequest = (member) => {
    if (member.nickname === currentMemberNickname) {
      setFeedbackNotice(tx(language, 'You cannot send a message request to yourself.', 'आफैलाई सन्देश अनुरोध पठाउन मिल्दैन।'))
      return
    }
    onRequestChat?.(member)
    setFeedbackNotice(
      tx(
        language,
        `Message request sent to ${member.nickname}. Check your Messages screen.`,
        `${member.nickname} लाई सन्देश अनुरोध पठाइयो। सन्देश स्क्रिन जाँच गर्नुहोस्।`,
      ),
    )
  }

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'An opt-in pseudonymous directory for women in our community. No public walls, feeds, or group chats.',
          'हाम्रो समुदायका महिलाहरूका लागि इच्छानुसार सामेल हुने उपनाम निर्देशिका। कुनै सार्वजनिक वाल, फिड वा समूह च्याट हुँदैन।',
        )}
        eyebrow={tx(language, 'YOUR COMMUNITY', 'तपाईंको समुदाय')}
        title={tx(language, 'Community Member Directory', 'समुदाय सदस्य निर्देशिका')}
      />

      <div className="community-directory-layout">
        <div className="community-directory-main">
          {/* User's Own Opt-In Status Control */}
          <Card className="optin-status-card">
            <div className="optin-status-copy">
              <span className="optin-badge">
                <Icon name={optedIn ? 'visibility' : 'visibility_off'} size={20} />
              </span>
              <div>
                <strong>
                  {optedIn
                    ? tx(language, 'You are visible in the Community Directory', 'तपाईं समुदाय निर्देशिकामा देखिनुभएको छ')
                    : tx(language, 'Your profile is private and hidden', 'तपाईंको प्रोफाइल गोप्य र लुकाइएको छ')}
                </strong>
                <p>
                  {tx(
                    language,
                    'Only opted-in women can see your nickname, avatar, district, and shared skills. You can hide your profile anytime.',
                    'सामेल भएका महिलाहरूले मात्र तपाईंको उपनाम, अवतार, जिल्ला र सीप देख्न सक्छन्। तपाईं जुनसुकै बेला प्रोफाइल लुकाउन सक्नुहुन्छ।',
                  )}
                </p>
              </div>
            </div>
            <Button
              icon={optedIn ? 'toggle_on' : 'toggle_off'}
              onClick={() => onUpdateOptIn?.(!optedIn)}
              variant={optedIn ? 'secondary' : 'primary'}
            >
              {optedIn ? tx(language, 'Change to Private', 'गोप्य बनाउनुहोस्') : tx(language, 'Opt In to Directory', 'निर्देशिकामा सामेल हुनुहोस्')}
            </Button>
          </Card>

          {feedbackNotice && (
            <div aria-live="polite" className="speech-status">
              <Icon name="check_circle" size={18} />
              <span>{feedbackNotice}</span>
              <button aria-label="Dismiss" className="plain-icon-button" onClick={() => setFeedbackNotice('')} type="button">
                <Icon name="close" size={17} />
              </button>
            </div>
          )}

          {/* Directory Search & District Filters */}
          <div className="list-toolbar">
            <div className="search-field">
              <Icon name="search" />
              <input
                aria-label={tx(language, 'Search community directory', 'समुदाय निर्देशिका खोज्नुहोस्')}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx(language, 'Search by nickname, district, or skills…', 'उपनाम, जिल्ला वा सीप खोज्नुहोस्…')}
                value={query}
              />
            </div>

            <div className="filter-select-group">
              <select
                aria-label={tx(language, 'Filter by district', 'जिल्ला अनुसार छान्नुहोस्')}
                className="input-control"
                onChange={(e) => setDistrictFilter(e.target.value)}
                style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                value={districtFilter}
              >
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? tx(language, 'All Districts', 'सबै जिल्लाहरू') : d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Cards Grid */}
          <div className="directory-cards-grid">
            {filteredMembers.map((member) => {
              const avatarSrc =
                MEMBER_AVATAR_OPTIONS.find((a) => a.id === member.avatarId)?.src || IMAGE_PATHS.avatars.avatar1
              const isSelf = member.nickname === currentMemberNickname

              return (
                <Card className="directory-member-card" key={member.id}>
                  <div className="directory-card-top">
                    <span className="avatar">
                      <AssetImage alt="" className="avatar-img" fallbackSrc={IMAGE_PLACEHOLDERS.avatar} src={avatarSrc} />
                    </span>
                    <div className="directory-member-headings">
                      <strong>
                        {member.nickname} {isSelf && <small style={{ color: 'var(--plum)' }}>({tx(language, 'You', 'तपाईं')})</small>}
                      </strong>
                      {member.district && (
                        <span><Icon name="location_on" size={15} />{member.district}</span>
                      )}
                    </div>
                    <Badge dot tone="lavender">{tx(language, 'Opted In', 'समावेश')}</Badge>
                  </div>

                  {member.interests && member.interests.length > 0 && (
                    <div className="directory-interests-row">
                      {member.interests.map((skill) => (
                        <span className="skill-tag" key={skill}>{skill}</span>
                      ))}
                    </div>
                  )}

                  <div className="directory-card-actions" style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      icon="info"
                      onClick={() => setSelectedMember(member)}
                      size="small"
                      variant="secondary"
                    >
                      {tx(language, 'View profile', 'प्रोफाइल हेर्नुहोस्')}
                    </Button>
                    {!isSelf && (
                      <Button
                        icon="mail"
                        onClick={() => handleSendRequest(member)}
                        size="small"
                        variant="secondary"
                      >
                        {tx(language, 'Message request', 'सन्देश अनुरोध')}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          {!filteredMembers.length && (
            <Card className="empty-state">
              <Icon name="search_off" size={28} />
              <strong>{tx(language, 'No community members match your search or filter.', 'खोजिएका कुनै सदस्य फेला परेनन्।')}</strong>
            </Card>
          )}
        </div>

        <aside className="community-aside">
          <Card className="community-guidelines">
            <div className="guidance-icon"><Icon name="diversity_3" size={25} /></div>
            <p className="eyebrow">{tx(language, 'COMMUNITY PRINCIPLES', 'समुदायका सिद्धान्तहरू')}</p>
            <h2>{tx(language, 'A safe, pseudonymous circle', 'सुरक्षित, उपनाम-आधारित दायरा')}</h2>
            <ul>
              <li>{tx(language, 'Pseudonyms only: Real names and contact numbers are never shown.', 'उपनाम मात्र: वास्तविक नाम र सम्पर्क कहिल्यै देखाइँदैन।')}</li>
              <li>{tx(language, 'No public feeds or social walls: Interactions are purely individual 1:1 connections.', 'कुनै सार्वजनिक फिड छैन: संवादहरू व्यक्तिगत १:१ मा मात्र आधारित हुन्छन्।')}</li>
              <li>{tx(language, 'Request-gated chat: You choose whether to accept or decline any conversation request.', 'अनुरोध-आधारित च्याट: कुराकानी स्वीकार गर्ने वा अस्वीकार गर्ने अधिकार तपाईंमा हुन्छ।')}</li>
              <li>{tx(language, 'Zero case data: No criminal, court, or offence details exist anywhere in this system.', 'कुनै मुद्दा विवरण छैन: प्रणालीमा कुनै कानुनी रेकर्ड राखिँदैन।')}</li>
            </ul>
            <div className="community-safety-note">
              <Icon name="shield" size={17} />
              {tx(language, 'Privacy first · Opt-in directory · Zero court records', 'गोपनीयता पहिलो · ऐच्छिक निर्देशिका · कुनै कानुनी रेकर्ड छैन')}
            </div>
          </Card>
        </aside>
      </div>

      <MemberCommunityModal
        isSelf={selectedMember?.nickname === currentMemberNickname}
        language={language}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onRequestChat={handleSendRequest}
        open={Boolean(selectedMember)}
      />
    </>
  )
}
