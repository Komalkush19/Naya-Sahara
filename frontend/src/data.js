import { IMAGE_PATHS } from './config/images.js'

export const initialAssociatedMembers = [
  {
    id: 'mem-1',
    nickname: 'Sajilo',
    avatarId: 'avatar1',
    joinedDate: 'Nov 2026',
    status: 'Active',
    district: 'Lalitpur',
    interests: ['Tailoring', 'Handicrafts'],
    communityOptIn: true,
  },
  {
    id: 'mem-2',
    nickname: 'Prakriti',
    avatarId: 'avatar2',
    joinedDate: 'Nov 2026',
    status: 'Active',
    district: 'Kathmandu',
    interests: ['Computer Basics', 'Cooking'],
    communityOptIn: true,
  },
  {
    id: 'mem-3',
    nickname: 'Sunita',
    avatarId: 'avatar3',
    joinedDate: 'Oct 2026',
    status: 'Active',
    district: 'Pokhara',
    interests: ['Small Business', 'Agriculture'],
    communityOptIn: true,
  },
]

export const initialCases = []

export const initialOrganizations = [
  {
    id: 'org-asha',
    name: 'Asha Sathi Nepal',
    location: 'Lalitpur',
    category: 'Skills & Reintegration',
    focus: 'Community support and skills training',
    contactPhone: '+977-01-5550101 (Demo)',
    contactEmail: 'contact@ashasathi.example',
    status: 'approved',
    verificationStatus: 'verified',
    logoUrl: IMAGE_PATHS.ngos.ngo1,
    caseworkerCount: 2,
    associatedCount: 3,
  },
  {
    id: 'org-ujjwal',
    name: 'Ujjwal Support Centre',
    location: 'Pokhara',
    category: 'Wellbeing & Referrals',
    focus: 'Post-release wellbeing and referrals',
    contactPhone: '+977-061-5550102 (Demo)',
    contactEmail: 'contact@ujjwal.example',
    status: 'pending',
    verificationStatus: 'pending',
    logoUrl: IMAGE_PATHS.ngos.ngo2,
    caseworkerCount: 1,
    associatedCount: 1,
  },
  {
    id: 'org-samjhana',
    name: 'Samjhana Women’s Collective',
    location: 'Kathmandu',
    category: 'Employment & Peer Support',
    focus: 'Employment readiness and peer support',
    contactPhone: '+977-01-5550103 (Demo)',
    contactEmail: 'contact@samjhana.example',
    status: 'approved',
    verificationStatus: 'verified',
    logoUrl: IMAGE_PATHS.ngos.ngo3,
    caseworkerCount: 2,
    associatedCount: 2,
  },
]

export const opportunities = [
  {
    id: 'opp-1',
    title: 'Tailoring skills workshop',
    type: 'Training',
    location: 'Lalitpur',
    date: 'Dec 12, 2026',
    description: 'A beginner-friendly, four-week tailoring workshop with materials provided.',
    nepaliTitle: 'सिलाइ सीप तालिम',
    nepaliDescription: 'सामग्रीसहित चार हप्ताको आधारभूत सिलाइ तालिम।',
  },
  {
    id: 'opp-2',
    title: 'Community kitchen assistant',
    type: 'Job',
    location: 'Kathmandu',
    date: 'Applications open',
    description: 'Paid, part-time role with flexible shifts and on-the-job training.',
    nepaliTitle: 'सामुदायिक भान्सा सहायक',
    nepaliDescription: 'लचिलो समय र काममै तालिमसहितको आंशिक समयको काम।',
  },
  {
    id: 'opp-3',
    title: 'Winter essentials support',
    type: 'Aid',
    location: 'Pokhara',
    date: 'Dec 05, 2026',
    description: 'Request a basic winter clothing and hygiene support package.',
    nepaliTitle: 'जाडोका अत्यावश्यक सामग्री',
    nepaliDescription: 'जाडोका लुगा र सरसफाइ सामग्रीको सहयोगका लागि अनुरोध गर्नुहोस्।',
  },
  {
    id: 'opp-4',
    title: 'Small business basics',
    type: 'Training',
    location: 'Kathmandu',
    date: 'Jan 08, 2027',
    description: 'Practical sessions on budgeting, pricing, and planning a small business.',
    nepaliTitle: 'सानो व्यवसायका आधारभूत कुरा',
    nepaliDescription: 'बजेट, मूल्य निर्धारण र योजना बनाउने व्यावहारिक कक्षा।',
  },
]

export const initialNotices = []

export const initialMessages = [
  {
    id: 'message-1',
    sender: 'Asha Sathi Nepal',
    preview: 'We can share details about the next tailoring workshop.',
    time: '10:24',
    unread: true,
  },
]

export const initialPosts = [
  {
    id: 'post-1',
    nickname: 'Sajilo',
    avatarUrl: IMAGE_PATHS.avatars.avatar1,
    text: 'The skills workshop helped me feel more confident about trying something new.',
    time: 'Today',
  },
  {
    id: 'post-2',
    nickname: 'Ujyalo',
    avatarUrl: IMAGE_PATHS.avatars.avatar2,
    text: 'Does anyone know where I can find information about local training?',
    time: 'Yesterday',
  },
]

export const checklistLabels = {
  basicNeedsReviewed: 'Basic needs discussed',
  supportContactShared: 'Support contact shared',
  nextAppointmentShared: 'Next appointment explained',
}
