import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  // Same boundary as SignupDto: org_admin/platform_admin are never grantable by invite,
  // only by directly creating an organization (which promotes the creator themselves).
  @IsIn(['student', 'instructor'])
  role!: 'student' | 'instructor';
}
