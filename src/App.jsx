import { useState } from 'react'

/* ---------- small helpers ---------- */
const Icon = ({ name, className = 'text-[20px]' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

const card = 'bg-surface-container-lowest rounded-xl shadow-sm'

/* ---------- navigation per role (taken from the design screens) ---------- */
const ROLES = {
  admin: {
    label: 'Admin', icon: 'admin_panel_settings', brand: 'Naya Sahara', style: 'admin',
    nav: [
      ['home', 'Home', 'home'], ['ngos', 'NGOs', 'corporate_fare'],
      ['women', 'Women', 'group'], ['notices', 'Notices', 'campaign'],
    ],
  },
  ngo: {
    label: 'NGO', icon: 'corporate_fare', brand: 'Sanctuary', style: 'ngo',
    nav: [
      ['home', 'Home', 'home'], ['case-worker', 'Case worker', 'support_agent'],
      ['women', 'Women', 'diversity_1'], ['notices', 'Notice', 'campaign'],
      ['chat', 'Chat', 'chat_bubble'],
    ],
  },
  women: {
    label: 'Women', icon: 'diversity_1', brand: 'Naya Sahara', style: 'women',
    nav: [
      ['home', 'Home', 'home'], ['notices', 'Notice', 'campaign'],
      ['ngos', 'NGOs', 'diversity_3'], ['chat', 'Chat', 'chat_bubble_outline'],
      ['community', 'Your Community', 'groups'],
    ],
  },
}

/* ---------- shell: sidebar + top bar ---------- */
function Shell({ role, page, setPage, onExit, children }) {
  const r = ROLES[role]
  const ngo = r.style === 'ngo'
  const active = ngo
    ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
    : 'bg-primary text-on-primary font-semibold'
  const idle = 'text-on-primary-container hover:bg-primary hover:text-on-primary'
  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-64 bg-primary-container z-50 flex flex-col justify-between">
        <div className="flex flex-col w-full">
          <div className="h-16 flex items-center px-6">
            <span className="font-headline-sm text-headline-sm text-on-primary font-bold tracking-tight">{r.brand}</span>
          </div>
          <nav className="flex flex-col gap-1.5 px-3 py-2">
            {r.nav.map(([id, label, icon]) => (
              <a key={id} href="#" onClick={(e) => { e.preventDefault(); setPage(id) }}
                aria-current={page === id ? 'page' : undefined}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg transition-all font-label-lg text-label-lg ${page === id ? active : idle}`}>
                <Icon name={icon} /><span>{label}</span>
              </a>
            ))}
          </nav>
        </div>
        {ngo && (
          <div className="p-4 flex items-center justify-between">
            <Icon name="lock" className="text-on-primary-container text-[20px]" />
            <span className="font-label-sm text-label-sm text-on-primary-container/80">Confidential Encrypted</span>
          </div>
        )}
      </aside>
      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface/80 backdrop-blur-xl z-40 flex items-center justify-end px-8 shadow-[0_1px_8px_rgba(94,58,95,0.04)]">
          <button onClick={onExit} title="Change role" aria-label="Change role"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Icon name="person" className="text-on-primary text-[18px]" />
          </button>
        </header>
        <main className="relative pt-16 min-h-screen bg-surface w-full p-8">{children}</main>
      </div>
    </>
  )
}

/* ---------- first page: choose role ---------- */
function RoleSelect({ onPick }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className={`${card} w-full max-w-4xl p-space-xl`}>
        <h1 className="font-headline-lg text-headline-lg text-primary mb-space-lg text-center">Naya Sahara</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant text-center mb-space-xl">Choose your role</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          {Object.entries(ROLES).map(([id, r]) => (
            <button key={id} onClick={() => onPick(id)}
              className="group flex flex-col items-center justify-center p-space-xl rounded-xl bg-surface-container-low hover:bg-secondary-container/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="w-16 h-16 rounded-full bg-surface-container-lowest flex items-center justify-center mb-space-md shadow-sm group-hover:scale-105 transition-transform duration-300">
                <Icon name={r.icon} className="text-[32px] text-primary-container" />
              </div>
              <span className="font-headline-sm text-headline-sm text-on-surface">{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- login (frontend only) ---------- */
const inputCls = 'w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15'

function LoginForm({ role, onBack, onDone }) {
  const isNgo = role === 'ngo'
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (isNgo) {
      const pan = b.trim().toUpperCase()
      if (!a.trim()) return setErr('Enter the NGO name.')
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return setErr('Enter a valid PAN, for example ABCDE1234F.')
      onDone({ name: a.trim(), pan })
    } else {
      const v = a.trim()
      if (!/^\S+@\S+\.\S+$/.test(v) && !/^\+?\d{10,13}$/.test(v)) return setErr('Enter a valid phone number or email.')
      onDone({})
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <form onSubmit={submit} className={`${card} w-full max-w-md p-space-xl flex flex-col gap-space-md`}>
        <h1 className="font-headline-md text-headline-md text-primary">{isNgo ? 'NGO verification' : 'Women login'}</h1>
        {isNgo ? (
          <>
            <input className={inputCls} placeholder="NGO name" value={a} onChange={(e) => { setA(e.target.value); setErr('') }} />
            <input className={inputCls} placeholder="PAN card number" maxLength={10} value={b} onChange={(e) => { setB(e.target.value); setErr('') }} />
          </>
        ) : (
          <input className={inputCls} placeholder="Phone number or email" value={a} onChange={(e) => { setA(e.target.value); setErr('') }} />
        )}
        {err && <p className="font-body-sm text-body-sm text-error">{err}</p>}
        <button type="submit" className="bg-primary text-on-primary font-label-lg text-label-lg min-h-[44px] rounded-lg hover:bg-primary-container active:scale-[0.98] transition-all">
          {isNgo ? 'Submit for verification' : 'Log in'}
        </button>
        <button type="button" onClick={onBack} className="font-label-md text-label-md text-on-surface-variant hover:text-primary">Back</button>
      </form>
    </div>
  )
}

/* ---------- home pages ---------- */
function TileHome({ tiles, go }) {
  return (
    <div className="w-full flex items-center justify-center py-space-xl">
      <div className={`${card} w-full max-w-4xl p-space-xl`}>
        <div className={`grid grid-cols-1 gap-space-lg ${tiles.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {tiles.map(([id, label, icon]) => (
            <a key={id} href="#" onClick={(e) => { e.preventDefault(); go(id) }}
              className="group flex flex-col items-center justify-center p-space-xl rounded-xl bg-surface-container-low hover:bg-secondary-container/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="w-16 h-16 rounded-full bg-surface-container-lowest flex items-center justify-center mb-space-md shadow-sm group-hover:scale-105 transition-transform duration-300">
                <Icon name={icon} className="text-[32px] text-primary-container" />
              </div>
              <span className="font-headline-sm text-headline-sm text-on-surface">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function WelcomeHome({ go }) {
  const quick = [['case-worker', 'Case Workers', 'Directory', 'support_agent'], ['women', 'Women', 'Active dossiers', 'diversity_1'],
    ['notices', 'Notices', 'Bulletins', 'campaign'], ['chat', 'Chat', 'Encrypted relay', 'chat_bubble']]
  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-center items-center min-h-[calc(100vh-8rem)] px-4">
      <div className="relative w-full flex items-center justify-center">
        <div className="absolute -top-12 w-96 h-96 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-[0_4px_30px_rgba(94,58,95,0.06)] p-10 md:p-14">
          <div className="flex items-center justify-between pb-8">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="tracking-wide">System Online</span>
            </div>
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm opacity-80">
              <Icon name="verified_user" className="text-[16px] text-primary" /><span>256-bit E2EE</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary mb-2 shadow-sm">
              <Icon name="roofing" className="text-[26px]" />
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-semibold">Welcome to Naya Sahara</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              Select an option from the sidebar to view Case workers, Women profiles, Notices, or Chat.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-10 pb-8">
            {quick.map(([id, t, s, ic]) => (
              <button key={id} onClick={() => go(id)} className="text-left flex flex-col gap-1 p-3 rounded-lg bg-surface-container-low/60 hover:bg-surface-container-low transition-colors">
                <Icon name={ic} className="text-[20px] text-primary" />
                <span className="font-label-md text-label-md text-on-surface font-semibold pt-1">{t}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant opacity-75">{s}</span>
              </button>
            ))}
          </div>
          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary-container flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Status: <span className="text-secondary font-medium">Connected &amp; Synchronized</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
              <span>Portal v2.4</span><span className="opacity-40">•</span><span>Case Gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- NGO: case worker ---------- */
const Pic = ({ size = 'w-32 h-32' }) => (
  <div className={`${size} rounded-full bg-surface-container-highest flex items-center justify-center select-none shadow-inner flex-shrink-0`}>
    <span className="font-headline-sm text-headline-sm font-medium text-outline lowercase tracking-wider">pic</span>
  </div>
)

function CaseWorker() {
  const row = (k, v, big) => (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
      <span className={`${big ? 'font-headline-sm text-headline-sm text-primary' : 'font-body-lg text-body-lg text-secondary'} font-semibold tracking-tight`}>{k}</span>
      <span className={`${big ? 'font-headline-sm text-headline-sm text-on-surface font-medium' : 'font-body-lg text-body-lg text-on-surface-variant'}`}>{v}</span>
    </div>
  )
  return (
    <div className="min-h-[calc(100vh-8rem)] w-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-2px_rgba(94,58,95,0.06)] p-8 sm:p-12 hover:shadow-[0_8px_30px_-4px_rgba(94,58,95,0.09)] transition-all duration-300">
        <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-8 sm:gap-12">
          <div className="flex flex-col space-y-4 min-w-0 flex-1">
            {row('Name:', 'ram prasad khadka', true)}
            {row('Date joined:', 'November 2023')}
            {row('Active cases:', 'woking on the case on .....')}
          </div>
          <div className="self-center sm:self-auto"><Pic size="w-28 h-28 sm:w-32 sm:h-32" /></div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Women profile (NGO + admin) ---------- */
function WomenProfile({ withActions }) {
  const field = (k, v) => (
    <div className="flex flex-col">
      <span className="font-label-sm text-label-sm text-on-surface-variant/70 uppercase tracking-widest mb-1">{k}</span>
      {v}
    </div>
  )
  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between pb-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">Participant Profile</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Women Directory</h1>
        </div>
        {withActions && (
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high active:scale-95 transition-all">
              <Icon name="arrow_back" className="text-[18px]" /><span>Directory</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container active:scale-95 transition-all">
              <Icon name="edit_note" className="text-[18px]" /><span>Case Notes</span>
            </button>
          </div>
        )}
      </div>
      <div className="w-full flex items-center justify-center py-12 lg:py-16">
        <div className="w-full max-w-3xl bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_-2px_rgba(94,58,95,0.06)] p-10 lg:p-12 hover:shadow-[0_8px_24px_-4px_rgba(94,58,95,0.08)] transition-all">
          <div className="flex flex-col-reverse sm:flex-row items-center sm:items-start justify-between gap-8">
            <div className="flex flex-col gap-5 w-full sm:w-auto">
              {field('Name', <div className="font-headline-md text-headline-md text-primary font-semibold">Maya Devi</div>)}
              {field('Date joined', <div className="font-body-md text-body-md text-on-surface font-medium">January 2024</div>)}
              {field('Assigned Case Worker', <div className="font-body-md text-body-md text-on-surface font-medium">Ram Prasad Khadka</div>)}
              {field('Status', (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  <span className="font-body-md text-body-md text-secondary font-semibold">Active in vocational training</span>
                </div>
              ))}
            </div>
            <div className="shrink-0"><Pic /></div>
          </div>
          <div className="mt-12 pt-6 flex items-center justify-between text-on-surface-variant/60">
            <div className="flex items-center gap-2">
              <Icon name="shield" className="text-[16px] text-secondary" />
              <span className="font-label-sm text-label-sm">Protected Casework Record · ID #WN-2024-089</span>
            </div>
            <div className="font-label-sm text-label-sm tracking-wide">SANCTUARY PROTECT</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Notice ---------- */
function Notice({ verified }) {
  return (
    <div className={verified ? 'flex flex-col items-center justify-center min-h-[calc(100vh-9rem)] px-4 sm:px-6' : ''}>
      <div className={verified
        ? 'w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_-2px_rgba(94,58,95,0.06)] px-10 py-12 md:px-14 md:py-16'
        : `${card} w-full max-w-3xl p-space-xl`}>
        <h1 className={`font-headline-lg text-headline-lg text-primary ${verified ? 'mb-8 font-bold' : 'mb-space-lg'}`}>NOTICE!!</h1>
        {verified ? (
          <>
            <p className="font-body-lg text-body-lg text-on-surface leading-relaxed mb-6">Vocation training related to tailoring in surkhet ward 20</p>
            <div className="flex flex-col gap-2 font-body-md text-body-md text-on-surface-variant">
              <p><span className="text-on-surface font-medium">Date :</span> nov 20 to 29</p>
              <p><span className="text-on-surface font-medium">Time:</span> 2 to 5 pm</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-space-sm font-body-lg text-body-lg text-on-surface">
            <p>Vocation training related to tailoring in surkhet ward 20</p>
            <p>Date : nov 20 to 29</p>
            <p>Time: 2 to 5 pm</p>
          </div>
        )}
      </div>
      {verified && (
        <div className="mt-8 flex items-center w-full max-w-2xl px-2 gap-2 text-on-surface-variant/70">
          <Icon name="verified_user" className="text-[18px]" />
          <span className="font-label-sm text-label-sm">Ward 20 Community Center • Verified Bulletin</span>
        </div>
      )}
    </div>
  )
}

/* ---------- Women: NGOs list ---------- */
const NGO_LIST = [
  { name: 'Asha Jyoti Foundation', kind: 'Safe Shelter', status: 'verified' },
  { name: 'Prerna Artisan Co-op', kind: 'Vocational Training', status: 'verified' },
  { name: 'District Legal Aid Clinic', kind: 'Legal Support', status: 'verified' },
]

function Ngos({ list, withConnect, onVerify }) {
  const [connected, setConnected] = useState({})
  return (
    <div className="w-full max-w-4xl mx-auto py-space-xl">
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-[0_2px_8px_-2px_rgba(94,58,95,0.04)] flex flex-col gap-space-xl">
        {list.map(({ name, kind, status }) => (
          <div key={name} className="flex items-center justify-between gap-space-md">
            <div className="flex flex-col gap-space-xs min-w-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{name}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant truncate">{kind}{status === 'pending' && ' · Pending verification'}</p>
            </div>
            {onVerify && status === 'pending' && (
              <button onClick={() => onVerify(name)} className="shrink-0 bg-primary text-on-primary rounded-lg px-space-lg min-h-[44px] font-label-lg text-label-lg hover:bg-primary-container active:scale-[0.98] transition-all">Verify</button>
            )}
            {withConnect && (
              <button onClick={() => setConnected((c) => ({ ...c, [name]: !c[name] }))}
                className={`shrink-0 rounded-lg px-space-lg min-h-[44px] font-label-lg text-label-lg transition-all active:scale-[0.98] ${connected[name]
                  ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary text-on-primary hover:bg-primary-container'}`}>
                {connected[name] ? 'Connected' : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
/* ---------- Chat ---------- */
const time = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Chat({ rich }) {
  const [msgs, setMsgs] = useState([
    { me: false, text: 'Hello Maya, your tailoring training starts on Nov 20.', t: '10:14 AM' },
    { me: true, text: 'Thank you, I will be there at 2 pm.', t: '10:18 AM' },
  ])
  const [text, setText] = useState('')
  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setMsgs([...msgs, { me: true, text: text.trim(), t: time() }])
    setText('')
  }

  if (!rich) {
    return (
      <div className={`${card} w-full max-w-3xl mx-auto p-space-xl flex flex-col gap-space-xl`}>
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0"><Icon name="person" /></div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Caseworker Ram Prasad Khadka</h2>
        </div>
        <div className="flex flex-col gap-space-md">
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.me ? 'items-end' : 'items-start'}`}>
              <div className={`${m.me ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'} rounded-xl px-space-lg py-space-md max-w-md`}>
                <p className="font-body-md text-body-md">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex items-center gap-space-md">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..."
            className="flex-1 bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg px-space-md py-3 focus:outline-none" />
          <button type="submit" className="bg-primary text-on-primary font-label-lg text-label-lg px-space-lg py-3 rounded-lg hover:bg-primary-container transition-colors shrink-0">Send</button>
        </form>
      </div>
    )
  }

  return (
    <div className="w-full flex items-center justify-center py-6 md:py-12 px-4 sm:px-6">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-md flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-headline-sm select-none">R</div>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">Chat with Ram Prasad Khadka</h1>
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary" />Vocational Training Coordinator
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['call', 'more_vert'].map((ic) => (
              <button key={ic} aria-label={ic} type="button" className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                <Icon name={ic} />
              </button>
            ))}
          </div>
        </div>
        <div className="h-px w-full bg-surface-container" />
        <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 bg-surface-container-low/40 min-h-[380px] max-h-[500px] overflow-y-auto"
          ref={(el) => el && (el.scrollTop = el.scrollHeight)}>
          <div className="flex items-center justify-center my-1">
            <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Today</span>
          </div>
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 max-w-[82%] ${m.me ? 'items-end self-end' : 'items-start'}`}>
              <span className="font-label-sm text-label-sm text-on-surface-variant px-1">{m.me ? 'You' : 'Ram Prasad Khadka'}</span>
              <div className={`${m.me ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-lowest text-on-surface rounded-tl-sm'} px-4 py-3 rounded-xl shadow-sm`}>
                <p className="font-body-md text-body-md">{m.text}</p>
              </div>
              <div className="flex items-center gap-1 px-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant/70">{m.t}</span>
                {m.me && <Icon name="done_all" className="text-secondary text-[14px]" />}
              </div>
            </div>
          ))}
        </div>
        <div className="h-px w-full bg-surface-container" />
        <div className="p-4 sm:p-5 bg-surface-container-lowest">
          <form onSubmit={send} className="flex items-center gap-3">
            <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="Type a message..."
              className="flex-1 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 font-body-md text-body-md px-4 py-3 rounded-lg focus:outline-none focus:bg-surface-container transition-all" />
            <button type="submit" className="h-11 px-5 rounded-lg bg-primary text-on-primary hover:bg-primary-container active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm">
              <span className="font-label-lg text-label-lg font-semibold">Send</span><Icon name="send" className="text-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ---------- Women: Your Community ---------- */
const PEOPLE = [
  ['Sunbird', 'Tailoring Cohort', 'bg-secondary-container', 'text-on-secondary-container'],
  ['Marigold', 'Handloom Group', 'bg-tertiary-fixed', 'text-on-tertiary-fixed-variant'],
  ['Asha', 'Baking & Crafts', 'bg-primary-fixed', 'text-on-primary-fixed-variant'],
]

function Community() {
  const [sent, setSent] = useState({})
  return (
    <div className={`${card} w-full max-w-2xl mx-auto mt-space-lg p-space-xl flex flex-col gap-space-lg`}>
      {PEOPLE.map(([name, group, bg, fg]) => (
        <div key={name} className="flex items-center justify-between gap-space-md py-space-sm">
          <div className="flex items-center gap-space-md min-w-0">
            <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0`}>
              <Icon name="person" className={`${fg} text-[22px]`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">{name}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{group}</span>
            </div>
          </div>
          <button disabled={sent[name]} onClick={() => setSent({ ...sent, [name]: true })}
            className={`px-space-lg h-11 rounded-lg font-label-lg text-label-lg active:scale-[0.98] transition-all shrink-0 ${sent[name]
              ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary text-on-primary hover:bg-primary-container'}`}>
            {sent[name] ? 'Hello Sent' : 'Say Hello'}
          </button>
        </div>
      ))}
    </div>
  )
}

/* ---------- app ---------- */
export default function App() {
  const [role, setRole] = useState(null)
  const [page, setPage] = useState('home')
  const [login, setLogin] = useState(null)
  const [ngos, setNgos] = useState(NGO_LIST)

  const enter = (r) => { setLogin(null); setRole(r); setPage('home') }
  const verify = (name) => setNgos((l) => l.map((n) => (n.name === name ? { ...n, status: 'verified' } : n)))

  if (!role) {
    if (login) {
      return <LoginForm role={login} onBack={() => setLogin(null)} onDone={(d) => {
        if (login === 'ngo') {
          setNgos((l) => l.some((n) => n.name.toLowerCase() === d.name.toLowerCase())
            ? l : [...l, { name: d.name, kind: `PAN ${d.pan}`, status: 'pending' }])
        }
        enter(login)
      }} />
    }
    return <RoleSelect onPick={(r) => (r === 'admin' ? enter(r) : setLogin(r))} />
  }

  let view = null
  if (role === 'admin') {
    view = {
      home: <TileHome go={setPage} tiles={[['ngos', 'NGOs', 'corporate_fare'], ['women', 'Women', 'group'], ['notices', 'Notices', 'campaign']]} />,
            ngos: <Ngos list={ngos} onVerify={verify} />, women: <WomenProfile />, notices: <Notice />,
    }[page]
  } else if (role === 'ngo') {
    view = {
      home: <WelcomeHome go={setPage} />, 'case-worker': <CaseWorker />,
      women: <WomenProfile withActions />, notices: <Notice verified />, chat: <Chat rich />,
    }[page]
  } else {
    view = {
      home: <TileHome go={setPage} tiles={[['notices', 'Notice', 'campaign'], ['ngos', 'NGOs', 'diversity_3'], ['chat', 'Chat', 'chat_bubble_outline'], ['community', 'Your Community', 'groups']]} />,
            notices: <Notice />, ngos: <Ngos list={ngos.filter((n) => n.status === 'verified')} withConnect />, chat: <Chat />, community: <Community />,
    }[page]
  }

  return (
    <Shell role={role} page={page} setPage={setPage} onExit={() => setRole(null)}>
      {view}
    </Shell>
  )
}
