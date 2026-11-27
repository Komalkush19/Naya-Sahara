<!--
Sync Impact Report
Version change: 1.0.0 → 2.0.0
Modified principles: Aligned with confirmed Spark-only React+Vite+Vercel MVP scope; removed case-management/hearing-date/offline-sync/PIN-recovery/Storage requirements.
-->

# Naya Sahara (नयाँ सहारा) Constitution

## Core Principles

### I. Privacy and Minimal Data Collection
Naya Sahara connects women with NGOs, public opportunities, information, and safe communication—it is **not** a legal, prison, or medical case-management system. The platform MUST NOT collect or store incarceration histories, court files, offence details, medical diagnoses, children's names, guardian details, or unnecessary personal data. Women MUST NOT be required to provide real names, email addresses, or phone numbers to register or participate.

### II. Pseudonymous Member Identity & Separation of Data
Member-facing and community identities MUST use unique nicknames and illustrated avatars only—never real photographs or legal identities. Private conversations and internal organizational verification metadata MUST remain strictly separated from public/community views and governed by backend authorization and Firestore Security Rules.

### III. No Personal Data in AI Calls & Mandatory Admin Review
AI MUST be used only with public government or NGO notice content, and MUST NOT receive private member profiles, credentials, handover codes, or private chat messages. Any AI-generated translation, summary, or extracted field (deadlines, eligibility, required documents) MUST be clearly labelled and reviewed/approved by a Platform Admin before publication. Never invent deadlines, eligibility criteria, or required documents not stated in the source.

### IV. Safety by Design
Chats support only Woman ↔ NGO and Woman ↔ Woman conversations, MUST require message-request acceptance before a conversation becomes accessible, and MUST remain text-only (no attachments, calls, or group chats). Conversation authorization MUST use actual Firebase Auth participant UIDs. The member-facing experience MUST provide a Quick Exit button and discreet branding (`"My Support"`).

### V. Nepali-First, Accessible UI
The interface MUST prioritize Nepali (`ne`) with an English (`en`) toggle, readable typography, clear form labels, large icon-and-text actions, and browser-based read-aloud support with honest device-capability fallback (never pretending Nepali speech is playing when no Nepali voice exists on the device).

### VI. Minimal, Honest Connectivity Feedback
The MVP MUST NOT implement an offline database synchronization engine, conflict-resolution queue, or persistent local caching of sensitive member data. It should provide only a clear online/offline connection indicator, honest failure messages when disconnected, a retry action when connectivity returns, and optional safe caching of public notices only.

### VII. Simplicity, Free-Tier Sustainability, and Synthetic Data
The hackathon MVP runs on React + Vite + JavaScript, Vercel serverless API routes (`frontend/api/`), and Firebase Spark (Authentication + Firestore only—no Blaze, Cloud Functions, Storage, or Cloudinary). Development and demonstrations MUST use synthetic data only until formal legal and privacy reviews are completed prior to any real-world pilot.

## Language and Pilot Constraints

All member-facing language MUST refer to a person as a `"woman"` or `"member"`; the term `"victim"` MUST NOT be used. No real-world pilot may begin before qualified legal and privacy reviews approve data handling, retention, and safeguarding procedures.

## Governance

This constitution governs active project specifications and overrides conflicting older documentation.

**Version**: 2.0.0 | **Ratified**: 2026-11-26 | **Last Amended**: 2026-11-27
