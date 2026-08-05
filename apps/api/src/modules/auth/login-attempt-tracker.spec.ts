import { computeLockoutSeconds } from './login-attempt-tracker.service';

describe('computeLockoutSeconds (§15.1)', () => {
  it('applies no lockout below the threshold', () => {
    expect(computeLockoutSeconds(1, 5, 30, 900)).toBe(0);
    expect(computeLockoutSeconds(4, 5, 30, 900)).toBe(0);
  });

  it('applies the base lockout duration exactly at the threshold', () => {
    expect(computeLockoutSeconds(5, 5, 30, 900)).toBe(30);
  });

  it('doubles the lockout duration for each failure past the threshold', () => {
    expect(computeLockoutSeconds(6, 5, 30, 900)).toBe(60);
    expect(computeLockoutSeconds(7, 5, 30, 900)).toBe(120);
    expect(computeLockoutSeconds(8, 5, 30, 900)).toBe(240);
  });

  it('caps the lockout duration at the configured maximum', () => {
    expect(computeLockoutSeconds(20, 5, 30, 900)).toBe(900);
  });

  it('uses the documented defaults when no overrides are given', () => {
    expect(computeLockoutSeconds(4)).toBe(0);
    expect(computeLockoutSeconds(5)).toBe(30);
    expect(computeLockoutSeconds(100)).toBe(900);
  });
});
