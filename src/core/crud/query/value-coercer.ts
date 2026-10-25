import { BadRequestException } from '@nestjs/common';
import { ModelAttributeColumnOptions } from 'sequelize';

const NUMERIC = new Set([
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'MEDIUMINT',
  'FLOAT',
  'DOUBLE',
  'DECIMAL',
  'REAL',
  'NUMBER',
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const typeKey = (attribute: ModelAttributeColumnOptions) =>
  (attribute.type as { key?: string })?.key ?? 'STRING';

export const parseBoolean = (field: string, raw: string): boolean => {
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new BadRequestException(`"${field}" expects true or false`);
};

/**
 * Converts a raw query-string value into the JS type of the column, so that
 * `?age.gt=18` compares numbers and `?phone=0123` stays a string.
 * Invalid input becomes a 400 instead of a database error.
 */
export const coerceValue = (
  field: string,
  raw: string,
  attribute: ModelAttributeColumnOptions,
): unknown => {
  const key = typeKey(attribute);

  if (NUMERIC.has(key)) {
    const value = Number(raw);
    if (raw.trim() === '' || Number.isNaN(value))
      throw new BadRequestException(`"${field}" expects a number`);
    return value;
  }
  if (key === 'BOOLEAN') return parseBoolean(field, raw);
  if (key === 'DATE' || key === 'DATEONLY') {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime()))
      throw new BadRequestException(`"${field}" expects an ISO date`);
    return value;
  }
  if (key === 'UUID' && !UUID_RE.test(raw))
    throw new BadRequestException(`"${field}" expects a UUID`);
  return raw;
};
