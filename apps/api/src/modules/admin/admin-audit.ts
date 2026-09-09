// Audit-log action names for privileged admin actions. Kept in one place so the Audit Logs
// filter and every writer agree on the exact strings. Prefixed `admin.` to set them apart
// from the auth-surface actions the auth service already writes (`login_failed`,
// `account_locked`, `mfa_enabled`, …).
export const ADMIN_AUDIT = {
  userSuspended: 'admin.user_suspended',
  userReactivated: 'admin.user_reactivated',
  userMfaReset: 'admin.user_mfa_reset',
  orgSuspended: 'admin.org_suspended',
  orgReactivated: 'admin.org_reactivated',
  certificateRevoked: 'admin.certificate_revoked',
  certificateReissued: 'admin.certificate_reissued',
  adminRoleGranted: 'admin.role_granted',
  adminRoleRevoked: 'admin.role_revoked',
  settingsUpdated: 'admin.settings_updated',
} as const;

// The auth service already records these into audit_logs; the Security Events view reads them
// back out. Listed here so that view and the auth writers can't drift on the strings.
export const SECURITY_AUDIT_ACTIONS = [
  'login_failed',
  'account_locked',
  'mfa_challenge_failed',
  'mfa_enabled',
  'mfa_disabled',
  'password_reset_completed',
  ADMIN_AUDIT.userMfaReset,
  ADMIN_AUDIT.userSuspended,
  ADMIN_AUDIT.userReactivated,
] as const;
