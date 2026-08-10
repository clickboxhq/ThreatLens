import type {
  Alert,
  CloudEvent,
  Device,
  EmailMessage,
  FileEvent,
  HttpRequest,
  Identity,
  MitreTechnique,
  NetworkEvent,
  ProcessEvent,
  SignInEvent,
} from '@prisma/client';
import { toStudentIdentityDto } from './identity.dto';
import { toStudentSignInDto } from './sign-in.dto';
import { toStudentEmailDto } from './email.dto';
import { toStudentAlertDto } from './alert.dto';
import {
  toStudentDeviceDto,
  toStudentFileEventDto,
  toStudentHttpRequestDto,
  toStudentNetworkEventDto,
  toStudentProcessEventDto,
} from './device.dto';
import { toStudentCloudEventDto } from './cloud.dto';

const FORBIDDEN_SUBSTRINGS = [
  'isGroundTruthEvidence',
  'isGroundTruthActor',
  'isFalsePositiveByDesign',
  'correlationId',
];

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

  it('strips ground-truth fields from a cloud event', () => {
    const event = {
      id: 'c-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: { source: 'ground_truth' },
      sessionId: 's-1',
      occurredAt: new Date(),
      identityId: 'id-1',
      provider: 'aws_style',
      actionName: 'CreateAccessKey',
      resourceId: 'sofia.garcia@contoso-finance.example.com',
      sourceIp: '203.0.113.10',
    } as CloudEvent;

    const dto = toStudentCloudEventDto(event);
    assertNoForbiddenFields(dto);
    expect(JSON.parse(JSON.stringify(dto)).raw).toBeUndefined();
  });

  it('strips ground-truth fields from an http request', () => {
    const event = {
      id: 'h-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: 'technique-1',
      correlationId: 'corr-1',
      raw: { source: 'ground_truth' },
      sessionId: 's-1',
      occurredAt: new Date(),
      deviceId: 'd-1',
      identityId: null,
      method: 'POST',
      url: '/uploads/images/x7f2a9c.php',
      userAgent: 'curl/7.88.1',
      statusCode: 200,
      sourceIp: '203.0.113.10',
    } as HttpRequest;

    const dto = toStudentHttpRequestDto(event);
    assertNoForbiddenFields(dto);
    expect(JSON.parse(JSON.stringify(dto)).raw).toBeUndefined();
  });
});

// §15.6/§11.10: rendered email HTML is sanitized server-side before it ever leaves the API —
// the frontend renders bodyHtml via dangerouslySetInnerHTML (§17), so this is a real sink, not
// a theoretical one. An allowlist library, not a regex, is what actually holds up against the
// combinations below.
describe('Email HTML sanitization (§15.6, §11.10)', () => {
  function email(bodyHtml: string): EmailMessage {
    return {
      id: 'm-1',
      isGroundTruthEvidence: true,
      mitreTechniqueId: null,
      correlationId: null,
      sessionId: 's-1',
      occurredAt: new Date(),
      messageId: '<a@b>',
      direction: 'inbound',
      senderAddress: 'a@b.com',
      senderDisplayName: 'A',
      recipientAddresses: ['victim@example.com'],
      subject: 'Test',
      bodyHtml,
      headersRaw: {},
      spfResult: 'fail',
      dkimResult: 'none',
      dmarcResult: 'fail',
    } as EmailMessage;
  }

  it('strips a <script> tag and its contents entirely', () => {
    const dto = toStudentEmailDto(
      email('<p>Hello</p><script>alert(document.cookie)</script>'),
    );
    expect(dto.bodyHtml).not.toContain('script');
    expect(dto.bodyHtml).not.toContain('alert');
    expect(dto.bodyHtml).toContain('Hello');
  });

  it('strips inline event-handler attributes', () => {
    const dto = toStudentEmailDto(email('<p onclick="exfil()">Click here</p>'));
    expect(dto.bodyHtml).not.toContain('onclick');
    expect(dto.bodyHtml).not.toContain('exfil');
    expect(dto.bodyHtml).toContain('Click here');
  });

  it('strips a javascript: href instead of just passing it through', () => {
    const dto = toStudentEmailDto(
      email('<a href="javascript:alert(1)">Link</a>'),
    );
    expect(dto.bodyHtml).not.toContain('javascript:');
  });

  it('drops an <iframe>, which a script-tag-only regex would miss', () => {
    const dto = toStudentEmailDto(
      email(
        '<p>Before</p><iframe src="https://evil.example.com"></iframe><p>After</p>',
      ),
    );
    expect(dto.bodyHtml).not.toContain('iframe');
    expect(dto.bodyHtml).toContain('Before');
    expect(dto.bodyHtml).toContain('After');
  });

  it('drops an <svg onload>, which a script-tag-only regex would also miss', () => {
    const dto = toStudentEmailDto(
      email('<svg onload="alert(1)"></svg><p>Safe</p>'),
    );
    expect(dto.bodyHtml).not.toContain('onload');
    expect(dto.bodyHtml).not.toContain('svg');
    expect(dto.bodyHtml).toContain('Safe');
  });

  it('preserves ordinary formatting markup used by real scenario content', () => {
    const dto = toStudentEmailDto(
      email(
        '<p>Please <b>review</b> the attached <a href="https://example.com/invoice">invoice</a>.</p>',
      ),
    );
    expect(dto.bodyHtml).toContain('<b>review</b>');
    expect(dto.bodyHtml).toContain('href="https://example.com/invoice"');
  });
});
