import { useMemo, useState } from 'react'
import { AssetImage, Button, Card, Field, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS } from '../config/images.js'
import { tx } from '../i18n.js'

const types = ['All types', 'Training', 'Job', 'Aid']
const locations = ['All locations', 'Kathmandu', 'Lalitpur', 'Pokhara']

function OpportunityModal({ open, onClose, onCreate, language }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Training')
  const [location, setLocation] = useState('Kathmandu')
  const [description, setDescription] = useState('')

  const close = () => {
    setTitle('')
    setDescription('')
    onClose()
  }

  const submit = (event) => {
    event.preventDefault()
    if (!title.trim() || !description.trim()) return
    onCreate({ title: title.trim(), type, location, description: description.trim() })
    close()
  }

  return (
    <Modal
      description={tx(language, 'Share a public opportunity using synthetic demo content.', 'नमुना डेमो सामग्री प्रयोग गरी सार्वजनिक अवसर साझा गर्नुहोस्।')}
      onClose={close}
      open={open}
      title={tx(language, 'Post an opportunity', 'अवसर पोस्ट गर्नुहोस्')}
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label={tx(language, 'Opportunity title', 'अवसरको शीर्षक')}>
          <input className="input-control" onChange={(event) => setTitle(event.target.value)} required value={title} />
        </Field>
        <div className="form-row">
          <Field label={tx(language, 'Type', 'प्रकार')}>
            <select className="input-control" onChange={(event) => setType(event.target.value)} value={type}>
              {types.slice(1).map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
          <Field label={tx(language, 'Location', 'स्थान')}>
            <select className="input-control" onChange={(event) => setLocation(event.target.value)} value={location}>
              {locations.slice(1).map((value) => <option key={value}>{value}</option>)}
            </select>
          </Field>
        </div>
        <Field label={tx(language, 'Public description', 'सार्वजनिक विवरण')}>
          <textarea className="input-control textarea-control" onChange={(event) => setDescription(event.target.value)} required rows={4} value={description} />
        </Field>
        <div className="notice-inline notice-inline-warning"><Icon name="info" /><span>{tx(language, 'Do not include Member or case information. No AI service is connected in this demo.', 'सदस्य वा केसको जानकारी नराख्नुहोस्। यो डेमोमा AI सेवा जोडिएको छैन।')}</span></div>
        <div className="modal-actions">
          <Button onClick={close} variant="secondary">{tx(language, 'Cancel', 'रद्द गर्नुहोस्')}</Button>
          <Button icon="publish" type="submit">{tx(language, 'Publish demo listing', 'डेमो सूची प्रकाशित')}</Button>
        </div>
      </form>
    </Modal>
  )
}

function speak(text, language) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language === 'ne' ? 'ne-NP' : 'en-US'
  window.speechSynthesis.speak(utterance)
  return true
}

export default function OpportunitiesPage({ opportunities, role, onCreateOpportunity, language }) {
  const [typeFilter, setTypeFilter] = useState('All types')
  const [locationFilter, setLocationFilter] = useState('All locations')
  const [showNew, setShowNew] = useState(false)
  const [speakingId, setSpeakingId] = useState('')
  const [speechMessage, setSpeechMessage] = useState('')
  const canPost = role === 'org'

  const filtered = useMemo(() => opportunities.filter((item) => (
    (typeFilter === 'All types' || item.type === typeFilter)
    && (locationFilter === 'All locations' || item.location === locationFilter)
  )), [opportunities, typeFilter, locationFilter])

  const readAloud = (item) => {
    const text = language === 'ne'
      ? `${item.nepaliTitle || item.title}. ${item.nepaliDescription || item.description}`
      : `${item.title}. ${item.description}`
    const started = speak(text, language)
    setSpeakingId(started ? item.id : '')
    setSpeechMessage(started
      ? tx(language, 'Read-aloud started using your device voice.', 'तपाईंको उपकरणको आवाजबाट पढ्न सुरु भयो।')
      : tx(language, 'Read-aloud is not available in this browser.', 'यो ब्राउजरमा पढेर सुनाउने सुविधा उपलब्ध छैन।'))
  }

  return (
    <>
      <PageHeader
        description={tx(language, 'Public training, job, and aid listings. Filter by place and type, then listen using an on-device voice.', 'सार्वजनिक तालिम, रोजगारी र सहयोगका अवसर। स्थान र प्रकार छान्नुहोस्, अनि उपकरणकै आवाजबाट सुन्नुहोस्।')}
        eyebrow={tx(language, 'PUBLIC SUPPORT', 'सार्वजनिक सहयोग')}
        title={tx(language, 'Opportunities', 'अवसरहरू')}
        action={canPost && <Button icon="add" onClick={() => setShowNew(true)}>{tx(language, 'Post opportunity', 'अवसर पोस्ट गर्नुहोस्')}</Button>}
      />
      {speechMessage && <div aria-live="polite" className="speech-status"><Icon name="record_voice_over" size={18} /><span>{speechMessage}</span><button aria-label="Dismiss" className="plain-icon-button" onClick={() => setSpeechMessage('')} type="button"><Icon name="close" size={17} /></button></div>}
      <div className="opportunity-toolbar">
        <div className="filter-control">
          <Icon name="category" />
          <label className="sr-only" htmlFor="opportunity-type">{tx(language, 'Type', 'प्रकार')}</label>
          <select id="opportunity-type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            {types.map((value) => <option key={value} value={value}>{value === 'All types' ? tx(language, value, 'सबै प्रकार') : value}</option>)}
          </select>
        </div>
        <div className="filter-control">
          <Icon name="location_on" />
          <label className="sr-only" htmlFor="opportunity-location">{tx(language, 'Location', 'स्थान')}</label>
          <select id="opportunity-location" onChange={(event) => setLocationFilter(event.target.value)} value={locationFilter}>
            {locations.map((value) => <option key={value} value={value}>{value === 'All locations' ? tx(language, value, 'सबै स्थान') : value}</option>)}
          </select>
        </div>
        <span className="results-count">{filtered.length} {tx(language, 'opportunities', 'अवसर')}</span>
      </div>
      <div className="opportunity-grid">
        {filtered.map((item) => (
          <Card className="opportunity-card" key={item.id}>
            <div className="opportunity-card-top">
              <span className={`opportunity-type-icon opportunity-type-${item.type.toLowerCase()}`}>
                <Icon name={item.type === 'Training' ? 'school' : item.type === 'Job' ? 'work' : 'volunteer_activism'} size={22} />
              </span>
              <span className={`type-label type-label-${item.type.toLowerCase()}`}>{item.type}</span>
              <button
                aria-label={speakingId === item.id ? tx(language, 'Read again', 'फेरि सुनाउनुहोस्') : tx(language, 'Read aloud', 'पढेर सुनाउनुहोस्')}
                className="read-button"
                onClick={() => readAloud(item)}
                type="button"
              >
                <Icon name={speakingId === item.id ? 'volume_up' : 'record_voice_over'} size={19} />
                <span>{tx(language, 'Listen', 'सुन्नुहोस्')}</span>
              </button>
            </div>
            <h2>{language === 'ne' ? item.nepaliTitle || item.title : item.title}</h2>
            <p className="opportunity-description">{language === 'ne' ? item.nepaliDescription || item.description : item.description}</p>
            <div className="opportunity-meta">
              <span><Icon name="location_on" size={17} />{item.location}</span>
              <span><Icon name="calendar_month" size={17} />{item.date || tx(language, 'Open now', 'अहिले खुला')}</span>
            </div>
            <div className="translation-note">
              <Icon name="translate" size={16} />
              <span>{tx(language, 'Sample translation · not AI-generated', 'अनुवाद नमुना · AI द्वारा सिर्जना गरिएको होइन')}</span>
            </div>
          </Card>
        ))}
        {!filtered.length && (
          <Card className="empty-card">
            <AssetImage alt="" className="empty-illustration-img" fallbackSrc={IMAGE_PATHS.illustrations.noResults} src={IMAGE_PATHS.illustrations.noResults} />
            <strong>{tx(language, 'No opportunities match these filters.', 'यी छनोटसँग मिल्ने अवसर छैन।')}</strong>
            <button className="text-button" onClick={() => { setTypeFilter('All types'); setLocationFilter('All locations') }} type="button">{tx(language, 'Clear filters', 'छनोट हटाउनुहोस्')}</button>
          </Card>
        )}
      </div>
      <div className="data-footnote"><Icon name="volume_up" size={16} /><span>{tx(language, 'Read-aloud uses speech available on this device. Private Member data is never sent to an audio service.', 'पढेर सुनाउने सुविधा यस उपकरणको आवाज प्रयोग गर्छ। सदस्यको निजी डेटा अडियो सेवामा पठाइँदैन।')}</span></div>
      <OpportunityModal language={language} onClose={() => setShowNew(false)} onCreate={onCreateOpportunity} open={showNew} />
    </>
  )
}
