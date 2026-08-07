import { scrub } from './scrubbing-logger.service';

describe('scrub (§5.2, §15.6)', () => {
  it('redacts a top-level password field', () => {
    expect(scrub({ email: 'a@b.com', password: 'hunter2' })).toEqual({
      email: 'a@b.com',
      password: '[REDACTED]',
    });
  });

  it('redacts token, secret, and authorization fields regardless of case', () => {
    const input = {
      accessToken: 'a.b.c',
      refreshToken: 'r.t',
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      Authorization: 'Bearer a.b.c',
      AUTHORIZATION: 'Bearer x',
    };
    expect(scrub(input)).toEqual({
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      mfaSecret: '[REDACTED]',
      Authorization: '[REDACTED]',
      AUTHORIZATION: '[REDACTED]',
    });
  });

  it('redacts nested secret-shaped fields inside a logged object graph', () => {
    const input = { user: { email: 'a@b.com', credentials: { password: 'hunter2' } } };
    expect(scrub(input)).toEqual({
      user: { email: 'a@b.com', credentials: { password: '[REDACTED]' } },
    });
  });

  it('redacts secret-shaped fields inside array elements', () => {
    const input = [{ token: 't1' }, { token: 't2' }];
    expect(scrub(input)).toEqual([{ token: '[REDACTED]' }, { token: '[REDACTED]' }]);
  });

  it('leaves unrelated fields and non-object values untouched', () => {
    expect(scrub({ id: 'u-1', displayName: 'Alex', count: 3, active: true })).toEqual({
      id: 'u-1',
      displayName: 'Alex',
      count: 3,
      active: true,
    });
    expect(scrub('a plain string log message')).toBe('a plain string log message');
    expect(scrub(42)).toBe(42);
    expect(scrub(null)).toBeNull();
    expect(scrub(undefined)).toBeUndefined();
  });

  it('leaves Date and Error instances untouched rather than flattening them into plain objects', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(scrub(date)).toBe(date);

    const error = new Error('boom');
    expect(scrub(error)).toBe(error);
  });

  it('does not stack-overflow on a circular reference', () => {
    const input: Record<string, unknown> = { password: 'hunter2' };
    input.self = input;

    const result = scrub(input) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.self).toBe(input); // circular branch is returned as-is once already visited
  });

  it('does not mutate the original object', () => {
    const input = { password: 'hunter2' };
    scrub(input);
    expect(input.password).toBe('hunter2');
  });
});
