import { useState } from 'react'
import { AssetImage, Button, Card, Field, Icon, PageHeader } from '../components/ui.jsx'
import { IMAGE_PATHS, MEMBER_AVATAR_OPTIONS } from '../config/images.js'
import { tx } from '../i18n.js'

function PasswordField({ label, value, onChange, hint, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <Field hint={hint} label={label}>
      <div className="password-input-wrap">
        <input
          autoComplete={autoComplete}
          className="input-control"
          onChange={onChange}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-toggle-btn"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <Icon name={visible ? 'visibility_off' : 'visibility'} size={18} />
        </button>
      </div>
    </Field>
  )
}

export default function AuthPage({
  initialMode = 'login',
  language,
  onLanguageChange,
  onBackToLanding,
  onEnterGuest,
  onMemberRegister,
  onMemberLogin,
  onStaffLogin,
  onNgoRegister,
}) {
  const [mode, setMode] = useState(initialMode === 'register' ? 'member-register' : 'member-login')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Member login fields
  const [loginNickname, setLoginNickname] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Member registration fields
  const [handoverCode, setHandoverCode] = useState('')
  const [regNickname, setRegNickname] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(MEMBER_AVATAR_OPTIONS[0].id)

  // Staff login fields
  const [staffEmail, setStaffEmail] = useState('')
  const [staffPassword, setStaffPassword] = useState('')

  // NGO registration fields
  const [ngoName, setNgoName] = useState('')
  const [ngoLocation, setNgoLocation] = useState('Kathmandu')
  const [ngoWorkArea, setNgoWorkArea] = useState('')
  const [ngoPhone, setNgoPhone] = useState('')
  const [ngoDescription, setNgoDescription] = useState('')
  const [ngoAdminEmail, setNgoAdminEmail] = useState('')
  const [ngoAdminPassword, setNgoAdminPassword] = useState('')

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setStatusMessage('')
  }

  const handleMemberLogin = (event) => {
    event.preventDefault()
    setError('')
    if (loginNickname.trim().length < 2 || loginPassword.length < 6) {
      setError(
        tx(
          language,
          'Enter your nickname and a password of at least 6 characters.',
          'आफ्नो उपनाम र कम्तीमा ६ अक्षरको पासवर्ड राख्नुहोस्।',
        ),
      )
      return
    }
    setSubmitting(true)
    const result = onMemberLogin({ nickname: loginNickname.trim(), password: loginPassword })
    setSubmitting(false)
    if (!result?.ok) {
      setError(
        result?.error ||
          tx(
            language,
            'Could not sign in with those demo credentials.',
            'यी नमुना विवरणबाट लगइन हुन सकेन।',
          ),
      )
    }
  }

  const handleMemberRegister = (event) => {
    event.preventDefault()
    setError('')
    const normalizedCode = handoverCode.trim().toUpperCase()
    if (!/^NS-[A-Z0-9]{6}$/.test(normalizedCode)) {
      setError(
        tx(
          language,
          'Enter a valid NGO handover code (example: NS-123456).',
          'मान्य संस्था हस्तान्तरण कोड राख्नुहोस् (उदाहरण: NS-123456)।',
        ),
      )
      return
    }
    if (regNickname.trim().length < 2 || regNickname.trim().length > 24) {
      setError(
        tx(
          language,
          'Choose a unique nickname between 2 and 24 characters.',
          '२ देखि २४ अक्षरसम्मको अद्वितीय उपनाम छान्नुहोस्।',
        ),
      )
      return
    }
    if (regPassword.length < 6) {
      setError(
        tx(
          language,
          'Password must be at least 6 characters long.',
          'पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्छ।',
        ),
      )
      return
    }
    if (regPassword !== regConfirmPassword) {
      setError(
        tx(
          language,
          'Passwords do not match.',
          'दुवै पासवर्ड मिलेनन्।',
        ),
      )
      return
    }

    setSubmitting(true)
    const result = onMemberRegister({
      code: normalizedCode,
      nickname: regNickname.trim(),
      password: regPassword,
      avatarId: selectedAvatarId,
    })
    setSubmitting(false)
    if (!result?.ok) {
      setError(
        result?.error ||
          tx(
            language,
            'Handover code could not be verified.',
            'हस्तान्तरण कोड प्रमाणित हुन सकेन।',
          ),
      )
    }
  }

  const handleStaffLogin = (event) => {
    event.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail.trim()) || staffPassword.length < 6) {
      setError(
        tx(
          language,
          'Enter a valid staff email address and password (min 6 characters).',
          'मान्य कर्मचारी इमेल र कम्तीमा ६ अक्षरको पासवर्ड राख्नुहोस्।',
        ),
      )
      return
    }
    setSubmitting(true)
    const result = onStaffLogin({ email: staffEmail.trim(), password: staffPassword })
    setSubmitting(false)
    if (!result?.ok) {
      setError(
        result?.error ||
          tx(
            language,
            'Use a demo staff email or preview button while Firebase Auth is pending.',
            'Firebase Auth जडान नभएसम्म नमुना कर्मचारी इमेल वा डेमो बटन प्रयोग गर्नुहोस्।',
          ),
      )
    }
  }

  const handleNgoRegister = (event) => {
    event.preventDefault()
    setError('')
    if (!ngoName.trim() || !ngoWorkArea.trim() || !ngoPhone.trim() || !ngoDescription.trim()) {
      setError(
        tx(
          language,
          'Complete all public organization details.',
          'संस्थाका सबै सार्वजनिक विवरण भर्नुहोस्।',
        ),
      )
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ngoAdminEmail.trim()) || ngoAdminPassword.length < 6) {
      setError(
        tx(
          language,
          'Provide a valid staff email and password (min 6 characters).',
          'मान्य संस्था प्रशासक इमेल र कम्तीमा ६ अक्षरको पासवर्ड राख्नुहोस्।',
        ),
      )
      return
    }

    onNgoRegister({
      name: ngoName.trim(),
      location: ngoLocation,
      category: ngoWorkArea.trim(),
      focus: ngoDescription.trim(),
      contactPhone: ngoPhone.trim(),
      contactEmail: ngoAdminEmail.trim(),
    })
    setStatusMessage(
      tx(
        language,
        'Demo NGO application submitted locally. In the connected build, Platform Admin verification is required before staff access.',
        'नमुना संस्थाको आवेदन स्थानीय रूपमा दर्ता भयो। पूर्ण संस्करणमा पहुँच पाउनुअघि प्लेटफर्म प्रशासकको स्वीकृति आवश्यक हुन्छ।',
      ),
    )
    setNgoName('')
    setNgoWorkArea('')
    setNgoPhone('')
    setNgoDescription('')
    setNgoAdminEmail('')
    setNgoAdminPassword('')
  }

  return (
    <div className="auth-page">
      <header className="landing-navbar">
        <div className="landing-container landing-navbar-inner">
          <button className="landing-brand landing-brand-btn" onClick={onBackToLanding} type="button">
            <AssetImage
              alt="Naya Sahara"
              className="landing-brand-logo"
              fallbackSrc={IMAGE_PATHS.branding.logoMark}
              src={IMAGE_PATHS.branding.logo}
            />
          </button>
          <div className="landing-nav-actions">
            <div aria-label="Language" className="language-toggle">
              <button
                aria-pressed={language === 'ne'}
                className={language === 'ne' ? 'language-active' : ''}
                onClick={() => onLanguageChange('ne')}
                type="button"
              >
                नेपाली
              </button>
              <button
                aria-pressed={language === 'en'}
                className={language === 'en' ? 'language-active' : ''}
                onClick={() => onLanguageChange('en')}
                type="button"
              >
                EN
              </button>
            </div>
            <Button onClick={onBackToLanding} variant="secondary">
              {tx(language, 'Home', 'गृहपृष्ठ')}
            </Button>
            <Button onClick={() => onEnterGuest('home')} variant="secondary">
              {tx(language, 'Guest browse', 'अतिथि मोड')}
            </Button>
          </div>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-shell">
          <PageHeader
            description={tx(
              language,
              'Women join with an NGO handover code, unique nickname, password, and illustrated avatar. Staff sign in with organizational credentials.',
              'महिलाहरूले संस्थाको हस्तान्तरण कोड, उपनाम, पासवर्ड र चित्रित अवतारबाट दर्ता गर्छन्। संस्था र प्रशासक कर्मचारीले इमेलबाट लगइन गर्छन्।',
            )}
            eyebrow={tx(language, 'ACCESS & ONBOARDING', 'पहुँच र दर्ता')}
            title={tx(language, 'Sign in or register', 'लगइन वा दर्ता गर्नुहोस्')}
          />

          <div aria-label={tx(language, 'Authentication modes', 'प्रमाणीकरण विकल्प')} className="auth-tabs" role="tablist">
            {[
              ['member-login', tx(language, 'Woman Login', 'सदस्य लगइन')],
              ['member-register', tx(language, 'Woman Register', 'सदस्य दर्ता')],
              ['staff-login', tx(language, 'NGO / Admin Login', 'संस्था / प्रशासक लगइन')],
              ['ngo-register', tx(language, 'Register NGO', 'संस्था दर्ता')],
            ].map(([id, label]) => (
              <button
                aria-selected={mode === id}
                className={`auth-tab ${mode === id ? 'auth-tab-active' : ''}`}
                key={id}
                onClick={() => switchMode(id)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="auth-grid">
            <Card className="auth-card">
              {mode === 'member-login' && (
                <form className="form-stack" onSubmit={handleMemberLogin}>
                  <h2>{tx(language, 'Woman / Member Sign In', 'महिला / सदस्य लगइन')}</h2>
                  <p className="auth-subtitle">
                    {tx(
                      language,
                      'Use your nickname and password. No email address or phone number is needed.',
                      'आफ्नो उपनाम र पासवर्ड प्रयोग गर्नुहोस्। इमेल वा फोन नम्बर आवश्यक छैन।',
                    )}
                  </p>
                  <Field label={tx(language, 'Nickname', 'उपनाम')}>
                    <input
                      autoComplete="username"
                      className="input-control"
                      maxLength={24}
                      onChange={(event) => { setLoginNickname(event.target.value); setError('') }}
                      placeholder="Sajilo"
                      required
                      value={loginNickname}
                    />
                  </Field>
                  <PasswordField
                    autoComplete="current-password"
                    label={tx(language, 'Password', 'पासवर्ड')}
                    onChange={(event) => { setLoginPassword(event.target.value); setError('') }}
                    value={loginPassword}
                  />
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <div className="notice-inline notice-inline-info">
                    <Icon name="lock" />
                    <span>
                      {tx(
                        language,
                        'Frontend UI validation active. Backend custom-token verification will be connected in the Firebase integration phase.',
                        'हाल फ्रन्टएन्ड जाँच सक्रिय छ। ब्याकएन्ड कस्टम-टोकन प्रमाणीकरण अर्को चरणमा जोडिनेछ।',
                      )}
                    </span>
                  </div>
                  <Button disabled={submitting} icon="login" type="submit">
                    {submitting ? tx(language, 'Checking…', 'जाँच्दै…') : tx(language, 'Sign in as Member', 'सदस्यको रूपमा लगइन')}
                  </Button>
                </form>
              )}

              {mode === 'member-register' && (
                <form className="form-stack" onSubmit={handleMemberRegister}>
                  <h2>{tx(language, 'Register with NGO Handover Code', 'संस्थाको हस्तान्तरण कोडबाट दर्ता')}</h2>
                  <p className="auth-subtitle">
                    {tx(
                      language,
                      'Enter the one-time 72-hour code issued by your NGO. Your legal name, email, and phone are never requested.',
                      'संस्थाले दिएको ७२ घण्टा मान्य एकपटक प्रयोग हुने कोड राख्नुहोस्। वास्तविक नाम, इमेल वा फोन सोधिँदैन।',
                    )}
                  </p>
                  <Field
                    hint={tx(language, 'Demo code available in this frontend preview: NS-240001', 'यस फ्रन्टएन्ड डेमोमा नमुना कोड: NS-240001')}
                    label={tx(language, 'NGO handover code', 'संस्था हस्तान्तरण कोड')}
                  >
                    <input
                      autoComplete="one-time-code"
                      className="input-control claim-code-input"
                      onChange={(event) => { setHandoverCode(event.target.value.toUpperCase()); setError('') }}
                      placeholder="NS-240001"
                      required
                      value={handoverCode}
                    />
                  </Field>
                  <Field label={tx(language, 'Choose a unique nickname', 'अद्वितीय उपनाम छान्नुहोस्')}>
                    <input
                      autoComplete="username"
                      className="input-control"
                      maxLength={24}
                      onChange={(event) => { setRegNickname(event.target.value); setError('') }}
                      placeholder={tx(language, 'e.g. Ujyalo', 'जस्तै: उज्यालो')}
                      required
                      value={regNickname}
                    />
                  </Field>
                  <div className="form-row">
                    <PasswordField
                      autoComplete="new-password"
                      hint={tx(language, 'Minimum 6 characters', 'कम्तीमा ६ अक्षर')}
                      label={tx(language, 'Create password', 'पासवर्ड बनाउनुहोस्')}
                      onChange={(event) => { setRegPassword(event.target.value); setError('') }}
                      value={regPassword}
                    />
                    <PasswordField
                      autoComplete="new-password"
                      label={tx(language, 'Confirm password', 'पासवर्ड पुष्टि')}
                      onChange={(event) => { setRegConfirmPassword(event.target.value); setError('') }}
                      value={regConfirmPassword}
                    />
                  </div>
                  <fieldset className="avatar-picker-fieldset">
                    <legend>{tx(language, 'Choose an illustrated avatar', 'चित्रित अवतार छान्नुहोस्')}</legend>
                    <div className="avatar-picker-grid">
                      {MEMBER_AVATAR_OPTIONS.map((avatar) => (
                        <button
                          aria-pressed={selectedAvatarId === avatar.id}
                          className={`avatar-option ${selectedAvatarId === avatar.id ? 'avatar-option-active' : ''}`}
                          key={avatar.id}
                          onClick={() => setSelectedAvatarId(avatar.id)}
                          type="button"
                        >
                          <AssetImage alt={avatar.label} className="avatar-option-img" fallbackSrc={avatar.src} src={avatar.src} />
                          <span>{avatar.label}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <Button disabled={submitting} icon="person_add" type="submit">
                    {submitting ? tx(language, 'Creating…', 'बनाउँदै…') : tx(language, 'Create Member Account', 'सदस्य खाता बनाउनुहोस्')}
                  </Button>
                </form>
              )}

              {mode === 'staff-login' && (
                <form className="form-stack" onSubmit={handleStaffLogin}>
                  <h2>{tx(language, 'NGO & Platform Admin Login', 'संस्था र प्लेटफर्म प्रशासक लगइन')}</h2>
                  <p className="auth-subtitle">
                    {tx(
                      language,
                      'Staff accounts authenticate with Firebase Authentication. Admin and NGO permissions are verified server-side, never via public role switches.',
                      'कर्मचारी खाताले Firebase Authentication प्रयोग गर्छन्। प्रशासक र संस्था अनुमति सर्भरबाट प्रमाणित हुन्छन्।',
                    )}
                  </p>
                  <Field label={tx(language, 'Staff email', 'कर्मचारी इमेल')}>
                    <input
                      autoComplete="email"
                      className="input-control"
                      onChange={(event) => { setStaffEmail(event.target.value); setError('') }}
                      placeholder="staff@nayasahara.example"
                      required
                      type="email"
                      value={staffEmail}
                    />
                  </Field>
                  <PasswordField
                    autoComplete="current-password"
                    label={tx(language, 'Password', 'पासवर्ड')}
                    onChange={(event) => { setStaffPassword(event.target.value); setError('') }}
                    value={staffPassword}
                  />
                  {error && <p className="form-error" role="alert">{error}</p>}
                  <Button disabled={submitting} icon="shield_person" type="submit">
                    {submitting ? tx(language, 'Signing in…', 'लगइन हुँदै…') : tx(language, 'Sign in as Staff', 'कर्मचारी लगइन')}
                  </Button>
                </form>
              )}

              {mode === 'ngo-register' && (
                <form className="form-stack" onSubmit={handleNgoRegister}>
                  <h2>{tx(language, 'Register a Support Organization', 'सहयोग संस्था दर्ता गर्नुहोस्')}</h2>
                  <p className="auth-subtitle">
                    {tx(
                      language,
                      'Submit public organization details for Platform Admin verification. Do not enter member or personal case information.',
                      'प्लेटफर्म प्रशासकको स्वीकृतिका लागि संस्थाको सार्वजनिक विवरण पेश गर्नुहोस्। सदस्य वा व्यक्तिगत विवरण नराख्नुहोस्।',
                    )}
                  </p>
                  <div className="form-row">
                    <Field label={tx(language, 'Organization name', 'संस्थाको नाम')}>
                      <input className="input-control" onChange={(event) => setNgoName(event.target.value)} required value={ngoName} />
                    </Field>
                    <Field label={tx(language, 'District / Location', 'जिल्ला / स्थान')}>
                      <select className="input-control" onChange={(event) => setNgoLocation(event.target.value)} value={ngoLocation}>
                        <option>Kathmandu</option>
                        <option>Lalitpur</option>
                        <option>Pokhara</option>
                        <option>Other</option>
                      </select>
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label={tx(language, 'Main area of work', 'मुख्य कार्य क्षेत्र')}>
                      <input className="input-control" onChange={(event) => setNgoWorkArea(event.target.value)} placeholder={tx(language, 'Skills, legal aid, shelter…', 'सीप, कानुनी सहायता…')} required value={ngoWorkArea} />
                    </Field>
                    <Field label={tx(language, 'Public contact number', 'सार्वजनिक सम्पर्क नम्बर')}>
                      <input className="input-control" onChange={(event) => setNgoPhone(event.target.value)} placeholder="+977-01-5550199" required value={ngoPhone} />
                    </Field>
                  </div>
                  <Field label={tx(language, 'Public service description', 'सार्वजनिक सेवा विवरण')}>
                    <textarea className="input-control textarea-control" onChange={(event) => setNgoDescription(event.target.value)} required rows={3} value={ngoDescription} />
                  </Field>
                  <div className="form-row">
                    <Field label={tx(language, 'NGO Admin email', 'संस्था प्रशासक इमेल')}>
                      <input autoComplete="email" className="input-control" onChange={(event) => setNgoAdminEmail(event.target.value)} required type="email" value={ngoAdminEmail} />
                    </Field>
                    <PasswordField
                      autoComplete="new-password"
                      label={tx(language, 'Create staff password', 'पासवर्ड बनाउनुहोस्')}
                      onChange={(event) => setNgoAdminPassword(event.target.value)}
                      value={ngoAdminPassword}
                    />
                  </div>
                  {error && <p className="form-error" role="alert">{error}</p>}
                  {statusMessage && (
                    <div className="notice-inline notice-inline-info" role="status">
                      <Icon name="check_circle" />
                      <span>{statusMessage}</span>
                    </div>
                  )}
                  <Button icon="send" type="submit">
                    {tx(language, 'Submit NGO for Verification', 'स्वीकृतिका लागि पठाउनुहोस्')}
                  </Button>
                </form>
              )}
            </Card>

            <aside className="auth-aside">
              <Card className="auth-demo-card">
                <p className="eyebrow">{tx(language, 'FRONTEND PREVIEW ONLY', 'फ्रन्टएन्ड पूर्वावलोकन मात्र')}</p>
                <h3>{tx(language, 'Synthetic demo accounts', 'नमुना डेमो खाताहरू')}</h3>
                <p>
                  {tx(
                    language,
                    'Before Firebase Authentication is connected in the next phase, use these clearly labelled synthetic preview actions to inspect each authenticated dashboard.',
                    'अर्को चरणमा Firebase Authentication जडान हुनुअघि यी नमुना पूर्वावलोकन बटनबाट ड्यासबोर्ड हेर्न सकिन्छ।',
                  )}
                </p>
                <div className="auth-demo-actions">
                  <Button
                    icon="person"
                    onClick={() => onMemberLogin({ nickname: 'Sajilo', password: 'demo-member-password', preview: true })}
                    variant="secondary"
                  >
                    {tx(language, 'Preview Member (Sajilo)', 'सदस्य पूर्वावलोकन (सजिलो)')}
                  </Button>
                  <Button
                    icon="apartment"
                    onClick={() => onStaffLogin({ email: 'asha@sathi.example', password: 'demo-staff-password', previewRole: 'org' })}
                    variant="secondary"
                  >
                    {tx(language, 'Preview NGO Dashboard', 'संस्था ड्यासबोर्ड पूर्वावलोकन')}
                  </Button>
                  <Button
                    icon="admin_panel_settings"
                    onClick={() => onStaffLogin({ email: 'admin@nayasahara.example', password: 'demo-admin-password', previewRole: 'admin' })}
                    variant="secondary"
                  >
                    {tx(language, 'Preview Platform Admin', 'प्लेटफर्म प्रशासक पूर्वावलोकन')}
                  </Button>
                </div>
                <div className="notice-inline notice-inline-warning">
                  <Icon name="security" />
                  <span>
                    {tx(
                      language,
                      'Demo shortcuts are for local UI review only and will be replaced by real Firebase Auth & server claims.',
                      'यी डेमो बटनहरू स्थानीय UI जाँचका लागि मात्र हुन् र वास्तविक Firebase Auth सँग बदलिनेछन्।',
                    )}
                  </span>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
