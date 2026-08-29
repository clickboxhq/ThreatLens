// Backed by SOCVerse's real /auth/mfa/* endpoints — personal account security, the same for
// every role. There is no real SSO/API-keys/data-residency/integrations backend at all (that
// would be net-new infrastructure work, not a wiring job), so this domain no longer pretends
// to cover those.
export type MfaStatus = { enabled: boolean; mandatory: boolean };
export type MfaSetup = { qrCodeDataUrl: string; secret: string };
