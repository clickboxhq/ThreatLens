import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Onboarding-collected, optional, editable later from org settings.
  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;

  @IsOptional()
  @IsString()
  industry?: string;
}

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  // Same boundary as SignupDto: org_admin/platform_admin are never grantable by invite,
  // only by directly creating an organization (which promotes the creator themselves).
  @IsIn(['student', 'instructor'])
  role!: 'student' | 'instructor';
}

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  // Omitted/null => the whole organisation. Set => one cohort, which the service
  // verifies belongs to the sender's own org before fanning anything out.
  @IsOptional()
  @IsUUID()
  cohortId?: string;
}
