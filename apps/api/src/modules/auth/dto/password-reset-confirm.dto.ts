import { IsString, MinLength } from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  @MinLength(1)
  token!: string;

  // §15.1: length-based minimum, not arbitrary complexity rules — same policy as signup.
  @IsString()
  @MinLength(12)
  newPassword!: string;
}
