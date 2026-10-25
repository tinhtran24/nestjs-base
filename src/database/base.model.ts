import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  UpdatedAt,
} from 'sequelize-typescript';

/**
 * Shared columns for every table: UUID primary key + timestamps.
 * Extend this instead of `Model` so all entities look the same to the CRUD layer.
 */
export abstract class BaseModel<
  TAttributes extends object = any,
  TCreation extends object = TAttributes,
> extends Model<TAttributes, TCreation> {
  @ApiProperty({ format: 'uuid' })
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ApiProperty()
  @CreatedAt
  declare createdAt: Date;

  @ApiProperty()
  @UpdatedAt
  declare updatedAt: Date;
}
