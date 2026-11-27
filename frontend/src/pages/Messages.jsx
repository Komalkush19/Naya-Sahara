import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PLACEHOLDERS } from '../config/images.js'
import { tx } from '../i18n.js'

function ReportModal({ open, onClose, onConfirm, targetName, language }) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    onConfirm(reason.trim())
    setReason('')
    onClose()
  }

  return (
    <Modal
      description={tx(
        language,
        'Report inappropriate behaviour, harassment, or safety concerns.',
        'अनुचित व्यवहार, दुर्व्यवहार वा सुरक्षा समस्याबारे रिपोर्ट गर्नुहोस्।',
      )}
      onClose={onClose}
      open={open}
      title={tx(language, 'Report conversation', 'कुराकानी रिपोर्ट गर्नुहोस्')}
    >
      <form className="form-stack" onSubmit={submit}>
        <p style={{ margin: '0 0 10px', fontSize: '13px' }}>
          <strong>{tx(language, 'Reporting:', 'रिपोर्ट गरिँदै:')}</strong> {targetName}
        </p>
        <textarea
          className="input-control textarea-control"
          onChange={(e) => setReason(e.target.value)}
          placeholder={tx(
            language,
            'Describe the issue (e.g. unsolicited personal requests, pressure, spam)…',
            'समस्या उल्लेख गर्नुहोस् (जस्तै: दबाब, अनावश्यक माग, व्यक्तिगत विवरण सोध्ने)…',
          )}
          required
          rows={3}
          value={reason}
        />
        <div className="notice-inline notice-inline-info">
          <Icon name="shield" />
          <span>{tx(language, 'Your report will be reviewed without accessing other private chats.', 'अन्य निजी च्याटमा पहुँच नगरी तपाईंको रिपोर्टको समीक्षा गरिनेछ।')}</span>
        </div>
        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">
            {tx(language, 'Cancel', 'रद्द गर्नुहोस्')}
          </Button>
          <Button icon="flag" type="submit" variant="danger">
            {tx(language, 'Submit report', 'रिपोर्ट पेस गर्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function MessagesPage({
  role,
  currentUserId,
  conversations = [],
  activeConversationId,
  currentUserName = 'Sajilo',
  onSelectConversation,
  onAcceptRequest,
  onDeclineRequest,
  onSendMessage,
  onBlock,
  onUnblock,
  onReport,
  language,
}) {
  const [text, setText] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)
  const isMember = role === 'member'
  const isOrg = role === 'org'

  // Filter conversations strictly by stable participant identities:
  // - Org sees conversations where their organizationId or recipientId or requesterId is currentUserId
  // - Member sees conversations where their memberId is requesterId or recipientId
  // - Platform Admin / guest: zero access (fail closed)
  const visibleConversations = conversations.filter((c) => {
    if (!currentUserId) return false
    if (isOrg) {
      return (
        c.organizationId === currentUserId ||
        c.recipientId === currentUserId ||
        c.requesterId === currentUserId
      )
    }
    if (isMember) {
      return c.requesterId === currentUserId || c.recipientId === currentUserId
    }
    return false
  })

  const currentConv =
    visibleConversations.find((c) => c.id === activeConversationId) || visibleConversations[0]

  // Counterparty helper to resolve recipient vs requester display metadata symmetrically
  const getCounterpart = (conv) => {
    if (!conv) {
      return {
        name: '',
        avatar: IMAGE_PLACEHOLDERS.avatar,
        subtitle: '',
      }
    }
    const isReq = conv.requesterId === currentUserId
    const name = isReq ? conv.recipientName : conv.requesterName
    const avatar = isReq
      ? conv.recipientAvatar || conv.participantAvatar || IMAGE_PLACEHOLDERS.avatar
      : conv.requesterAvatar || conv.participantAvatar || IMAGE_PLACEHOLDERS.avatar
    const subtitle =
      conv.participantSubtitle ||
      (conv.type === 'ngo'
        ? tx(language, 'Verified Support NGO', 'प्रमाणित सहयोग संस्था')
        : tx(language, 'Community Peer', 'समुदाय साथी'))
    return { name, avatar, subtitle }
  }

  const counterpart = getCounterpart(currentConv)
  const isRequester = currentConv?.requesterId === currentUserId
  const isPending = currentConv?.requestStatus === 'pending'
  const isAccepted = currentConv?.requestStatus === 'accepted'
  const isDeclined = currentConv?.requestStatus === 'declined'
  const isBlocked = currentConv?.blocked === true
  const canChat = isAccepted && !isBlocked

  const handleSend = (e) => {
    e.preventDefault()
    if (!text.trim() || !canChat || !currentConv) return
    onSendMessage?.(currentConv.id, text.trim())
    setText('')
  }

  return (
    <>
      <PageHeader
        description={
          isMember
            ? tx(
                language,
                'Private, request-gated communication. Connect with verified NGOs and women in your community.',
                'निजी, अनुरोध-आधारित संवाद। नेपालका स्वीकृत संस्था र समुदायका महिलाहरूसँग सुरक्षित रूपमा जोडिनुहोस्।',
              )
            : tx(
                language,
                'Respond to member message requests and provide confidential caseworker support.',
                'सदस्यका सन्देश अनुरोधहरू समीक्षा गरी सुरक्षित केसकार्य सहयोग प्रदान गर्नुहोस्।',
              )
        }
        eyebrow={tx(language, 'PRIVATE MESSAGING', 'निजी सन्देश')}
        title={tx(language, 'Messages', 'सन्देशहरू')}
      />

      <div className="message-layout">
        {/* Left Column: Conversations List */}
        <Card className="message-list-panel">
          <div className="message-panel-heading">
            <h2>{tx(language, 'Conversations', 'कुराकानीहरू')}</h2>
            <Badge tone="neutral">{visibleConversations.length}</Badge>
          </div>

          <div className="conversations-list-stack">
            {visibleConversations.map((conv) => {
              const convCounterpart = getCounterpart(conv)
              const isActive = conv.id === currentConv?.id
              const convIsRequester = conv.requesterId === currentUserId
              const hasUnread = conv.requestStatus === 'pending' && !convIsRequester
              const isConvBlocked = conv.blocked

              return (
                <button
                  className={`conversation-preview ${isActive ? 'conversation-preview-active' : ''}`}
                  key={conv.id}
                  onClick={() => onSelectConversation?.(conv.id)}
                  type="button"
                >
                  <span className="avatar conversation-avatar">
                    <AssetImage
                      alt=""
                      className="avatar-img"
                      fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                      src={convCounterpart.avatar}
                    />
                  </span>
                  <span className="conversation-copy">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{convCounterpart.name}</strong>
                      {isConvBlocked ? (
                        <Badge dot tone="rose">{tx(language, 'Blocked', 'रोकिएको')}</Badge>
                      ) : conv.requestStatus === 'pending' ? (
                        <Badge dot tone="peach">{tx(language, 'Request', 'अनुरोध')}</Badge>
                      ) : conv.requestStatus === 'declined' ? (
                        <Badge tone="neutral">{tx(language, 'Declined', 'अस्वीकृत')}</Badge>
                      ) : (
                        <Badge dot tone="green">{tx(language, 'Connected', 'जोडिएको')}</Badge>
                      )}
                    </div>
                    <small>
                      {isConvBlocked
                        ? tx(language, 'Conversation blocked', 'कुराकानी रोकिएको छ')
                        : conv.requestStatus === 'pending'
                          ? convIsRequester
                            ? tx(language, 'Request sent · waiting', 'अनुरोध पठाइयो · प्रतीक्षामा')
                            : tx(language, 'New request waiting for review', 'नयाँ अनुरोध समीक्षा बाँकी')
                          : conv.requestStatus === 'declined'
                            ? tx(language, 'Request was declined', 'अनुरोध अस्वीकार गरियो')
                            : conv.messages.at(-1)?.text || tx(language, 'Conversation open', 'कुराकानी खुला')}
                    </small>
                  </span>
                  {hasUnread && <span className="unread-dot" />}
                </button>
              )
            })}

            {!visibleConversations.length && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Icon name="chat_bubble_outline" size={24} />
                <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                  {tx(language, 'No conversations yet. Send a request from Find NGOs or Community.', 'कुनै कुराकानी छैन। संस्था वा समुदायबाट अनुरोध पठाउनुहोस्।')}
                </p>
              </div>
            )}
          </div>

          <div className="message-list-note">
            <Icon name="lock" size={16} />
            <span>{tx(language, 'Text only · Request-gated · Never sent to AI', 'पाठ मात्र · अनुमति-आधारित · AI मा जाँदैन')}</span>
          </div>
        </Card>

        {/* Right Column: Chat Panel */}
        <Card className="chat-panel">
          {currentConv ? (
            <>
              {/* Header */}
              <div className="chat-header">
                <span className="avatar conversation-avatar">
                  <AssetImage
                    alt=""
                    className="avatar-img"
                    fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                    src={counterpart.avatar}
                  />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px' }}>{counterpart.name}</h2>
                    {currentConv.type === 'ngo' && (
                      <Badge tone="mint">{tx(language, 'Verified NGO', 'प्रमाणित संस्था')}</Badge>
                    )}
                    {currentConv.type === 'member' && (
                      <Badge tone="lavender">{tx(language, 'Community Peer', 'समुदाय साथी')}</Badge>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {counterpart.subtitle}
                  </span>
                </div>

                <div className="chat-safety-actions">
                  {!isBlocked && (
                    <button
                      className="plain-icon-button"
                      onClick={() => setShowReportModal(true)}
                      title={tx(language, 'Report', 'रिपोर्ट')}
                      type="button"
                    >
                      <Icon name="flag" />
                    </button>
                  )}
                  {isBlocked ? (
                    <Button
                      icon="lock_open"
                      onClick={() => onUnblock?.(currentConv.id)}
                      size="small"
                      variant="secondary"
                    >
                      {tx(language, 'Unblock', 'फुकुवा')}
                    </Button>
                  ) : (
                    <button
                      className="plain-icon-button"
                      onClick={() => onBlock?.(currentConv.id)}
                      title={tx(language, 'Block contact', 'सम्पर्क रोक्नुहोस्')}
                      type="button"
                    >
                      <Icon name="block" />
                    </button>
                  )}
                </div>
              </div>

              {/* State 1: Blocked State */}
              {isBlocked ? (
                <div className="chat-start-state" style={{ padding: '40px 20px' }}>
                  <span className="chat-start-icon" style={{ background: '#fdf2f2', color: '#c53030' }}>
                    <Icon name="block" size={30} />
                  </span>
                  <h3>{tx(language, 'This contact is blocked', 'यो सम्पर्क रोकिएको छ')}</h3>
                  <p>
                    {tx(
                      language,
                      'Messages are disabled between you and this participant. You can unblock anytime.',
                      'तपाईं र यो सहभागी बीच सन्देश बन्द गरिएको छ। तपाईं जुनसुकै बेला फुकुवा गर्न सक्नुहुन्छ।',
                    )}
                  </p>
                  <Button icon="lock_open" onClick={() => onUnblock?.(currentConv.id)} variant="secondary">
                    {tx(language, 'Unblock Contact', 'सम्पर्क फुकुवा गर्नुहोस्')}
                  </Button>
                </div>
              ) : isPending ? (
                /* State 2: Pending Request Workflow */
                <div className="chat-start-state">
                  <span className="chat-start-icon chat-start-icon-peach">
                    <Icon name="hourglass_top" size={30} />
                  </span>
                  <h3>
                    {isRequester
                      ? tx(language, 'Message request sent', 'सन्देश अनुरोध पठाइयो')
                      : tx(language, 'Incoming message request', 'सन्देश अनुरोध प्राप्त भयो')}
                  </h3>
                  <p>
                    {isRequester
                      ? tx(
                          language,
                          `Waiting for ${counterpart.name} to accept. Private chat opens only after acceptance.`,
                          `${counterpart.name} को स्वीकृतिको प्रतीक्षामा। स्वीकार गरेपछि मात्र च्याट खुल्छ।`,
                        )
                      : tx(
                          language,
                          `${counterpart.name} wants to connect with you. Accept to start a private 1:1 conversation.`,
                          `${counterpart.name} ले तपाईंसँग संवाद गर्न अनुरोध पठाउनुभएको छ। कुराकानी सुरु गर्न स्वीकार गर्नुहोस्।`,
                        )}
                  </p>
                  {!isRequester && (
                    <div className="request-actions">
                      <Button icon="check" onClick={() => onAcceptRequest?.(currentConv.id)}>
                        {tx(language, 'Accept request', 'अनुरोध स्वीकार')}
                      </Button>
                      <Button
                        icon="close"
                        onClick={() => onDeclineRequest?.(currentConv.id)}
                        variant="secondary"
                      >
                        {tx(language, 'Decline', 'अस्वीकार')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : isDeclined ? (
                /* State 3: Declined State */
                <div className="chat-start-state">
                  <span className="chat-start-icon" style={{ background: '#f5f3f7', color: '#736879' }}>
                    <Icon name="cancel" size={30} />
                  </span>
                  <h3>{tx(language, 'Request was declined', 'अनुरोध अस्वीकार गरिएको थियो')}</h3>
                  <p>
                    {tx(
                      language,
                      'This conversation is closed. A new request must be sent to connect.',
                      'यो कुराकानी बन्द गरिएको छ। जोडिन नयाँ अनुरोध पठाउनुपर्छ।',
                    )}
                  </p>
                </div>
              ) : (
                /* State 4: Accepted Active Chat Interface */
                <>
                  <div aria-live="polite" className="chat-messages">
                    <div className="chat-date-divider">
                      <span>{tx(language, 'Encrypted 1:1 Private Conversation', 'गोप्य १:१ निजी कुराकानी')}</span>
                    </div>

                    {currentConv.messages.length === 0 && (
                      <div className="chat-start-state chat-start-state-compact">
                        <span className="chat-start-icon"><Icon name="forum" size={27} /></span>
                        <h3>{tx(language, 'Conversation accepted', 'कुराकानी स्वीकृत भयो')}</h3>
                        <p>{tx(language, 'Send a friendly message to begin. Text only.', 'सुरु गर्न सन्देश लेख्नुहोस्। पाठ मात्र।')}</p>
                      </div>
                    )}

                    {currentConv.messages.map((msg) => {
                      const isMine = msg.authorId ? msg.authorId === currentUserId : msg.authorName === currentUserName

                      return (
                        <div
                          className={`message-bubble-row ${isMine ? 'message-bubble-row-mine' : ''}`}
                          key={msg.id}
                        >
                          <span className="message-author">
                            {isMine ? tx(language, 'You', 'तपाईं') : msg.authorName}
                          </span>
                          <div className={`message-bubble ${isMine ? 'message-bubble-mine' : ''}`}>
                            {msg.text}
                          </div>
                          <small>{msg.time}</small>
                        </div>
                      )
                    })}
                  </div>

                  <form className="chat-composer" onSubmit={handleSend}>
                    <textarea
                      aria-label={tx(language, 'Write a message', 'सन्देश लेख्नुहोस्')}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend(e)
                        }
                      }}
                      placeholder={tx(language, 'Write a private message… (Enter to send)', 'निजी सन्देश लेख्नुहोस्… (पठाउन Enter थिच्नुहोस्)')}
                      rows={1}
                      value={text}
                    />
                    <Button disabled={!text.trim()} icon="send" type="submit">
                      {tx(language, 'Send', 'पठाउनुहोस्')}
                    </Button>
                  </form>
                </>
              )}

              {currentConv.reported && (
                <div className="report-confirmation" style={{ margin: '8px 14px' }}>
                  <Icon name="flag" size={17} />
                  {tx(language, 'Report submitted for safety review.', 'सुरक्षा समीक्षाका लागि रिपोर्ट पेस गरियो।')}
                </div>
              )}

              <div className="chat-disclaimer">
                <Icon name="shield_lock" size={15} />
                <span>{tx(language, 'End-to-end privacy: Only participants have access. No global admin inbox.', 'गोपनीयता प्रत्याभूति: सहभागीबाहेक कसैको पहुँच हुँदैन। कुनै केन्द्रीय प्रशासकीय इनबक्स छैन।')}</span>
              </div>
            </>
          ) : (
            <div className="chat-start-state" style={{ margin: 'auto' }}>
              <Icon name="forum" size={36} />
              <h3>{tx(language, 'Select a conversation', 'कुराकानी छान्नुहोस्')}</h3>
            </div>
          )}
        </Card>
      </div>

      <ReportModal
        language={language}
        onClose={() => setShowReportModal(false)}
        onConfirm={(reason) => {
          if (currentConv) onReport?.(currentConv.id, reason)
        }}
        open={showReportModal}
        targetName={counterpart.name || ''}
      />
    </>
  )
}
