import { IsString, Length, MinLength } from 'class-validator';

export class MfaEnrolSetupDto {
  @IsString()
  @MinLength(1)
  enrolmentChallengeId!: string;
}

export class MfaEnrolCompleteDto {
  @IsString()
  @MinLength(1)
  enrolmentChallengeId!: string;

  // Six digits from the authenticator app. Recovery codes are not accepted here — none have
  // been issued yet at this point in the flow.
  @IsString()
  @Length(6, 6)
  code!: string;
}
