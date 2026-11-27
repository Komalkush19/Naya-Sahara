# Image Assets Manifest (`IMAGE_ASSETS.md`)

All local static visual assets live under `frontend/public/images/` and are centralized in `frontend/src/config/images.js`.

- **No Firebase Storage, Cloudinary, or external stock-image URLs** are used in the MVP.
- **No empty `.jpg` files** are committed. Where a final `.jpg` asset is planned, the UI tries the intended final path (for example `/images/ngos/ngo1.jpg`) and automatically falls back via `AssetImage` (`frontend/src/components/ui.jsx`) to a neutral `.svg` placeholder until the final file is added.
- Dropping a real image with the documented filename into the listed folder automatically activates it without editing component code.
- **Privacy rule:** Never add photographs of real Members, case documents, or identifying personal data.

---

## Asset Inventory

### 1. Branding (`frontend/public/images/branding/`)

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `logo.svg` | Landing page navbar & footer | Full horizontal Naya Sahara lockup (sprout emblem + "Naya Sahara / नयाँ सहारा" wordmark) | `220×48` (`~4.5:1` SVG) | `"Naya Sahara"` | Informative | Usable SVG created |
| `logo-mark.svg` | `AppShell.jsx` sidebar brand mark | Square discreet sprout emblem in plum `#633d68` & cream `#f3e7d8` | `64×64` (`1:1` SVG) | `""` (paired with visible brand text) | Decorative | Usable SVG created |
| `favicon.svg` | Browser tab icon (`index.html`, `branding/`) | Discreet rounded square emblem matching `logo-mark.svg` | `64×64` (`1:1` SVG) | N/A (browser favicon) | Decorative | Usable SVG created (`frontend/public/favicon.svg` & `images/branding/favicon.svg`) |

### 2. Landing Page / Hero (`frontend/public/images/hero/`)

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `hero-support.jpg` | Public Landing Page hero section | Warm, dignified illustration or licensed photograph showing supportive community hands/guidance in Nepal | `1200×780` (`~3:2`, landscape) | `"Women connecting with community support services in Nepal"` | Informative | Fallback active: `/images/hero/hero-support-placeholder.svg` |
| `community-support.jpg` | Landing Page About / Community preview | Respectful non-identifying scene of women collaborating in a community center or workshop | `960×630` (`~3:2`, landscape) | `"Women participating in a supportive community session"` | Informative | Fallback active: `/images/hero/community-support-placeholder.svg` |
| `women-empowerment.jpg` | Landing Page / Notices & Training preview | Vocational training, tailoring, or digital skills learning scene (non-identifying) | `960×630` (`~3:2`, landscape) | `"Skills training and employment readiness workshop"` | Informative | Fallback active: `/images/hero/women-empowerment-placeholder.svg` |

### 3. NGO Logos (`frontend/public/images/ngos/`)

> **Rule:** For NGO logos, `alt` text must be the **organization's name** (never decorative or generic when shown as the org identifier).

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `ngo1.jpg` | `Organizations.jsx`, Landing/Find NGOs (`org-asha`) | Official logo or emblem for **Asha Sathi Nepal** | `256×256` (`1:1` square) | `"Asha Sathi Nepal"` | Informative | Fallback active: `/images/ngos/ngo-placeholder.svg` |
| `ngo2.jpg` | `Organizations.jsx`, Landing/Find NGOs (`org-ujjwal`) | Official logo or emblem for **Ujjwal Support Centre** | `256×256` (`1:1` square) | `"Ujjwal Support Centre"` | Informative | Fallback active: `/images/ngos/ngo-placeholder.svg` |
| `ngo3.jpg` | `Organizations.jsx`, Landing/Find NGOs (`org-samjhana`) | Official logo or emblem for **Samjhana Women’s Collective** | `256×256` (`1:1` square) | `"Samjhana Women’s Collective"` | Informative | Fallback active: `/images/ngos/ngo-placeholder.svg` |
| `ngo-placeholder.svg` | Fallback for any NGO without a custom `.jpg` logo | Neutral minimal building emblem in `#f1eaf4` / `#75547c` | `96×96` (`1:1` SVG) | Organization's name when used as fallback | Informative | Usable SVG created |

### 4. Member Illustrated Avatars (`frontend/public/images/avatars/`)

> **Privacy rule:** Women use **illustrated avatars only** (never real photos). When rendered next to a visible nickname, use `alt=""` so screen readers do not repeat redundant label noise; when rendered in an avatar picker button, use the descriptive label below.

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `avatar1.svg` | `AppShell.jsx`, `Community.jsx`, Member Profile & Avatar Picker | Minimal botanical lotus bloom illustration on soft lavender | `96×96` (`1:1` SVG) | `""` next to nickname / `"Lotus bloom illustrated avatar"` in picker | Decorative (next to nickname) / Informative (in picker) | Usable SVG created |
| `avatar2.svg` | `Community.jsx`, Member Profile & Avatar Picker | Minimal warm rising sun over horizon illustration | `96×96` (`1:1` SVG) | `""` next to nickname / `"Rising sun illustrated avatar"` in picker | Decorative (next to nickname) / Informative (in picker) | Usable SVG created |
| `avatar3.svg` | `Community.jsx`, Member Profile & Avatar Picker | Minimal green hills and morning sky illustration | `96×96` (`1:1` SVG) | `""` next to nickname / `"Green hills illustrated avatar"` in picker | Decorative (next to nickname) / Informative (in picker) | Usable SVG created |
| `avatar4.svg` | `Community.jsx`, Member Profile & Avatar Picker | Minimal mountain light illustration | `96×96` (`1:1` SVG) | `""` next to nickname / `"Starlight mountain illustrated avatar"` in picker | Decorative (next to nickname) / Informative (in picker) | Usable SVG created |
| `avatar-placeholder.svg` | Fallback if an avatar asset fails to load | Neutral silhouette avatar in `#eee5ef` / `#75567e` | `96×96` (`1:1` SVG) | `""` | Decorative | Usable SVG created |

### 5. Caseworker Portraits (`frontend/public/images/caseworkers/`)

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `caseworker1.jpg` | `Team.jsx` (NGO Caseworker directory) | Professional, non-real/synthetic portrait for Caseworker 1 | `256×256` (`1:1` square) | `"Caseworker A portrait"` (or worker's display name + `"portrait"`) | Informative | Fallback active: `/images/caseworkers/caseworker-placeholder.svg` |
| `caseworker2.jpg` | `Team.jsx` (NGO Caseworker directory) | Professional, non-real/synthetic portrait for Caseworker 2 | `256×256` (`1:1` square) | `"Caseworker B portrait"` (or worker's display name + `"portrait"`) | Informative | Fallback active: `/images/caseworkers/caseworker-placeholder.svg` |
| `caseworker-placeholder.svg` | Fallback for caseworker cards without `.jpg` portraits | Neutral staff portrait silhouette in `#f1eaf4` / `#74577e` | `96×96` (`1:1` SVG) | `"<Name> portrait"` | Informative | Usable SVG created |

### 6. Illustrations (`frontend/public/images/illustrations/`)

| Filename | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|
| `welcome-illustration.svg` | `Dashboard.jsx` (Member home welcome banner) | Gentle hills, sun, and sprout emblem in lavender/peach | `220×200` (`11:10` SVG) | `""` (`aria-hidden="true"`) | Decorative | Usable SVG created |
| `empty-community.svg` | `Community.jsx` empty directory state | Soft two-person silhouette card showing calm community space | `240×180` (`4:3` SVG) | `""` (`aria-hidden="true"`) | Decorative | Usable SVG created |
| `empty-notices.svg` | `Notices.jsx` empty state | Minimal document card illustration | `240×180` (`4:3` SVG) | `""` (`aria-hidden="true"`) | Decorative | Usable SVG created |
| `no-results.svg` | Filtered empty state (`Opportunities.jsx` / `Notices.jsx` / search) | Minimal magnifying glass illustration | `240×180` (`4:3` SVG) | `""` (`aria-hidden="true"`) | Decorative | Usable SVG created |

### 7. Notices & Icons (`frontend/public/images/notices/`, `frontend/public/images/icons/`)

| Filename | Folder | Intended Page / Component | What It Should Depict | Suggested Dimensions / Ratio | Exact `alt` Text | Decorative / Informative | Current Placeholder / Status |
|---|---|---|---|---|---|---|---|
| `notice-placeholder.svg` | `images/notices/` | `Notices.jsx` optional notice header/thumbnail | Minimal warm announcement card graphic | `120×84` (`10:7` SVG) | `""` | Decorative | Usable SVG created |
| `quick-exit.svg` | `images/icons/` | `AppShell.jsx` / safety quick-exit docs | Exit doorway vector icon | `24×24` (`1:1` SVG) | `""` (paired with `"Quick exit"` label) | Decorative | Usable SVG created |
| `verified-badge.svg` | `images/icons/` | `Organizations.jsx` / NGO verified badge docs | Shield checkmark vector icon | `24×24` (`1:1` SVG) | `""` (paired with `"Verified"` text) | Decorative | Usable SVG created |
