import { IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateAlertStatusDto {
  @IsIn(['new', 'in_progress', 'resolved', 'dismissed'])
  status!: 'new' | 'in_progress' | 'resolved' | 'dismissed';

  // Required when status is 'dismissed' (§2.1, §8.6); ignored otherwise.
  @ValidateIf((o: UpdateAlertStatusDto) => o.status === 'dismissed')
  @IsString()
  @MinLength(10)
  dismissalReason?: string;
}
