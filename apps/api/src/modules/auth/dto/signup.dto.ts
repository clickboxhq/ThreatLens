import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  // §15.1: length-based minimum, not arbitrary complexity rules.
  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;
}
