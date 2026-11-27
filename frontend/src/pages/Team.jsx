import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Field, Icon, Modal, PageHeader } from '../components/ui.jsx'
import { IMAGE_PLACEHOLDERS } from '../config/images.js'
import { tx } from '../i18n.js'

function CaseworkerModal({ open, onClose, onSave, worker, language }) {
  const [displayName, setDisplayName] = useState(worker?.displayName || '')
  const [roleTitle, setRoleTitle] = useState(worker?.roleTitle || 'Community Support Caseworker')
  const [bio, setBio] = useState(worker?.bio || '')

  const submit = (event) => {
    event.preventDefault()
    if (!displayName.trim()) return
    onSave({
      displayName: displayName.trim(),
      roleTitle: roleTitle.trim(),
      bio: bio.trim(),
    })
    onClose()
  }

  const isEditing = Boolean(worker)

  return (
    <Modal
      description={tx(
        language,
        'Caseworker profiles are for internal organization roster and support contact display only.',
        'केसकर्मी प्रोफाइल संस्थाको आन्तरिक सूची र सहयोग सम्पर्क प्रयोजनका लागि मात्र हुन्।',
      )}
      onClose={onClose}
      open={open}
      title={
        isEditing
          ? tx(language, 'Edit Caseworker Profile', 'केसकर्मी विवरण सम्पादन')
          : tx(language, 'Add Caseworker to Roster', 'नयाँ केसकर्मी थप्नुहोस्')
      }
    >
      <form className="form-stack" onSubmit={submit}>
        <Field label={tx(language, 'Full / Display Name', 'प्रदर्शन नाम')}>
          <input
            className="input-control"
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Sita Shrestha"
            required
            value={displayName}
          />
        </Field>

        <Field label={tx(language, 'Role / Designation', 'पद / जिम्मेवारी')}>
          <input
            className="input-control"
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. Community Caseworker, Reintegration Specialist"
            required
            value={roleTitle}
          />
        </Field>

        <Field label={tx(language, 'Support focus / Bio note', 'सहयोग क्षेत्र / छोटो विवरण')}>
          <textarea
            className="input-control textarea-control"
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. Focus on vocational liaison and community accompaniment."
            rows={3}
            value={bio}
          />
        </Field>

        <div className="notice-inline notice-inline-info">
          <Icon name="info" />
          <span>{tx(language, 'Caseworkers do not have separate login credentials. Casework is administered by the Org Admin.', 'केसकर्मीहरूको छुट्टै लगइन हुँदैन। सम्पूर्ण कार्य संस्था प्रशासकद्वारा व्यवस्थित हुन्छ।')}</span>
        </div>

        <div className="modal-actions">
          <Button onClick={onClose} variant="secondary">{tx(language, 'Cancel', 'रद्द गर्नुहोस्')}</Button>
          <Button icon="save" type="submit">
            {isEditing ? tx(language, 'Save changes', 'परिवर्तन सुरक्षित') : tx(language, 'Add to roster', 'सूचीमा थप्नुहोस्')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function TeamPage({ team, onAdd, onUpdate, onToggle, language }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)

  const handleAddSubmit = (workerData) => {
    onAdd?.(workerData)
    setShowAddModal(false)
  }

  const handleEditSubmit = (workerData) => {
    if (editingWorker) {
      onUpdate?.(editingWorker.id, workerData)
      setEditingWorker(null)
    }
  }

  return (
    <>
      <PageHeader
        description={tx(
          language,
          'Informational caseworker directory for your organization. Caseworkers do not have separate login accounts or sensitive case assignments.',
          'तपाईंको संस्थाको केसकर्मी सूची। केसकर्मीका लागि छुट्टै लगइन वा संवेदनशील केस जिम्मेवारी हुँदैन।',
        )}
        eyebrow={tx(language, 'ORGANIZATION WORKSPACE', 'संस्था कार्यस्थल')}
        title={tx(language, 'Caseworker Directory', 'केसकर्मी निर्देशिका')}
        action={
          <Button icon="person_add" onClick={() => setShowAddModal(true)}>
            {tx(language, 'Add caseworker', 'केसकर्मी थप्नुहोस्')}
          </Button>
        }
      />

      <div className="notice-inline notice-inline-info approval-note">
        <Icon name="badge" />
        <span>{tx(language, 'Staff profiles show service information only; court dates and case assignments are not shown.', 'कर्मचारी प्रोफाइलमा सेवा सम्बन्धी जानकारी मात्र देखाइन्छ; अदालतका मिति र केस जिम्मेवारी देखाइँदैन।')}</span>
      </div>

      <div className="team-list">
        {team.map((worker) => (
          <Card className="team-card" key={worker.id}>
            <div className="team-person">
              <span className="team-avatar">
                <AssetImage
                  alt={`${worker.displayName} portrait`}
                  className="team-avatar-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.caseworker}
                  src={worker.photoUrl || IMAGE_PLACEHOLDERS.caseworker}
                />
              </span>
              <div className="team-person-info">
                <strong>{worker.displayName}</strong>
                <span className="worker-role-title">{worker.roleTitle || tx(language, 'Community Support Caseworker', 'सामुदायिक सहयोग केसकर्मी')}</span>
                {worker.bio && <p className="worker-bio">{worker.bio}</p>}
              </div>
            </div>

            <div className="team-assignment">
              <span className="worker-metric-pill">
                <Icon name="volunteer_activism" size={16} />
                <span>{tx(language, 'Support liaison', 'सहयोग सम्पर्क')}</span>
              </span>
            </div>

            <div className="team-status">
              <Badge dot tone={worker.active ? 'green' : 'neutral'}>
                {worker.active ? tx(language, 'Active', 'सक्रिय') : tx(language, 'Inactive', 'निष्क्रिय')}
              </Badge>
              <div className="team-actions-row">
                <button
                  className="text-button"
                  onClick={() => setEditingWorker(worker)}
                  type="button"
                >
                  <Icon name="edit" size={16} />
                  {tx(language, 'Edit', 'सम्पादन')}
                </button>
                <button
                  className="text-button"
                  onClick={() => onToggle?.(worker.id)}
                  type="button"
                >
                  <Icon name={worker.active ? 'pause_circle' : 'play_circle'} size={17} />
                  {worker.active ? tx(language, 'Deactivate', 'निष्क्रिय') : tx(language, 'Activate', 'सक्रिय')}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showAddModal && (
        <CaseworkerModal
          key="add-modal"
          language={language}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSubmit}
          open={showAddModal}
        />
      )}

      {editingWorker && (
        <CaseworkerModal
          key={`edit-${editingWorker.id}`}
          language={language}
          onClose={() => setEditingWorker(null)}
          onSave={handleEditSubmit}
          open={Boolean(editingWorker)}
          worker={editingWorker}
        />
      )}
    </>
  )
}
