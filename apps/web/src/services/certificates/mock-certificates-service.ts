import type { Certificate } from "@/types/certificates";
import type { CertificatesService } from "./certificates-service";

const certs: Certificate[] = [
  {
    name: "ThreatLens Certified Analyst — L2",
    id: "SBX-CA2-4419",
    holder: "John Doe",
    score: "87 / 100",
    issued: "Jun 24, 2026",
    expires: "Jun 24, 2028",
    verificationStatus: "active",
    verifyUrl: "/verify/SBX-CA2-4419",
  },
  {
    name: "Identity Attack Investigation",
    id: "SBX-IAI-1188",
    holder: "John Doe",
    score: "91 / 100",
    issued: "Jun 12, 2026",
    expires: "Jun 12, 2028",
    verificationStatus: "active",
    verifyUrl: "/verify/SBX-IAI-1188",
  },
  {
    name: "Endpoint Forensics Fundamentals",
    id: "SBX-EFF-0921",
    holder: "John Doe",
    score: "84 / 100",
    issued: "May 30, 2026",
    expires: "May 30, 2028",
    verificationStatus: "active",
    verifyUrl: "/verify/SBX-EFF-0921",
  },
  {
    name: "Email Threat Investigation",
    id: "SBX-ETI-0774",
    holder: "John Doe",
    score: "88 / 100",
    issued: "May 18, 2026",
    expires: "May 18, 2028",
    verificationStatus: "active",
    verifyUrl: "/verify/SBX-ETI-0774",
  },
];

export const mockCertificatesService: CertificatesService = {
  listCertificates: () => Promise.resolve(certs),
  getCertificate: (id) => Promise.resolve(certs.find((c) => c.id === id) ?? null),
};
