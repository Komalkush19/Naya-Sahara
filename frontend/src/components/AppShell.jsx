import { useState } from 'react'
import { AssetImage, Icon } from './ui.jsx'
import { IMAGE_PATHS, IMAGE_PLACEHOLDERS } from '../config/images.js'
import { tx } from '../i18n.js'

const roleOptions = [
  { value: 'org', en: 'Org Admin', ne: 'संस्था प्रशासक' },
  { value: 'admin', en: 'Platform Admin', ne: 'प्लेटफर्म प्रशासक' },
  { value: 'member', en: 'Member', ne: 'सदस्य' },
  { value: 'guest', en: 'Guest', ne: 'अतिथि' },
]

const navByRole = {
  org: [
    ['home', 'home', 'Home', 'गृहपृष्ठ'],
    ['cases', 'key', 'Handover & Members', 'हस्तान्तरण र सदस्यहरू'],
    ['team', 'groups', 'Caseworkers', 'केसकर्मी सूची'],
    ['notices', 'campaign', 'NGO Notices', 'संस्थागत सूचना'],
    ['organizations', 'apartment', 'Organization profile', 'संस्था प्रोफाइल'],
    ['messages', 'forum', 'Messages', 'सन्देशहरू'],
  ],
  admin: [
    ['home', 'home', 'Home', 'गृहपृष्ठ'],
    ['organizations', 'apartment', 'NGO approvals', 'संस्था स्वीकृति'],
    ['notices', 'campaign', 'Public notices', 'सार्वजनिक सूचना'],
  ],
  member: [
    ['home', 'home', 'My support', 'मेरो सहयोग'],
    ['notices', 'campaign', 'Notices & Support', 'सूचना र सहयोग'],
    ['organizations', 'apartment', 'Find NGOs', 'संस्थाहरू'],
    ['community', 'diversity_3', 'Your Community', 'तपाईंको समुदाय'],
    ['messages', 'forum', 'Messages', 'सन्देशहरू'],
  ],
  guest: [
    ['home', 'home', 'Explore', 'अन्वेषण'],
    ['notices', 'campaign', 'Public notices', 'सार्वजनिक सूचना'],
    ['organizations', 'apartment', 'Verified NGOs', 'स्वीकृत संस्थाहरू'],
  ],
}

function Navigation({ role, page, language, onNavigate, onClose }) {
  return (
    <nav aria-label="Main navigation" className="sidebar-nav">
      {navByRole[role].map(([id, icon, english, nepali]) => (
        <button
          aria-current={page === id ? 'page' : undefined}
          className={`nav-item ${page === id ? 'nav-item-active' : ''}`}
          key={id}
          onClick={() => {
            onNavigate(id)
            onClose?.()
          }}
          type="button"
        >
          <Icon name={icon} />
          <span>{tx(language, english, nepali)}</span>
          {page === id && <span className="nav-active-mark" />}
        </button>
      ))}
    </nav>
  )
}

export default function AppShell({
  role,
  page,
  language,
  isOnline = true,
  memberNickname = 'Sajilo',
  memberAvatarSrc = IMAGE_PATHS.avatars.avatar1,
  onNavigate,
  onLanguageChange,
  onQuickExit,
  onBackToLanding,
  onOpenAuth,
  onSignOut,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const currentRole = roleOptions.find((option) => option.value === role)
  const memberView = role === 'member'
  const isGuest = role === 'guest'

  return (
    <div className={`app-shell role-${role}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <AssetImage
              alt=""
              className="brand-logo-img"
              fallbackSrc={IMAGE_PATHS.branding.favicon}
              src={IMAGE_PATHS.branding.logoMark}
            />
          </div>
          <div>
            <strong>{memberView ? tx(language, 'My Support', 'मेरो सहयोग') : 'Naya Sahara'}</strong>
            <span>{memberView ? tx(language, 'Personal space', 'व्यक्तिगत क्षेत्र') : 'नयाँ सहारा'}</span>
          </div>
        </div>

        <div className="workspace-label">
          {tx(language, 'WORKSPACE', 'कार्यस्थल')}
        </div>
        <Navigation
          language={language}
          onNavigate={onNavigate}
          page={page}
          role={role}
        />

        <div className="sidebar-bottom">
          <div className="demo-note">
            <Icon name="verified_user" size={18} />
            <div>
              <strong>{tx(language, 'Demo workspace', 'डेमो कार्यस्थल')}</strong>
              <span>{tx(language, 'Synthetic data only', 'नमुना डेटा मात्र')}</span>
            </div>
          </div>
          <div className="sidebar-profile">
            <div className="avatar avatar-small">
              {role === 'member' ? (
                <AssetImage
                  alt=""
                  className="avatar-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                  src={memberAvatarSrc}
                />
              ) : role === 'admin' ? 'A' : isGuest ? 'G' : 'N'}
            </div>
            <div className="sidebar-profile-copy">
              <strong>{role === 'member' ? memberNickname : role === 'admin' ? 'Platform team' : isGuest ? tx(language, 'Public visitor', 'अतिथि प्रयोगकर्ता') : 'Asha Sathi Nepal'}</strong>
              <span>{tx(language, currentRole?.en ?? 'Guest', currentRole?.ne ?? 'अतिथि')}</span>
            </div>
            <Icon name="more_horiz" />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <aside className="mobile-nav" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-nav-heading">
              <strong>{memberView ? tx(language, 'My Support', 'मेरो सहयोग') : 'Naya Sahara'}</strong>
              <button
                aria-label={tx(language, 'Close navigation', 'मेनु बन्द गर्नुहोस्')}
                className="icon-button"
                onClick={() => setMobileMenuOpen(false)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </div>
            <Navigation
              language={language}
              onClose={() => setMobileMenuOpen(false)}
              onNavigate={onNavigate}
              page={page}
              role={role}
            />
          </aside>
        </div>
      )}

      <div className="main-column">
        <header className="topbar">
          <button
            aria-label={tx(language, 'Open navigation', 'मेनु खोल्नुहोस्')}
            className="icon-button mobile-menu-button"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-context">
            <span className="topbar-kicker">{memberView ? tx(language, 'MY SUPPORT', 'मेरो सहयोग') : tx(language, 'NAYA SAHARA', 'नयाँ सहारा')}</span>
            <span className="topbar-role">{tx(language, currentRole?.en ?? 'Guest', currentRole?.ne ?? 'अतिथि')}</span>
          </div>
          <div className="topbar-actions">
            <span className={`network-pill ${isOnline ? '' : 'network-pill-offline'}`} role="status">
              <span className={`connection-dot ${isOnline ? '' : 'connection-dot-offline'}`} />
              <span>{isOnline ? tx(language, 'Online', 'अनलाइन') : tx(language, 'Offline', 'अफलाइन')}</span>
            </span>

            {isGuest ? (
              <>
                <button className="shell-action-btn" onClick={onBackToLanding} type="button">
                  <Icon name="home" size={17} />
                  <span>{tx(language, 'Landing', 'मुख्य पृष्ठ')}</span>
                </button>
                <button className="shell-action-btn" onClick={() => onOpenAuth?.('login')} type="button">
                  <Icon name="login" size={17} />
                  <span>{tx(language, 'Login', 'लगइन')}</span>
                </button>
                <button className="shell-action-btn shell-action-primary" onClick={() => onOpenAuth?.('register')} type="button">
                  <span>{tx(language, 'Register', 'दर्ता')}</span>
                </button>
              </>
            ) : (
              <button className="shell-action-btn" onClick={onSignOut} type="button">
                <Icon name="logout" size={17} />
                <span>{tx(language, 'Sign out', 'बाहिरिनुहोस्')}</span>
              </button>
            )}
            <div className="language-toggle" aria-label="Language">
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
            {role === 'member' && (
              <button className="quick-exit" onClick={onQuickExit} type="button">
                <Icon name="exit_to_app" size={18} />
                <span>{tx(language, 'Quick exit', 'छिटो बाहिरिनुहोस्')}</span>
              </button>
            )}
            <button className="avatar topbar-avatar" aria-label="Profile" type="button">
              {role === 'member' ? (
                <AssetImage
                  alt=""
                  className="avatar-img"
                  fallbackSrc={IMAGE_PLACEHOLDERS.avatar}
                  src={memberAvatarSrc}
                />
              ) : role === 'admin' ? 'A' : isGuest ? 'G' : 'N'}
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>{memberView ? tx(language, 'Personal support space', 'व्यक्तिगत सहयोग क्षेत्र') : tx(language, 'Naya Sahara · Hackathon demo', 'नयाँ सहारा · ह्याकाथन डेमो')}</span>
          <span>{tx(language, 'No real member data', 'वास्तविक सदस्यको डेटा छैन')}</span>
        </footer>
      </div>
    </div>
  )
}
