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
export const EXEC_LOOKALIKE_DOMAIN = 'contoso-finance-exec.example.net';
export const EXEC_NAME = 'Morgan Reyes';
export const EXEC_TITLE = 'Chief Financial Officer';
export const PERSONAL_EMAIL_DOMAIN_FOR_GENERATION = 'gmail.com';
export const SENSITIVE_ATTACHMENT_FILENAMES = [
  'Q3_Customer_Contracts_Export.xlsx',
  'Employee_Compensation_Bands_2026.xlsx',
  'Pending_M&A_Due_Diligence_Notes.docx',
];
export const MALWARE_DELIVERY_DOMAIN = 'billing-statements-delivery.example.org';
export const MALWARE_C2_IP = '185.220.101.47';
export const MALWARE_C2_DOMAIN = 'cdn-update-relay.example.net';
export const RANSOM_NOTE_FILENAME = 'README_DECRYPT.txt';
export const SHARED_FILE_PATHS = [
  'C:\\Shares\\Finance\\Q3_Budget_Forecast.xlsx',
  'C:\\Shares\\Finance\\Vendor_Contracts_2026.docx',
  'C:\\Shares\\HR\\Employee_Records_Backup.xlsx',
  'C:\\Shares\\Engineering\\Source_Archive.zip',
  'C:\\Shares\\Legal\\NDA_Templates.docx',
  'C:\\Shares\\Operations\\Inventory_Master.xlsx',
  'C:\\Shares\\Sales\\Pipeline_Report_Q3.xlsx',
  'C:\\Shares\\Marketing\\Campaign_Assets.pptx',
];
export const FILE_SERVER_IP = '10.20.30.15';

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
