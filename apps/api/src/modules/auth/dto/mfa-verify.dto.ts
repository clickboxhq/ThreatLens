import { IsString, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @MinLength(1)
  mfaChallengeId!: string;

  // A TOTP code (6 digits) or a recovery code (longer, hyphenated) — length isn't fixed here
  // since both formats are accepted; AuthService distinguishes them.
  @IsString()
  @MinLength(6)
  code!: string;
}
