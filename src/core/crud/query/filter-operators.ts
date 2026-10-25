import { Op, WhereOperators } from 'sequelize';

/**
 * Strategy for one filter operator in `?field.<operator>=value`.
 * `multi` operators receive the comma-separated value already split into a list.
 */
export interface FilterOperator {
  readonly name: string;
  readonly multi?: boolean;
  /** Operators whose value is a flag (true/false) rather than a column value. */
  readonly flag?: boolean;
  build(value: unknown): WhereOperators;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const simple = (name: string, op: symbol): FilterOperator => ({
  name,
  build: (value) => ({ [op]: value }),
});

const registry = new Map<string, FilterOperator>();

/**
 * Registry of available operators. Add project-specific ones at bootstrap with
 * `FilterOperators.register({...})` — the query parser picks them up automatically.
 */
export const FilterOperators = {
  register(operator: FilterOperator): void {
    registry.set(operator.name, operator);
  },
  get(name: string): FilterOperator | undefined {
    return registry.get(name);
  },
  names(): string[] {
    return [...registry.keys()];
  },
};

[
  simple('eq', Op.eq),
  simple('ne', Op.ne),
  simple('gt', Op.gt),
  simple('gte', Op.gte),
  simple('lt', Op.lt),
  simple('lte', Op.lte),
  {
    name: 'like',
    build: (value) => ({ [Op.iLike]: `%${escapeLike(String(value))}%` }),
  },
  { name: 'in', multi: true, build: (value) => ({ [Op.in]: value as any[] }) },
  {
    name: 'nin',
    multi: true,
    build: (value) => ({ [Op.notIn]: value as any[] }),
  },
  {
    name: 'isnull',
    flag: true,
    build: (value) => (value ? { [Op.is]: null } : { [Op.not]: null }),
  },
].forEach(FilterOperators.register);
