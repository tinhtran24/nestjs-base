import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsJWT,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsPassword } from '../../../core/security/is-password.decorator';
import { User } from '../../users/models/user.model';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Secret123' })
  @IsPassword()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secret123' })
  @IsString()
  @MaxLength(72)
  password: string;
}

export class EmailDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;
}

export class TokenDto {
  @ApiProperty()
  @IsJWT()
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ example: 'NewSecret123' })
  @IsPassword()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ example: 'NewSecret123' })
  @IsPassword()
  newPassword: string;
}

export class LoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: '1d' })
  expiresIn: string;

  @ApiProperty({ type: () => User })
  user: User;
}
