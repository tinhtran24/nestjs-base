import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Table,
  Unique,
} from 'sequelize-typescript';
import { BaseModel } from '../../../database/base.model';
import { User } from '../../users/models/user.model';
import { UserRole } from './user-role.model';

@Table({ tableName: 'Roles' })
export class Role extends BaseModel<Role> {
  @ApiProperty({ example: 'ADMIN' })
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare name: string;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare description: string | null;

  @BelongsToMany(() => User, () => UserRole)
  declare users?: User[];
}
