import {
  AllowNull,
  Column,
  DataType,
  ForeignKey,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from '../../../database/base.model';
import { User } from '../../users/models/user.model';
import { Role } from './role.model';

@Table({ tableName: 'UserRoles' })
export class UserRole extends BaseModel<UserRole> {
  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @ForeignKey(() => Role)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare roleId: string;
}
