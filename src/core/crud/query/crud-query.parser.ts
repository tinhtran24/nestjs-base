import { BadRequestException } from '@nestjs/common';
import { ModelStatic, Order, WhereOptions } from 'sequelize';
import { CrudQueryOptions } from '../crud.types';
import { FilterOperators } from './filter-operators';
import { coerceValue, parseBoolean } from './value-coercer';

export interface ParsedCrudQuery {
  page: number;
  pageSize: number;
  order: Order;
  where: WhereOptions;
}

export const RESERVED_QUERY_KEYS = ['page', 'pageSize', 'sort'];
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_MAX_PAGE_SIZE = 100;

const toPositiveInt = (name: string, raw: unknown, fallback: number) => {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1)
    throw new BadRequestException(`"${name}" must be a positive integer`);
  return value;
};

const single = (key: string, raw: unknown): string => {
  if (Array.isArray(raw))
    throw new BadRequestException(`"${key}" was given more than once`);
  if (typeof raw !== 'string')
    throw new BadRequestException(`"${key}" has an invalid value`);
  return raw;
};

/** `sort=createdAt:desc,email` -> [['createdAt','DESC'],['email','ASC']] */
const parseSort = (
  raw: unknown,
  sortable: string[],
  fallback: [string, 'ASC' | 'DESC'],
): Order => {
  if (raw === undefined || raw === '') return [fallback];
  return single('sort', raw)
    .split(',')
    .map((part) => {
      const [field, direction = 'asc'] = part.split(':');
      if (!sortable.includes(field))
        throw new BadRequestException(
          `Cannot sort by "${field}". Sortable: ${sortable.join(', ')}`,
        );
      const dir = direction.toUpperCase();
      if (dir !== 'ASC' && dir !== 'DESC')
        throw new BadRequestException(`Sort direction must be asc or desc`);
      return [field, dir] as [string, 'ASC' | 'DESC'];
    });
};

/**
 * Splits `field.op` into field and operator. A key without a known operator
 * suffix is an equality filter (`?isActive=true` == `?isActive.eq=true`).
 */
const splitKey = (key: string) => {
  const dot = key.lastIndexOf('.');
  if (dot > 0) {
    const operator = FilterOperators.get(key.slice(dot + 1));
    if (operator) return { field: key.slice(0, dot), operator };
  }
  return { field: key, operator: FilterOperators.get('eq') };
};

/**
 * Translates an Express query object into Sequelize options.
 * Only fields listed in `filterable` / `sortable` are accepted, so clients can
 * never filter on columns such as `password`.
 */
export const parseCrudQuery = (
  query: Record<string, unknown>,
  model: ModelStatic<any>,
  options: CrudQueryOptions = {},
): ParsedCrudQuery => {
  const filterable = options.filterable ?? [];
  const sortable = [
    ...new Set([...(options.sortable ?? []), ...filterable, 'createdAt']),
  ];
  const maxPageSize = options.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
  const attributes = model.getAttributes();

  const page = toPositiveInt('page', query.page, 1);
  const pageSize = toPositiveInt(
    'pageSize',
    query.pageSize,
    options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
  );
  if (pageSize > maxPageSize)
    throw new BadRequestException(`"pageSize" must be <= ${maxPageSize}`);

  const conditions: Record<string, Record<symbol, unknown>> = {};
  for (const [key, raw] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.includes(key)) continue;
    const { field, operator } = splitKey(key);
    if (!filterable.includes(field) || !attributes[field])
      throw new BadRequestException(
        `Cannot filter by "${field}". Filterable: ${filterable.join(', ') || 'none'}`,
      );

    const value = single(key, raw);
    const parsed = operator.flag
      ? parseBoolean(key, value)
      : operator.multi
        ? value
            .split(',')
            .map((item) => coerceValue(field, item, attributes[field]))
        : coerceValue(field, value, attributes[field]);

    // Several operators on one field are AND-ed: ?age.gte=18&age.lt=30
    conditions[field] = {
      ...conditions[field],
      ...(operator.build(parsed) as Record<symbol, unknown>),
    };
  }

  return {
    page,
    pageSize,
    order: parseSort(
      query.sort,
      sortable,
      options.defaultSort ?? ['createdAt', 'DESC'],
    ),
    where: conditions as WhereOptions,
  };
};
