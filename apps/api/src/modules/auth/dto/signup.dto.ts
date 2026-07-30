import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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

  // §15.2: org_admin/platform_admin are never self-service; instructor is, for MVP,
  // since there's no org-invite flow yet (§1.7 Phase 2 defers that properly).
  @IsOptional()
  @IsIn(['student', 'instructor'])
  role?: 'student' | 'instructor';
}
