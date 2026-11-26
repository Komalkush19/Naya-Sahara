
# Naya Sahara (नयाँ सहारा)

### A shared digital backbone for NGOs supporting women through and after prison in Nepal.

Naya Sahara is a collaborative digital platform that connects NGOs, caseworkers and lawyers supporting women during incarceration and after release. It provides a consent-based, offline-capable case management system that helps organizations maintain continuity of care, ensuring that essential information about health needs, court dates, children and rehabilitation plans is not lost during organizational handovers.

After release, women retain control of their records and can use the platform to connect with other women, discover verified training programs, access support services and find employment opportunities, creating a pathway toward independent community life.

> **Disclaimer:** Naya Sahara is a service-tracking platform, not a legal or court-records management system. Legal information in the project documentation consists of unverified summaries and must be reviewed by a qualified lawyer before any real-world pilot. The platform provides general guidance, not legal advice.

---

## 1. The Problem

Women receiving support during incarceration and after release often depend on multiple organizations for rehabilitation, legal assistance and essential services.

However, their information is scattered across different NGOs, paper records, spreadsheets and individual caseworkers. This creates several challenges:

- **Fragmented records:** Important information gets lost when women move between organizations.
- **Missed follow-ups:** Hearing reminders, health needs and support requirements can go unnoticed.
- **Disrupted rehabilitation:** Staff changes and organizational handovers interrupt continuity of care.
- **Limited post-release support:** Women often lose contact with the organizations that supported them during incarceration.
- **Disconnected opportunities:** Information about training, employment and available assistance is difficult to access.

Naya Sahara addresses these challenges by creating a shared digital infrastructure that connects existing support organizations while keeping women in control of their personal information.

## 2. What Makes Naya Sahara Different?

- **Connected NGO ecosystem:** Brings existing NGOs and their paper-based workflows into one collaborative platform without replacing their existing operations.
- **Secure case handover:** Enables caseworkers to transfer access through one-time claim codes, without requiring women to have an email address or phone number.
- **Continuity of care:** Connects support during incarceration with rehabilitation and community reintegration after release.
- **Accessible government information:** Provides translated, filtered and audio-supported government notices.
- **Centralized opportunities:** Connects women with verified trainers, volunteers, organizations and employment opportunities.
- **Privacy-first approach:** Uses minimal data collection, documented consent and strict separation between private case records and community profiles.

## 3. User Roles and Responsibilities

| User Role                    | Responsibilities                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| **Organization Admin** | Manages the NGO profile, staff accounts and organizational opportunities.                    |
| **Platform Admin**     | Verifies organizations, approves government notices and manages platform moderation.         |
| **Member (Woman)**     | Accesses her transferred record, opportunities, notices, messaging and community features.   |
| **Guest**              | Accesses limited public information, including opportunities, notices and the NGO directory. |

**Design principle:** Women are the beneficiaries and central participants of the platform. The application uses respectful terminology such as "woman" and "member", never "victim".

## 4. Hackathon MVP

The hackathon MVP focuses on demonstrating an end-to-end user journey in approximately four minutes using synthetic data.

### Core Demonstration Workflow

1. **NGO Registration and Verification:** An organization registers on the platform and receives approval from the platform administrator.
2. **Case Management:** A caseworker creates a case record and adds relevant information, including:

   - Next hearing date and legal status.
   - Basic health and hygiene needs.
   - Children and guardian information.
   - Release checklist and support requirements.
3. **Secure Case Handover:** The caseworker generates a one-time claim code. The woman uses this code to claim her record, creates a nickname and PIN, and accesses her personal dashboard.
4. **Opportunities Board:** NGOs publish opportunities. Women can filter available opportunities, translate content between Nepali and English, and listen to information through text-to-speech.
5. **Government Notices:** An administrator adds a government notice. AI translates the notice and extracts relevant information such as location, eligibility and deadlines. The administrator reviews and approves the notice before publication.
6. **NGO Directory and Messaging:** Women can explore verified NGO profiles and initiate conversations through the messaging system.
7. **Offline Functionality:** The application demonstrates offline access by allowing an update to a synthetic case record. The update displays a pending-sync status and synchronizes when connectivity is restored, without duplicate application.

### Should-Have Features

- Anonymous community groups.
- Message requests before initiating conversations.
- User reporting and blocking mechanisms.

### Out of Scope for the Hackathon MVP

- Trainer marketplace.
- Impact analytics and reporting dashboards.
- Automated web scraping.
- Advanced moderation tools.
- Integration with prison management systems.
- Real legal or personal data.

## 5. Safety, Security and Privacy

Naya Sahara is designed around the principle that women should retain control over their personal information.

### Consent-First Data Management

- Documented consent is required before personal information is stored or shared.
- Women can revoke their consent.
- Access to records is restricted according to organizational roles and permissions.

### Minimal Data Collection

The platform stores only information necessary for service coordination, including:

- Staff-entered hearing reminders.
- Basic legal status.
- Expected release month.
- General health and hygiene needs.

The platform does not collect court files, offence details or medical diagnoses.

### Safe Community Experience

- Nickname-only community profiles.
- No profile photographs.
- Message requests before direct conversations.
- Block and report functionality.
- Quick-exit functionality.
- Discreet application name and icon.

### Separation of Private and Public Information

A woman's private case record is stored separately from her community profile. There is no direct link that allows other community members to identify her case record through her nickname.

### Technical Security Measures

- Hashed claim codes and PINs.
- Role-based access control.
- Organization-level data permissions.
- Audit logs.
- Rate limiting.
- Firebase Security Rules.

## 6. Technology Stack

| Layer                           | Technology                          | Purpose                                                                      |
| ------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| **Frontend**              | Next.js, React                      | Application interface and routing                                            |
| **Styling**               | Tailwind CSS, shadcn/ui             | Responsive and accessible UI components                                      |
| **Database**              | Firebase Firestore                  | Case records and application data with offline persistence                   |
| **Authentication**        | Firebase Authentication             | Staff authentication                                                         |
| **Member Authentication** | Firebase Cloud Functions            | Claim-code verification and custom token issuance for nickname and PIN login |
| **Access Control**        | Firestore Security Rules            | Role-based and organization-level permissions                                |
| **File Storage**          | Firebase Storage                    | Consent document storage                                                     |
| **Internationalization**  | next-intl                           | Nepali and English language support                                          |
| **Typography**            | Noto Sans Devanagari                | Nepali language rendering                                                    |
| **Voice Accessibility**   | Web Speech API, cached Nepali audio | Audio support for notices and opportunities                                  |
| **AI Integration**        | LLM API with JSON-schema output     | Translation and structured information extraction from public notices        |
| **Backend**               | Firebase Cloud Functions            | Secure server-side operations and AI processing                              |
| **Hosting**               | Firebase Hosting / Vercel           | Application deployment                                                       |
| **Testing**               | Firebase Emulator Suite             | Authentication, database and security rule testing                           |

## 7. Getting Started

The application is currently being scaffolded task by task. Some setup instructions and configurations may evolve as implementation progresses.

### Prerequisites

- Node.js 20 or later.
- npm.
- Firebase CLI.
- A Firebase project for deployment and configuration.

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/aarya25dh/Naya-Sahara-Rehabilitation-Platform.git

cd Naya-Sahara-Rehabilitation-Platform
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env.local
```

Add the required Firebase web configuration to `.env.local`.

**4. Start Firebase Emulators**

```bash
firebase emulators:start
```

Enable the required emulators for Authentication, Firestore and Cloud Functions.

**5. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deployment Notes

- Cloud Functions deployment requires the Firebase Blaze (pay-as-you-go) plan.
- Configure budget alerts before deploying paid services.
- Never commit `.env` files, private API keys or Firebase service account credentials.
- Use synthetic data for development and demonstration purposes.

## 8. Project Roadmap

| Phase                                          | Scope                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hackathon MVP**                        | End-to-end demonstration with synthetic data, NGO registration, case management, secure handover, opportunities, government notices, messaging and offline synchronization. |
| **Phase 1: NGO Pilot**                   | Caseworker accounts, consent management, service logs, release checklists, handover codes, printable case summaries and offline functionality.                              |
| **Phase 2: Community and Opportunities** | Opportunities board, government notices with AI translation and filtering, and the member's personal space.                                                                 |
| **Phase 3: Extended Ecosystem**          | Opt-in community, trainer board, learning resources and impact dashboard.                                                                                                   |

### Before Real-World Deployment

The following steps are essential before any pilot involving real users:

- Legal review of all legal information and workflows.
- Data-handling agreements with participating NGOs.
- Interviews and feedback sessions with NGO staff.
- Security and privacy assessments.
- Testing with appropriate consent and safeguarding procedures.

## 11. Contributing

We welcome contributions, feedback and collaboration from developers, NGOs, legal professionals and individuals working in women's rehabilitation and social reintegration.

For major changes, please open an issue first to discuss the proposed contribution.

**Privacy reminder:** Never include real personal information in GitHub issues, screenshots, pull requests or demonstration environments.

## 12. Team

Developed by:

- **Aarya Dhungana**
- **Komal Kushwaha**
- **Samjhana Senchuri**

---

<p align="center">
  **Naya Sahara (नयाँ सहारा)**  
  <em>Continuity of care. Dignity beyond incarceration. A path toward a new beginning.</em>
  <br/>
  Built as a hackathon project under the Women Leaders in Technology (WLiT) Fellowship 2026/27.
</p>
