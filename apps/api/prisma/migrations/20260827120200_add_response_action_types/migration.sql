-- Response actions the ThreatLens frontend's "Response actions" panel offers (isolate_device,
-- disable_account, and block_sender already existed in this enum; the frontend's fuller list
-- also names force-password-reset, revoke-tokens, and block-IP, which had no representation
-- here yet).
ALTER TYPE "InvestigationActionType" ADD VALUE 'force_password_reset';
ALTER TYPE "InvestigationActionType" ADD VALUE 'revoke_tokens';
ALTER TYPE "InvestigationActionType" ADD VALUE 'block_ip';
