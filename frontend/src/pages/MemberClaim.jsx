import { useState } from 'react'
import { Button, Card, Field, Icon, PageHeader } from '../components/ui.jsx'
import { tx } from '../i18n.js'

export default function MemberClaimPage({ claimCode, onClaim, language }) {
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (code.trim() !== claimCode || !/^\d{4,6}$/.test(pin) || !nickname.trim()) {
      setError(tx(language, 'We could not verify those details. Check the code, nickname, and PIN, then try again.', 'विवरण पुष्टि हुन सकेन। कोड, उपनाम र PIN जाँचेर फेरि प्रयास गर्नुहोस्।'))
      return
    }
    onClaim(nickname.trim())
  }

  return (
    <div className="claim-page">
      <PageHeader
        description={tx(language, 'Use the one-time code given to you by your support organization. No email address or phone number is needed.', 'सहयोग संस्थाले दिएको एकपटक प्रयोग हुने कोड राख्नुहोस्। इमेल वा फोन नम्बर आवश्यक छैन।')}
        eyebrow={tx(language, 'PRIVATE MEMBER ACCESS', 'निजी सदस्य पहुँच')}
        title={tx(language, 'Claim your space', 'आफ्नो क्षेत्र खोल्नुहोस्')}
      />
      <Card className="claim-form-card">
        <div className="claim-form-icon"><Icon name="key" size={26} /></div>
        <h2>{tx(language, 'Set up your Member access', 'सदस्य पहुँच तयार गर्नुहोस्')}</h2>
        <p>{tx(language, 'Choose a nickname and a private PIN. Your legal name, email, and phone are not requested.', 'उपनाम र निजी PIN छान्नुहोस्। कानुनी नाम, इमेल वा फोन सोधिँदैन।')}</p>
        <form className="form-stack" onSubmit={submit}>
          <Field label={tx(language, 'One-time claim code', 'एकपटक प्रयोग हुने दाबी कोड')}>
            <input autoComplete="one-time-code" className="input-control claim-code-input" onChange={(event) => { setCode(event.target.value.toUpperCase()); setError('') }} placeholder="NS-000000" required value={code} />
          </Field>
          <Field label={tx(language, 'Choose a nickname', 'उपनाम छान्नुहोस्')}>
            <input autoComplete="nickname" className="input-control" maxLength={24} onChange={(event) => { setNickname(event.target.value); setError('') }} required value={nickname} />
          </Field>
          <Field hint={tx(language, 'Use 4–6 digits. Do not reuse a PIN from another account.', '४–६ अंक प्रयोग गर्नुहोस्। अर्को खाताको PIN नदोहोर्‍याउनुहोस्।')} label={tx(language, 'Create a PIN', 'PIN बनाउनुहोस्')}>
            <input autoComplete="new-password" className="input-control" inputMode="numeric" maxLength={6} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} pattern="\d{4,6}" required type="password" value={pin} />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="claim-privacy-note"><Icon name="visibility_off" size={17} /><span>{tx(language, 'Your profile uses your nickname only. This is a local synthetic demo, not a real account.', 'तपाईंको प्रोफाइलमा उपनाम मात्र देखिन्छ। यो स्थानीय नमुना डेमो हो, वास्तविक खाता होइन।')}</span></div>
          <Button className="claim-submit" icon="arrow_forward" type="submit">{tx(language, 'Claim and continue', 'खोल्नुहोस् र अगाडि बढ्नुहोस्')}</Button>
        </form>
      </Card>
    </div>
  )
}
