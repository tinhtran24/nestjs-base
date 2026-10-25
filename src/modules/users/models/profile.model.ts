import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { BaseModel } from '../../../database/base.model';
import { User } from './user.model';

@Table({ tableName: 'Profiles' })
export class Profile extends BaseModel<Profile> {
  @ForeignKey(() => User)
  @Unique
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @ApiPropertyOptional()
  @Column(DataType.STRING(30))
  declare phoneNumber: string | null;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @Column(DataType.STRING(10))
  declare gender: string | null;

  @ApiPropertyOptional({ format: 'date' })
  @Column(DataType.DATEONLY)
  declare birthDate: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare avatarUrl: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare country: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare city: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare address: string | null;

  @ApiPropertyOptional()
  @Column(DataType.TEXT)
  declare bio: string | null;

  @BelongsTo(() => User, { onDelete: 'CASCADE' })
  declare user?: User;
}
