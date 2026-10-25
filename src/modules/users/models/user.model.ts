import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AllowNull,
  BelongsToMany,
  Column,
  DataType,
  Default,
  DefaultScope,
  HasOne,
  Scopes,
  Table,
  Unique,
} from 'sequelize-typescript';
import { BaseModel } from '../../../database/base.model';
import { Role } from '../../roles/models/role.model';
import { UserRole } from '../../roles/models/user-role.model';
import { Profile } from './profile.model';

export const USER_WITH_PASSWORD = 'withPassword';

// The hash never leaves the database unless a query asks for it explicitly.
@DefaultScope(() => ({ attributes: { exclude: ['password'] } }))
@Scopes(() => ({ [USER_WITH_PASSWORD]: {} }))
@Table({ tableName: 'Users' })
export class User extends BaseModel<User> {
  @ApiProperty({ example: 'jane@example.com' })
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare password: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare firstName: string | null;

  @ApiPropertyOptional()
  @Column(DataType.STRING)
  declare lastName: string | null;

  @ApiProperty()
  @Default(true)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @ApiProperty()
  @Default(false)
  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare isVerified: boolean;

  @ApiPropertyOptional()
  @Column(DataType.DATE)
  declare lastLoginAt: Date | null;

  @ApiPropertyOptional({ type: () => Profile })
  @HasOne(() => Profile)
  declare profile?: Profile;

  @ApiPropertyOptional({ type: () => [Role] })
  @BelongsToMany(() => Role, () => UserRole)
  declare roles?: Role[];

  /** Belt and braces: even a `withPassword` instance never serialises the hash. */
  toJSON() {
    const { password: _password, ...json } = super.toJSON<any>();
    return json;
  }
}
