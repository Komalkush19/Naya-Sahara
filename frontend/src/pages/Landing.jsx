import { useState } from 'react'
import { AssetImage, Badge, Button, Card, Icon, Modal } from '../components/ui.jsx'
import { IMAGE_PATHS, IMAGE_PLACEHOLDERS } from '../config/images.js'
import { tx } from '../i18n.js'

export default function LandingPage({
  language,
  onLanguageChange,
  onEnterGuest,
  onOpenAuth,
  organizations,
  notices,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)

  const verifiedNgos = organizations.filter((org) => org.status === 'approved').slice(0, 3)
  const publishedNotices = notices.filter((notice) => notice.status === 'approved').slice(0, 3)

  const navLinks = [
    { href: '#landing-top', en: 'Home', ne: 'गृहपृष्ठ' },
    { href: '#landing-about', en: 'About', ne: 'हाम्रो बारेमा' },
    { href: '#landing-ngos', en: 'Organizations', ne: 'संस्थाहरू' },
    { href: '#landing-notices', en: 'Notices', ne: 'सूचनाहरू' },
  ]

  const steps = [
    {
      icon: 'verified_user',
      title: tx(language, '1. Verified NGOs publish support', '१. स्वीकृत संस्थाले सहयोग साझा गर्छन्'),
      body: tx(
        language,
        'Registered NGOs receive Platform Admin verification and share public training, job, and aid notices.',
        'दर्ता भएका संस्थाले प्लेटफर्म प्रशासकको स्वीकृतिपछि तालिम, रोजगारी र सहयोग सूचना प्रकाशित गर्छन्।',
      ),
    },
    {
      icon: 'badge',
      title: tx(language, '2. Women join with a handover code', '२. महिलाहरू हस्तान्तरण कोडबाट जोडिन्छिन्'),
      body: tx(
        language,
        'Using an NGO handover code, a woman picks a nickname, password, and illustrated avatar—no email or phone required.',
        'संस्थाले दिएको कोड, उपनाम, पासवर्ड र चित्रित अवतार छानी इमेल वा फोनबिनै खाता बनाइन्छ।',
      ),
    },
    {
      icon: 'campaign',
      title: tx(language, '3. Understandable public notices', '३. सहज सरकारी र संस्थागत सूचना'),
      body: tx(
        language,
        'Government and NGO notices stay paired with translations, simplified summaries, and read-aloud support.',
        'सरकारी र संस्थागत सूचनाहरू अनुवाद, सरल सारांश र पढेर सुनाउने सुविधাসহ उपलब्ध हुन्छन्।',
      ),
    },
    {
      icon: 'forum',
      title: tx(language, '4. Safe, request-gated chat', '४. सुरक्षित र अनुमति-आधारित संवाद'),
      body: tx(
        language,
        'Women send text-only message requests to NGOs or opted-in community members; chat opens only after acceptance.',
        'महिलाले संस्था वा समुदाय सदस्यलाई सन्देश अनुरोध पठाउँछिन् र स्वीकारपछि मात्र पाठ संवाद खुल्छ।',
      ),
    },
  ]

  return (
    <div className="landing-page" id="landing-top">
      <header className="landing-navbar">
        <div className="landing-container landing-navbar-inner">
          <a className="landing-brand" href="#landing-top">
            <AssetImage
              alt="Naya Sahara"
              className="landing-brand-logo"
              fallbackSrc={IMAGE_PATHS.branding.logoMark}
              src={IMAGE_PATHS.branding.logo}
            />
          </a>

          <nav aria-label={tx(language, 'Public navigation', 'सार्वजनिक नेभिगेसन')} className="landing-nav-links">
            {navLinks.map((link) => (
              <a className="landing-nav-link" href={link.href} key={link.href}>
                {tx(language, link.en, link.ne)}
              </a>
            ))}
          </nav>

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
            <Button onClick={() => onEnterGuest('home')} variant="secondary">
              {tx(language, 'Guest browse', 'अतिथि मोड')}
            </Button>
            <Button onClick={() => onOpenAuth('login')} variant="secondary">
              {tx(language, 'Login', 'लगइन')}
            </Button>
            <Button onClick={() => onOpenAuth('register')}>
              {tx(language, 'Register', 'दर्ता')}
            </Button>
            <button
              aria-expanded={mobileMenuOpen}
              aria-label={tx(language, 'Toggle menu', 'मेनु खोल्नुहोस्')}
              className="icon-button landing-mobile-toggle"
              onClick={() => setMobileMenuOpen((open) => !open)}
              type="button"
            >
              <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="landing-mobile-drawer">
            <nav aria-label={tx(language, 'Mobile navigation', 'मोबाइल नेभिगेसन')} className="landing-mobile-links">
              {navLinks.map((link) => (
                <a
                  href={link.href}
                  key={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {tx(language, link.en, link.ne)}
                </a>
              ))}
            </nav>
            <div className="landing-mobile-buttons">
              <Button onClick={() => { setMobileMenuOpen(false); onEnterGuest('home') }} variant="secondary">
                {tx(language, 'Browse as Guest', 'अतिथिको रूपमा हेर्नुहोस्')}
              </Button>
              <Button onClick={() => { setMobileMenuOpen(false); onOpenAuth('login') }} variant="secondary">
                {tx(language, 'Login', 'लगइन')}
              </Button>
              <Button onClick={() => { setMobileMenuOpen(false); onOpenAuth('register') }}>
                {tx(language, 'Register', 'दर्ता')}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <Badge dot tone="lavender">
                {tx(language, 'HACKATHON PROTOTYPE · SYNTHETIC DEMO DATA', 'ह्याकाथन प्रोटोटाइप · नमुना डेटा मात्र')}
              </Badge>
              <h1>
                {tx(
                  language,
                  'Continuity of support and dignified new beginnings across Nepal.',
                  'नेपालभर महिलाहरूका लागि निरन्तर सहयोग र मर्यादित नयाँ सुरुवात।',
                )}
              </h1>
              <p>
                {tx(
                  language,
                  'Naya Sahara connects verified support organizations, understandable public notices, skill opportunities, and safe pseudonymous peer communication—without requiring real names, email addresses, or phone numbers from women.',
                  'नयाँ सहाराले स्वीकृत सहयोग संस्थाहरू, सहज सरकारी तथा संस्थागत सूचनाहरू, सीपका अवसर र सुरक्षित उपनाम-आधारित संवादलाई एकै ठाउँमा जोड्छ—महिलाहरूका लागि इमेल वा फोन नम्बरबिना नै।',
                )}
              </p>
              <div className="landing-hero-cta">
                <Button icon="explore" onClick={() => onEnterGuest('home')}>
                  {tx(language, 'Browse as Guest', 'अतिथिको रूपमा हेर्नुहोस्')}
                </Button>
                <Button icon="login" onClick={() => onOpenAuth('login')} variant="secondary">
                  {tx(language, 'Member & NGO Login', 'सदस्य र संस्था लगइन')}
                </Button>
                <Button icon="person_add" onClick={() => onOpenAuth('register')} variant="secondary">
                  {tx(language, 'Register with Code', 'कोडबाट दर्ता गर्नुहोस्')}
                </Button>
              </div>
              <div className="landing-trust-strip">
                <span><Icon name="visibility_off" size={18} />{tx(language, 'Nickname & avatar identity', 'उपनाम र चित्रित अवतार पहिचान')}</span>
                <span><Icon name="verified_user" size={18} />{tx(language, 'Admin-reviewed public notices', 'प्रशासकद्वारा समीक्षित सूचना')}</span>
                <span><Icon name="lock" size={18} />{tx(language, 'Text-only request-gated chat', 'अनुरोध-आधारित सुरक्षित संवाद')}</span>
              </div>
            </div>

            <div className="landing-hero-media">
              <AssetImage
                alt={tx(
                  language,
                  'Women connecting with community support services in Nepal',
                  'नेपालमा सामुदायिक सहयोग सेवासँग जोडिँदै गरेका महिलाहरू',
                )}
                className="landing-hero-img"
                fallbackSrc={IMAGE_PLACEHOLDERS.heroSupport}
                src={IMAGE_PATHS.hero.support}
              />
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft">
          <div className="landing-container landing-split-grid">
            <Card className="landing-intro-card">
              <div className="landing-intro-media">
                <AssetImage
                  alt={tx(
                    language,
                    'Women participating in a supportive community session',
                    'सहयोगी सामुदायिक सत्रमा सहभागी महिलाहरू',
                  )}
                  className="landing-card-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.heroCommunity}
                  src={IMAGE_PATHS.hero.community}
                />
              </div>
              <div className="landing-intro-body">
                <p className="eyebrow">{tx(language, 'SAFE COMMUNITY', 'सुरक्षित समुदाय')}</p>
                <h2>{tx(language, 'Pseudonymous peer connection without public exposure', 'सार्वजनिक पहिचानबिनाको सुरक्षित सामुदायिक सम्पर्क')}</h2>
                <p>
                  {tx(
                    language,
                    'Women who opt into Your Community are represented only by a nickname, an illustrated avatar, approximate district or municipality, and optional skills—never real photos or legal details.',
                    'समुदाय निर्देशिकामा स्वेच्छाले जोडिने महिलाहरू केवल उपनाम, चित्रित अवतार, अनुमानित जिल्ला/नगरपालिका र वैकल्पिक सीपका आधारमा चिनिन्छिन्।',
                  )}
                </p>
              </div>
            </Card>

            <Card className="landing-intro-card">
              <div className="landing-intro-media">
                <AssetImage
                  alt={tx(
                    language,
                    'Skills training and employment readiness workshop',
                    'सीप तालिम र रोजगारी तयारी कार्यशाला',
                  )}
                  className="landing-card-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.heroEmpowerment}
                  src={IMAGE_PATHS.hero.empowerment}
                />
              </div>
              <div className="landing-intro-body">
                <p className="eyebrow">{tx(language, 'PRACTICAL OPPORTUNITIES', 'व्यावहारिक अवसर')}</p>
                <h2>{tx(language, 'Training, employment, legal aid, and government updates in one place', 'तालिम, रोजगारी, कानुनी सहायता र सरकारी जानकारी एकै ठाउँमा')}</h2>
                <p>
                  {tx(
                    language,
                    'Browse NGO opportunities and official public notices by district and category, compare original and translated text, and listen using browser read-aloud.',
                    'जिल्ला र वर्ग अनुसार संस्थागत अवसर र सरकारी सूचना खोज्नुहोस्, मूल र अनुवादित पाठ सँगै हेर्नुहोस् र पढेर सुनाउने सुविधा प्रयोग गर्नुहोस्।',
                  )}
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-section-head">
              <div>
                <p className="eyebrow">{tx(language, 'HOW IT WORKS', 'कसरी काम गर्छ')}</p>
                <h2>{tx(language, 'Designed for clarity, dignity, and low-friction access', 'स्पष्टता, मर्यादा र सहज पहुँचका लागि बनाइएको')}</h2>
              </div>
            </div>
            <div className="landing-steps-grid">
              {steps.map((step) => (
                <Card className="landing-step-card" key={step.title}>
                  <div className="stat-icon stat-icon-lavender"><Icon name={step.icon} size={22} /></div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft" id="landing-ngos">
          <div className="landing-container">
            <div className="landing-section-head">
              <div>
                <p className="eyebrow">{tx(language, 'VERIFIED ORGANIZATIONS', 'स्वीकृत संस्थाहरू')}</p>
                <h2>{tx(language, 'Featured support organizations (demo directory)', 'प्रमुख सहयोग संस्थाहरू (नमुना सूची)')}</h2>
              </div>
              <Button icon="apartment" onClick={() => onEnterGuest('organizations')} variant="secondary">
                {tx(language, 'Browse all NGOs', 'सबै संस्था हेर्नुहोस्')}
              </Button>
            </div>
            <div className="organization-grid">
              {verifiedNgos.map((org) => (
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
                      <h3>{org.name}</h3>
                      <span><Icon name="location_on" size={16} />{org.location}</span>
                    </div>
                    <Badge dot tone="green">{tx(language, 'Verified', 'स्वीकृत')}</Badge>
                  </div>
                  <p>{org.focus}</p>
                  <div className="organization-card-footer">
                    <span><Icon name="call" size={16} />{org.contactPhone || tx(language, 'Demo contact', 'नमुना सम्पर्क')}</span>
                    <Button onClick={() => onEnterGuest('organizations')} variant="secondary">
                      {tx(language, 'View profile', 'प्रोफाइल हेर्नुहोस्')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section" id="landing-notices">
          <div className="landing-container">
            <div className="landing-section-head">
              <div>
                <p className="eyebrow">{tx(language, 'PUBLIC INFORMATION', 'सार्वजनिक जानकारी')}</p>
                <h2>{tx(language, 'Recent reviewed public notices', 'हालै समीक्षा गरिएका सार्वजनिक सूचनाहरू')}</h2>
              </div>
              <Button icon="campaign" onClick={() => onEnterGuest('notices')} variant="secondary">
                {tx(language, 'View all notices', 'सबै सूचना हेर्नुहोस्')}
              </Button>
            </div>
            <div className="landing-notices-grid">
              {publishedNotices.map((notice) => (
                <Card className="landing-notice-card" key={notice.id}>
                  <div className="landing-notice-top">
                    <Badge dot tone="green">{tx(language, 'Published', 'प्रकाशित')}</Badge>
                    <span><Icon name="location_on" size={15} />{notice.location}</span>
                  </div>
                  <h3>{notice.title}</h3>
                  <p>{language === 'ne' ? notice.translation || notice.original : notice.original}</p>
                  <div className="landing-notice-meta">
                    <span><Icon name="calendar_month" size={15} />{tx(language, 'Deadline', 'अन्तिम मिति')}: {notice.deadline}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft" id="landing-about">
          <div className="landing-container landing-about-grid">
            <div>
              <p className="eyebrow">{tx(language, 'ABOUT NAYA SAHARA', 'नयाँ सहाराको बारेमा')}</p>
              <h2>{tx(language, 'Built around privacy, continuity, and human dignity', 'गोपनीयता, निरन्तरता र मानवीय मर्यादामा आधारित')}</h2>
              <p>
                {tx(
                  language,
                  'Women transitioning during and after incarceration often lose track of scattered training programs, legal-aid desks, and social support. Naya Sahara bridges organizations and public information without collecting unnecessary case histories, medical diagnoses, or real legal identities.',
                  'कारागार अवधि र रिहाइपछि महिलाहरूका लागि तालिम, कानुनी सहायता र सामाजिक सहयोगका जानकारी छरिएका हुन्छन्। नयाँ सहाराले अनावश्यक व्यक्तिगत विवरण, कानुनी फाइल वा चिकित्सा निदान नराखी संस्था र सार्वजनिक अवसरहरू जोड्छ।',
                )}
              </p>
            </div>
            <Card className="landing-partner-card" id="landing-partners">
              <p className="eyebrow">{tx(language, 'PARTNERS & FUNDERS (PLACEHOLDERS)', 'साझेदार र सहयोगी (नमुना स्थान)')}</p>
              <h3>{tx(language, 'Built for the WLiT Fellowship 2026/27 Hackathon', 'WLiT फेलोशिप २०२६/२७ ह्याकाथनका लागि निर्मित')}</h3>
              <p>
                {tx(
                  language,
                  'No external funders or NGO partnerships are claimed in this hackathon build. Verified partner and supporter logos will appear here after real-world onboarding.',
                  'यस ह्याकाथन संस्करणमा कुनै वास्तविक दाता वा साझेदारी दाबी गरिएको छैन। वास्तविक सहकार्यपछि मात्र साझेदार विवरण यहाँ राखिनेछ।',
                )}
              </p>
              <div className="landing-partner-slots">
                <span className="partner-slot">{tx(language, 'Partner slot 1 (Placeholder)', 'साझेदार स्थान १ (नमुना)')}</span>
                <span className="partner-slot">{tx(language, 'Funder slot 2 (Placeholder)', 'सहयोगी स्थान २ (नमुना)')}</span>
              </div>
              <div className="landing-donate-row">
                <Button icon="volunteer_activism" onClick={() => setDonateOpen(true)} variant="secondary">
                  {tx(language, 'Donate (Demo info)', 'सहयोग जानकारी (डेमो)')}
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div>
            <strong>Naya Sahara · नयाँ सहारा</strong>
            <p>
              {tx(
                language,
                'Service discovery and safe communication prototype. Synthetic demo data only; not legal advice.',
                'सहयोग खोज र सुरक्षित संवाद प्रोटोटाइप। नमुना डेटा मात्र; कानुनी सल्लाह होइन।',
              )}
            </p>
          </div>
          <div>
            <strong>{tx(language, 'Explore', 'अन्वेषण')}</strong>
            <ul>
              <li><a href="#landing-about">{tx(language, 'About Us', 'हाम्रो बारेमा')}</a></li>
              <li><button className="footer-link-btn" onClick={() => onEnterGuest('organizations')} type="button">{tx(language, 'Guest NGO Directory', 'अतिथि संस्था सूची')}</button></li>
              <li><button className="footer-link-btn" onClick={() => onEnterGuest('notices')} type="button">{tx(language, 'Public Notices', 'सार्वजनिक सूचना')}</button></li>
            </ul>
          </div>
          <div>
            <strong>{tx(language, 'Account Access', 'खाता पहुँच')}</strong>
            <ul>
              <li><button className="footer-link-btn" onClick={() => onOpenAuth('login')} type="button">{tx(language, 'Login', 'लगइन')}</button></li>
              <li><button className="footer-link-btn" onClick={() => onOpenAuth('register')} type="button">{tx(language, 'Register with Handover Code', 'हस्तान्तरण कोडबाट दर्ता')}</button></li>
              <li><span>{tx(language, 'Demo contact: demo@nayasahara.example', 'नमुना सम्पर्क: demo@nayasahara.example')}</span></li>
            </ul>
          </div>
        </div>
      </footer>

      <Modal
        description={tx(
          language,
          'This hackathon prototype uses synthetic data only and does not process real donations or financial transactions.',
          'यो ह्याकाथन प्रोटोटाइप नमुना डेटामा आधारित छ र वास्तविक आर्थिक कारोबार वा चन्दा संकलन गर्दैन।',
        )}
        onClose={() => setDonateOpen(false)}
        open={donateOpen}
        title={tx(language, 'Donation information (Demo placeholder)', 'सहयोग जानकारी (नमुना)')}
      >
        <div className="notice-inline notice-inline-info">
          <Icon name="info" />
          <span>
            {tx(
              language,
              'In a future verified deployment, supporters would be directed to verified partner NGOs directly.',
              'भविष्यको स्वीकृत संस्करणमा सहयोगीहरूलाई सीधै प्रमाणित सहयोगी संस्थासँग जोडिनेछ।',
            )}
          </span>
        </div>
        <div className="modal-actions">
          <Button onClick={() => setDonateOpen(false)}>{tx(language, 'Close', 'बन्द गर्नुहोस्')}</Button>
        </div>
      </Modal>
    </div>
  )
}
