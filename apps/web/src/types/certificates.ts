export type CertificateVerificationStatus = "active" | "revoked";

export type Certificate = {
  name: string;
  id: string;
  holder: string;
  score: string;
  issued: string;
  expires: string;
  verificationStatus: CertificateVerificationStatus;
  verifyUrl: string;
};
