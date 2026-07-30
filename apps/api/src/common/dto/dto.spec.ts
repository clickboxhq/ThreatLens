import type { Alert, Device, EmailMessage, FileEvent, Identity, MitreTechnique, NetworkEvent, ProcessEvent, SignInEvent } from '@prisma/client';
import { toStudentIdentityDto } from './identity.dto';
import { toStudentSignInDto } from './sign-in.dto';
import { toStudentEmailDto } from './email.dto';
import { toStudentAlertDto } from './alert.dto';
import { toStudentDeviceDto, toStudentFileEventDto, toStudentNetworkEventDto, toStudentProcessEventDto } from './device.dto';

const FORBIDDEN_SUBSTRINGS = ['isGroundTruthEvidence', 'isGroundTruthActor', 'isFalsePositiveByDesign', 'correlationId'];

function assertNoForbiddenFields(value: unknown) {
  const json = JSON.stringify(value);
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    expect(json).not.toContain(forbidden);
  }
}

// §12.3: no Student-facing response may ever contain ground-truth fields, regardless of
// what the underlying database row carries. This test intentionally sets every forbidden
// field on the input so a future change that accidentally spreads the raw row would fail it.
describe('Student DTO layer never leaks ground truth (§12.3, §18.3)', () => {
  it('strips ground-truth fields from an identity', () => {
    const identity = {
      id: 'id-1',
      isGroundTruthActor: true,
      displayName: 'Test',
      userPrincipalName: 'test@example.com',
      department: 'Finance',
      jobTitle: 'Analyst',
      managerIdentityId: null,
      riskLevel: 'none',
      mfaStatus: 'enforced',
      accountStatus: 'active',
      isPrivileged: false,
      homeCountry: 'US',
    } as Identity;

    assertNoForbiddenFields(toStudentIdentityDto(identity));
  });

  it('strips ground-truth fields from a sign-in event', () => {
    const event = {
      id: 'e-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: { source: 'ground_truth' },
      sessionId: 's-1',
      occurredAt: new Date(),
      identityId: 'id-1',
      deviceId: null,
      sourceIp: '1.2.3.4',
      sourceCountry: 'US',
      sourceCity: 'Chicago',
      application: 'Office 365',
      result: 'success',
      failureReason: null,
      isLegacyAuth: false,
      clientApp: 'Modern Auth',
    } as SignInEvent;

    const dto = toStudentSignInDto(event);
    assertNoForbiddenFields(dto);
    expect(JSON.parse(JSON.stringify(dto)).raw).toBeUndefined();
  });

  it('strips ground-truth fields from an email message', () => {
    const email = {
      id: 'm-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      sessionId: 's-1',
      occurredAt: new Date(),
      messageId: '<a@b>',
      direction: 'inbound',
      senderAddress: 'a@b.com',
      senderDisplayName: 'A',
      recipientAddresses: ['victim@example.com'],
      subject: 'Test',
      bodyHtml: '<p>hi</p>',
      headersRaw: {},
      spfResult: 'fail',
      dkimResult: 'none',
      dmarcResult: 'fail',
    } as EmailMessage;

    assertNoForbiddenFields(toStudentEmailDto(email));
  });

  it('strips internal fields from an alert but keeps its own MITRE technique', () => {
    const alert = {
      id: 'a-1',
      isFalsePositiveByDesign: true,
      detectionRuleId: 'rule-1',
      sessionId: 's-1',
      title: 'Test alert',
      description: 'desc',
      severity: 'high',
      status: 'new',
      dismissalReason: null,
      primaryEntityType: 'identity',
      primaryEntityId: 'id-1',
      mitreTechniqueId: 'technique-1',
      relatedAlertId: null,
      dedupCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      mitreTechnique: {
        id: 'technique-1',
        techniqueId: 'T1078',
        name: 'Valid Accounts',
        tactic: 'TA0001',
        description: 'desc',
        url: null,
      },
    } as unknown as Alert & { mitreTechnique: MitreTechnique };

    const dto = toStudentAlertDto(alert);
    assertNoForbiddenFields(dto);
    expect(dto.mitreTechnique?.techniqueId).toBe('T1078');
  });

  it('strips ground-truth fields from a device', () => {
    const dev = {
      id: 'd-1',
      isGroundTruthActor: true,
      sessionId: 's-1',
      hostname: 'FIN-WKS-07',
      osPlatform: 'windows',
      osVersion: '11 23H2',
      primaryIdentityId: null,
      riskLevel: 'none',
      isolationStatus: 'not_isolated',
      lastSeenAt: new Date(),
    } as Device;

    assertNoForbiddenFields(toStudentDeviceDto(dev));
  });

  it('strips ground-truth fields from a process event', () => {
    const event = {
      id: 'p-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: { source: 'ground_truth' },
      sessionId: 's-1',
      occurredAt: new Date(),
      deviceId: 'd-1',
      processGuid: 'guid-1',
      parentProcessGuid: null,
      imagePath: 'C:\\WINWORD.EXE',
      commandLine: 'WINWORD.EXE',
      hashSha256: 'a'.repeat(64),
      parentImagePath: null,
      integrityLevel: 'Medium',
      identityId: 'id-1',
    } as ProcessEvent;

    const dto = toStudentProcessEventDto(event);
    assertNoForbiddenFields(dto);
    expect(JSON.parse(JSON.stringify(dto)).raw).toBeUndefined();
  });

  it('strips ground-truth fields from a file event', () => {
    const event = {
      id: 'f-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: {},
      sessionId: 's-1',
      occurredAt: new Date(),
      deviceId: 'd-1',
      action: 'created',
      filePath: 'C:\\Temp\\svc_update.exe',
      hashSha256: 'a'.repeat(64),
      processGuid: 'guid-1',
    } as FileEvent;

    assertNoForbiddenFields(toStudentFileEventDto(event));
  });

  it('strips ground-truth fields from a network event', () => {
    const event = {
      id: 'n-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: {},
      sessionId: 's-1',
      occurredAt: new Date(),
      deviceId: 'd-1',
      direction: 'outbound',
      protocol: 'tcp',
      localPort: 51000,
      remoteIp: '185.220.101.47',
      remotePort: 443,
      bytesSent: 400,
      bytesReceived: 200,
      processGuid: 'guid-1',
    } as NetworkEvent;

    assertNoForbiddenFields(toStudentNetworkEventDto(event));
  });
});
