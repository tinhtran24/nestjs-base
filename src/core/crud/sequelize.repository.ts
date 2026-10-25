import {
  CreateOptions,
  CreationAttributes,
  DestroyOptions,
  FindAndCountOptions,
  FindOptions,
  ModelStatic,
  Transaction,
  UpdateOptions,
} from 'sequelize';
import { Model } from 'sequelize-typescript';

/**
 * Repository over a Sequelize model. Services depend on this instead of the
 * static model API, which keeps data access in one place and makes services
 * easy to unit-test with a fake repository.
 */
export class SequelizeRepository<M extends Model> {
  constructor(readonly model: ModelStatic<M>) {}

  findAndCountAll(
    options: Omit<FindAndCountOptions<M['_attributes']>, 'group'>,
  ): Promise<{ rows: M[]; count: number }> {
    return this.model.findAndCountAll(options);
  }

  findOne(options: FindOptions<M['_attributes']>): Promise<M | null> {
    return this.model.findOne(options);
  }

  findByPk(
    id: string | number,
    options?: Omit<FindOptions<M['_attributes']>, 'where'>,
  ): Promise<M | null> {
    return this.model.findByPk(id, options);
  }

  findAll(options: FindOptions<M['_attributes']>): Promise<M[]> {
    return this.model.findAll(options);
  }

  create(
    values: CreationAttributes<M>,
    options?: CreateOptions<M['_attributes']>,
  ): Promise<M> {
    return this.model.create(values, options);
  }

  update(
    entity: M,
    values: Partial<M['_attributes']>,
    options?: Omit<UpdateOptions<M['_attributes']>, 'where'>,
  ): Promise<M> {
    return entity.update(values, options);
  }

  destroy(
    entity: M,
    options?: Omit<DestroyOptions<M['_attributes']>, 'where'>,
  ): Promise<void> {
    return entity.destroy(options);
  }

  /** Runs `work` in a managed transaction (commit on success, rollback on throw). */
  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.model.sequelize.transaction(work);
  }
}
