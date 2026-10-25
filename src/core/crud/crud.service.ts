import { NotFoundException } from '@nestjs/common';
import {
  CreationAttributes,
  FindOptions,
  Op,
  Transaction,
  WhereOptions,
} from 'sequelize';
import { Model } from 'sequelize-typescript';
import { Paginated } from '../http/paginated';
import { CrudContext } from './crud.types';
import { ParsedCrudQuery } from './query/crud-query.parser';
import { SequelizeRepository } from './sequelize.repository';

export interface CrudServiceOptions {
  /** Column compared with the user id for owner-only access. Default: 'userId'. */
  ownerField?: string;
}

type Attributes<M extends Model> = M['_attributes'];

/**
 * Generic CRUD use-cases (Template Method). The public methods fix the algorithm
 * — scoping, transactions, not-found handling, reloading — and subclasses
 * customise it by overriding the protected hooks:
 *
 *   readOptions()  includes/attributes used when reading
 *   scope()        extra WHERE applied to every query (ownership, tenancy...)
 *   beforeCreate / afterCreate / beforeUpdate / afterUpdate / beforeRemove / afterRemove
 *
 * Mutations run in one transaction; hooks receive it in `ctx.transaction`.
 */
export abstract class CrudService<
  M extends Model,
  CreateDto = any,
  UpdateDto = any,
> {
  protected readonly ownerField: string;

  protected constructor(
    protected readonly repository: SequelizeRepository<M>,
    options: CrudServiceOptions = {},
  ) {
    this.ownerField = options.ownerField ?? 'userId';
  }

  async findMany(
    query: ParsedCrudQuery,
    ctx: CrudContext = {},
  ): Promise<Paginated<M>> {
    const { rows, count } = await this.repository.findAndCountAll({
      ...this.readOptions(),
      where: this.where(query.where, ctx),
      order: query.order,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      distinct: true,
    });
    return Paginated.of(rows, count, query.page, query.pageSize);
  }

  async findOne(id: string | number, ctx: CrudContext = {}): Promise<M> {
    return this.getOrFail(id, ctx, this.readOptions());
  }

  async create(dto: CreateDto, ctx: CrudContext = {}): Promise<M> {
    const created = await this.repository.transaction(async (transaction) => {
      const hookCtx = { ...ctx, transaction };
      const values = await this.beforeCreate(dto, hookCtx);
      const entity = await this.repository.create(values, { transaction });
      await this.afterCreate(entity, dto, hookCtx);
      return entity;
    });
    return this.reload(created);
  }

  async update(
    id: string | number,
    dto: UpdateDto,
    ctx: CrudContext = {},
  ): Promise<M> {
    const updated = await this.repository.transaction(async (transaction) => {
      const hookCtx = { ...ctx, transaction };
      const entity = await this.getOrFail(id, hookCtx, {
        lock: transaction.LOCK.UPDATE,
      });
      const values = await this.beforeUpdate(entity, dto, hookCtx);
      await this.repository.update(entity, values, { transaction });
      await this.afterUpdate(entity, dto, hookCtx);
      return entity;
    });
    return this.reload(updated);
  }

  async remove(id: string | number, ctx: CrudContext = {}): Promise<void> {
    await this.repository.transaction(async (transaction) => {
      const hookCtx = { ...ctx, transaction };
      const entity = await this.getOrFail(id, hookCtx, {
        lock: transaction.LOCK.UPDATE,
      });
      await this.beforeRemove(entity, hookCtx);
      await this.repository.destroy(entity, { transaction });
      await this.afterRemove(entity, hookCtx);
    });
  }

  // ---- hooks -------------------------------------------------------------

  /** Options merged into every read (includes, attribute lists...). */
  protected readOptions(): Omit<FindOptions<Attributes<M>>, 'where'> {
    return {};
  }

  /** Row-level restriction added to every query. Default: ownership. */
  protected scope(ctx: CrudContext): WhereOptions {
    return ctx.ownedBy ? { [this.ownerField]: ctx.ownedBy } : {};
  }

  protected async beforeCreate(
    dto: CreateDto,
    _ctx: CrudContext,
  ): Promise<CreationAttributes<M>> {
    return dto as unknown as CreationAttributes<M>;
  }

  protected async afterCreate(
    _entity: M,
    _dto: CreateDto,
    _ctx: CrudContext,
  ): Promise<void> {}

  protected async beforeUpdate(
    _entity: M,
    dto: UpdateDto,
    _ctx: CrudContext,
  ): Promise<Partial<Attributes<M>>> {
    return dto as unknown as Partial<Attributes<M>>;
  }

  protected async afterUpdate(
    _entity: M,
    _dto: UpdateDto,
    _ctx: CrudContext,
  ): Promise<void> {}

  protected async beforeRemove(_entity: M, _ctx: CrudContext): Promise<void> {}

  protected async afterRemove(_entity: M, _ctx: CrudContext): Promise<void> {}

  // ---- helpers -----------------------------------------------------------

  protected where(base: WhereOptions, ctx: CrudContext): WhereOptions {
    const parts = [base, this.scope(ctx)].filter(
      (part) => part && Reflect.ownKeys(part).length > 0,
    );
    if (parts.length === 0) return {};
    return parts.length === 1 ? parts[0] : { [Op.and]: parts };
  }

  /**
   * Loads one row inside the caller's scope. Rows outside the scope are
   * reported as 404, not 403, so their existence is not revealed.
   */
  protected async getOrFail(
    id: string | number,
    ctx: CrudContext,
    options: Omit<FindOptions<Attributes<M>>, 'where' | 'transaction'> = {},
  ): Promise<M> {
    const entity = await this.repository.findOne({
      ...options,
      where: this.where({ id }, ctx),
      transaction: ctx.transaction,
    });
    if (!entity)
      throw new NotFoundException(`${this.repository.model.name} not found`);
    return entity;
  }

  protected async reload(entity: M, transaction?: Transaction): Promise<M> {
    return this.repository.findByPk((entity as any).id, {
      ...this.readOptions(),
      transaction,
    });
  }
}
