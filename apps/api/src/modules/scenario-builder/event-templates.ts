// The complete, real catalog of event templates the Telemetry Generator can actually render
// (apps/api/src/modules/telemetry-generator/generator.ts's `applyEventTemplate` switch — every
// `case` there has exactly one entry here, verified by diffing the two lists). A scenario
// author can only ever *compose* these 47 existing templates into a new kill chain; inventing a
// genuinely new attack narrative still requires a new `case` block in generator.ts itself — this
// catalog is what makes that real boundary visible to the UI instead of silently accepting a
// made-up template id that would 500 the first time someone launches the scenario.
//
// `portal` groups templates the way the app's own investigation portals are organized
// (Identity Center / Device Center / Email Investigation / Cloud / Network / Web), for the
// builder's template picker. `suggestedTechniqueIds` are every MITRE technique this exact
// template has actually been paired with across the real seeded scenario library (extracted
// from apps/api/prisma/seed.ts, not guessed) — the first entry is the default. Templates with no
// suggested techniques are noise/false-positive bait only: benign by design, never carry a
// technique.

export type EventPortal =
  'identity' | 'endpoint' | 'email' | 'cloud' | 'network' | 'web';

export interface EventTemplateDefinition {
  id: string;
  label: string;
  portal: EventPortal;
  /** Whether this template requires a `device_ref` from the population (writes device-scoped
   * process/file/network/http events) as opposed to only an identity/mailbox. */
  requiresDevice: boolean;
  /** Real technique(s) this template is paired with in the existing scenario library. Empty for
   * noise/bait-only templates. */
  suggestedTechniqueIds: string[];
  /** True for the 5 templates that exist purely as benign false-positive bait in every scenario
   * that uses them today — never ground-truth evidence. */
  isNoiseOnly: boolean;
}

export const EVENT_TEMPLATES: EventTemplateDefinition[] = [
  {
    id: 'phishing_email_invoice_lookalike_login_v1',
    label: 'Phishing email — invoice lookalike login page',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1566.002'],
    isNoiseOnly: false,
  },
  {
    id: 'risky_signin_new_country_v1',
    label: 'Risky sign-in from an unfamiliar country',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078', 'T1078.002'],
    isNoiseOnly: false,
  },
  {
    id: 'password_spray_batch_v1',
    label: 'Password spray — burst of failed sign-ins',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1110.003'],
    isNoiseOnly: false,
  },
  {
    id: 'password_spray_success_signin_v1',
    label: 'Password spray — eventual successful sign-in',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078'],
    isNoiseOnly: false,
  },
  {
    id: 'bec_wire_transfer_request_v1',
    label: 'BEC — urgent wire transfer request',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1656'],
    isNoiseOnly: false,
  },
  {
    id: 'bec_wire_transfer_followup_v1',
    label: 'BEC — payment redirection follow-up',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1656'],
    isNoiseOnly: false,
  },
  {
    id: 'mfa_fatigue_batch_v1',
    label: 'MFA fatigue — burst of push-approval requests',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1621'],
    isNoiseOnly: false,
  },
  {
    id: 'mfa_fatigue_success_signin_v1',
    label: 'MFA fatigue — one push finally approved',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078'],
    isNoiseOnly: false,
  },
  {
    id: 'impossible_travel_first_signin_v1',
    label: 'Impossible travel — first sign-in',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078'],
    isNoiseOnly: false,
  },
  {
    id: 'impossible_travel_second_signin_v1',
    label: 'Impossible travel — second, geographically implausible sign-in',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078'],
    isNoiseOnly: false,
  },
  {
    id: 'insider_data_exfil_email_v1',
    label: 'Insider — data emailed to a personal address',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1048'],
    isNoiseOnly: false,
  },
  {
    id: 'malicious_attachment_email_v1',
    label: 'Malicious email attachment delivered',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1566.001'],
    isNoiseOnly: false,
  },
  {
    id: 'malicious_process_execution_v1',
    label: 'Malicious process executed on the device',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1204.002'],
    isNoiseOnly: false,
  },
  {
    id: 'malicious_c2_beacon_v1',
    label: 'Outbound command-and-control beacon',
    portal: 'network',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1071.001'],
    isNoiseOnly: false,
  },
  {
    id: 'legacy_auth_bypass_signin_v1',
    label: 'Sign-in via legacy auth, bypassing enforced MFA',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1078'],
    isNoiseOnly: false,
  },
  {
    id: 'legacy_auth_mailbox_collection_v1',
    label: 'Legacy auth used to collect mailbox contents',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1114.002'],
    isNoiseOnly: false,
  },
  {
    id: 'lateral_movement_source_connection_v1',
    label: 'Lateral movement — outbound admin-share connection',
    portal: 'network',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1021.002'],
    isNoiseOnly: false,
  },
  {
    id: 'lateral_movement_remote_exec_v1',
    label: 'Lateral movement — remote execution on target device',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1021.002'],
    isNoiseOnly: false,
  },
  {
    id: 'mass_file_encryption_v1',
    label: 'Mass file encryption (ransomware)',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1486'],
    isNoiseOnly: false,
  },
  {
    id: 'cloud_malicious_access_key_creation_v1',
    label: 'Cloud — new access key created by a dormant identity',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1098.001'],
    isNoiseOnly: false,
  },
  {
    id: 'cloud_bucket_enumeration_v1',
    label: 'Cloud — sensitive storage bucket enumerated',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1530'],
    isNoiseOnly: false,
  },
  {
    id: 'web_webshell_initial_access_v1',
    label: 'Web shell — initial access request',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1505.003'],
    isNoiseOnly: false,
  },
  {
    id: 'web_webshell_command_burst_v1',
    label: 'Web shell — burst of attacker commands',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1505.003'],
    isNoiseOnly: false,
  },
  {
    id: 'fileless_powershell_backdoor_v1',
    label: 'Fileless — obfuscated PowerShell backdoor',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1059.001'],
    isNoiseOnly: false,
  },
  {
    id: 'malware_startup_persistence_v1',
    label: 'Malware persistence via Startup folder',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1547.001'],
    isNoiseOnly: false,
  },
  {
    id: 'credential_dumping_lsass_dump_v1',
    label: 'Credential dumping — LSASS memory access',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1003.001'],
    isNoiseOnly: false,
  },
  {
    id: 'insider_bulk_usb_copy_v1',
    label: 'Insider — bulk file copy to removable media',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1052.001'],
    isNoiseOnly: false,
  },
  {
    id: 'insider_source_file_cleanup_v1',
    label: 'Insider — source files deleted after copying',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1070.004'],
    isNoiseOnly: false,
  },
  {
    id: 'cloud_bucket_public_exposure_v1',
    label: 'Cloud — storage bucket policy changed to public',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1530'],
    isNoiseOnly: false,
  },
  {
    id: 'cloud_bucket_public_access_burst_v1',
    label: 'Cloud — burst of access to a now-public bucket',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1530'],
    isNoiseOnly: false,
  },
  {
    id: 'web_idor_enumeration_v1',
    label: 'Web — sequential record IDs requested by an authenticated user',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1213'],
    isNoiseOnly: false,
  },
  {
    id: 'legitimate_batch_export_v1',
    label: 'Web — scheduled reporting job walking records (benign)',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
  {
    id: 'brute_force_single_account_v1',
    label: 'Identity — sustained password guessing against one account',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1110.001'],
    isNoiseOnly: false,
  },
  {
    id: 'credential_stuffing_batch_v1',
    label: 'Identity — one breach-sourced attempt across many accounts',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1110.004'],
    isNoiseOnly: false,
  },
  {
    id: 'privilege_escalation_group_add_v1',
    label: 'Identity — account added to a privileged group and given a role',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1098'],
    isNoiseOnly: false,
  },
  {
    id: 'web_sqli_probe_burst_v1',
    label: 'Web — burst of SQL-injection probe requests',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1190'],
    isNoiseOnly: false,
  },
  {
    id: 'web_sqli_data_exfil_v1',
    label: 'Web — SQL-injection request that exfiltrated data',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1190'],
    isNoiseOnly: false,
  },
  {
    id: 'ransomware_data_staging_exfil_v1',
    label: 'Ransomware — data staged and exfiltrated before encryption',
    portal: 'network',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1048'],
    isNoiseOnly: false,
  },
  {
    id: 'trojan_installer_execution_v1',
    label: 'Trojanized installer executed',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1204.002'],
    isNoiseOnly: false,
  },
  {
    id: 'malware_scheduled_task_persistence_v1',
    label: 'Malware persistence via scheduled task',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1053.005'],
    isNoiseOnly: false,
  },
  {
    id: 'oauth_consent_phishing_email_v1',
    label: 'OAuth consent phishing email',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1566.002'],
    isNoiseOnly: false,
  },
  {
    id: 'oauth_illicit_consent_grant_v1',
    label: 'Illicit OAuth consent grant approved',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1528'],
    isNoiseOnly: false,
  },
  {
    id: 'oauth_app_mailbox_exfil_v1',
    label: 'Malicious OAuth app pulling mailbox contents',
    portal: 'cloud',
    requiresDevice: false,
    suggestedTechniqueIds: ['T1114.002'],
    isNoiseOnly: false,
  },
  {
    id: 'kerberoasting_tgs_request_v1',
    label: 'Kerberoasting — bulk service ticket requests',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1558.003'],
    isNoiseOnly: false,
  },
  {
    id: 'dns_backdoor_execution_v1',
    label: 'DNS backdoor tool executed',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1204.002'],
    isNoiseOnly: false,
  },
  {
    id: 'dns_tunnel_c2_beacon_v1',
    label: 'DNS tunneling — command-and-control beacon',
    portal: 'network',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1071.004'],
    isNoiseOnly: false,
  },
  {
    id: 'dns_tunnel_data_exfil_v1',
    label: 'DNS tunneling — data exfiltrated over DNS',
    portal: 'network',
    requiresDevice: true,
    suggestedTechniqueIds: ['T1041'],
    isNoiseOnly: false,
  },

  // Noise / false-positive bait only — benign by design, no technique, never ground truth.
  {
    id: 'legitimate_travel_signin_v1',
    label: 'Benign — legitimate travel sign-in',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
  {
    id: 'benign_it_admin_email_v1',
    label: 'Benign — routine IT admin email',
    portal: 'email',
    requiresDevice: false,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
  {
    id: 'legacy_auth_benign_service_v1',
    label: 'Benign — legacy auth used by a known service account',
    portal: 'identity',
    requiresDevice: false,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
  {
    id: 'web_legitimate_monitoring_v1',
    label: 'Benign — automated uptime monitoring request',
    portal: 'web',
    requiresDevice: true,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
  {
    id: 'legitimate_startup_shortcut_v1',
    label: 'Benign — ordinary Startup folder shortcut',
    portal: 'endpoint',
    requiresDevice: true,
    suggestedTechniqueIds: [],
    isNoiseOnly: true,
  },
];

export const EVENT_TEMPLATE_IDS = new Set(EVENT_TEMPLATES.map((t) => t.id));
export const DEVICE_REQUIRED_TEMPLATE_IDS = new Set(
  EVENT_TEMPLATES.filter((t) => t.requiresDevice).map((t) => t.id),
);

/** The only 5 home-country codes the Telemetry Generator's city/coordinate lookup
 * (apps/api/src/common/geo.ts) actually knows how to place — anything else silently fails
 * geo-distance reasoning (impossible-travel, unfamiliar-country alerts). */
export const NARRATIVE_HOME_COUNTRIES = ['US', 'CA', 'GB', 'DE', 'AU'] as const;

export const NARRATIVE_OS_PLATFORMS = ['windows', 'linux'] as const;
