import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SetUserStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

export class SetOrgStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

export class RevokeCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformName?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  defaultTrialDays?: number;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
