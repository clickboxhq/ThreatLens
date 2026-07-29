// Curated, realism-vetted content the generator draws from (§7.3). Scoped down to what the
// walking-skeleton scenario needs; breadth-phase work expands this into a real content-team
// -maintained library rather than inline constants.

export const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Sam', 'Jamie', 'Drew', 'Cameron',
  'Priya', 'Wei', 'Fatima', 'Noah', 'Olivia', 'Liam', 'Emma', 'Lucas', 'Sofia', 'Mateo',
];

export const LAST_NAMES = [
  'Nguyen', 'Smith', 'Garcia', 'Kim', 'Patel', 'Johnson', 'Chen', 'Müller', 'Rossi', 'Kowalski',
  'Andersson', 'Silva', 'Khan', 'Brown', 'Dubois', 'Ivanov', 'Tanaka', 'Costa', 'Novak', 'Haddad',
];

export const DEPARTMENTS = ['Finance', 'Engineering', 'Sales', 'Human Resources', 'IT', 'Marketing', 'Legal', 'Operations'];

export const JOB_TITLES: Record<string, string[]> = {
  Finance: ['Accounts Payable Specialist', 'Financial Analyst', 'Controller'],
  Engineering: ['Software Engineer', 'DevOps Engineer', 'QA Engineer'],
  Sales: ['Account Executive', 'Sales Development Rep'],
  'Human Resources': ['HR Generalist', 'Recruiter'],
  IT: ['IT Support Specialist', 'Systems Administrator'],
  Marketing: ['Marketing Coordinator', 'Content Strategist'],
  Legal: ['Paralegal', 'Compliance Analyst'],
  Operations: ['Operations Coordinator', 'Supply Chain Analyst'],
};

export const HOSTNAME_PREFIX: Record<string, string> = {
  Finance: 'FIN', Engineering: 'ENG', Sales: 'SLS', 'Human Resources': 'HR',
  IT: 'IT', Marketing: 'MKT', Legal: 'LGL', Operations: 'OPS',
};

export const ORG_DOMAIN = 'contoso-finance.example.com';
export const MALICIOUS_DOMAIN = 'secure-invoice-portal-verify.com';
export const LOOKALIKE_INTERNAL_DOMAIN = 'contoso-finance-support.example.com';

export interface CountryCity {
  country: string;
  city: string;
}

export const HOME_COUNTRIES: CountryCity[] = [
  { country: 'US', city: 'Chicago' },
  { country: 'CA', city: 'Toronto' },
  { country: 'GB', city: 'London' },
  { country: 'DE', city: 'Berlin' },
  { country: 'AU', city: 'Sydney' },
];

export const TRAVEL_COUNTRIES: CountryCity[] = [
  { country: 'FR', city: 'Paris' },
  { country: 'JP', city: 'Tokyo' },
  { country: 'SG', city: 'Singapore' },
  { country: 'MX', city: 'Mexico City' },
];

export const RISKY_UNFAMILIAR_COUNTRIES: CountryCity[] = [
  { country: 'RO', city: 'Bucharest' },
  { country: 'VN', city: 'Hanoi' },
  { country: 'NG', city: 'Lagos' },
];

export const APPLICATIONS = ['Office 365 Exchange Online', 'Salesforce', 'Workday', 'Slack'];
