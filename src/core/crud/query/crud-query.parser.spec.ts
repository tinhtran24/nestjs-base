import { BadRequestException } from '@nestjs/common';
import { DataTypes, Op } from 'sequelize';
import { parseCrudQuery } from './crud-query.parser';
import { FilterOperators } from './filter-operators';

const model = {
  getAttributes: () => ({
    id: { type: DataTypes.UUID },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    age: { type: DataTypes.INTEGER },
    isActive: { type: DataTypes.BOOLEAN },
    password: { type: DataTypes.STRING },
    createdAt: { type: DataTypes.DATE },
  }),
} as any;

const options = { filterable: ['id', 'email', 'phone', 'age', 'isActive'] };

describe('parseCrudQuery', () => {
  it('applies paging and sort defaults', () => {
    const result = parseCrudQuery({}, model, options);
    expect(result).toEqual({
      page: 1,
      pageSize: 10,
      order: [['createdAt', 'DESC']],
      where: {},
    });
  });

  it('parses page, pageSize and multi-column sort', () => {
    const result = parseCrudQuery(
      { page: '3', pageSize: '20', sort: 'email:asc,createdAt:desc' },
      model,
      options,
    );
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(20);
    expect(result.order).toEqual([
      ['email', 'ASC'],
      ['createdAt', 'DESC'],
    ]);
  });

  it('treats a bare key as equality and coerces by column type', () => {
    const { where } = parseCrudQuery(
      { isActive: 'true', age: '18', phone: '0123' },
      model,
      options,
    );
    expect(where).toEqual({
      isActive: { [Op.eq]: true },
      age: { [Op.eq]: 18 },
      // string column keeps its leading zero
      phone: { [Op.eq]: '0123' },
    });
  });

  it('combines several operators on one field', () => {
    const { where } = parseCrudQuery(
      { 'age.gte': '18', 'age.lt': '30' },
      model,
      options,
    );
    expect(where).toEqual({ age: { [Op.gte]: 18, [Op.lt]: 30 } });
  });

  it('escapes LIKE wildcards', () => {
    const { where } = parseCrudQuery(
      { 'email.like': '50%_off' },
      model,
      options,
    );
    expect(where).toEqual({ email: { [Op.iLike]: '%50\\%\\_off%' } });
  });

  it('splits list operators', () => {
    const { where } = parseCrudQuery({ 'age.in': '1,2,3' }, model, options);
    expect(where).toEqual({ age: { [Op.in]: [1, 2, 3] } });
  });

  it('supports isnull as a flag', () => {
    const { where } = parseCrudQuery(
      { 'email.isnull': 'false' },
      model,
      options,
    );
    expect(where).toEqual({ email: { [Op.not]: null } });
  });

  it.each([
    [{ password: 'x' }, 'not filterable'],
    [{ 'password.like': '$2a' }, 'not filterable (with operator)'],
    [{ unknownField: '1' }, 'unknown column'],
    [{ 'age.gt': 'abc' }, 'non numeric'],
    [{ id: 'not-a-uuid' }, 'invalid uuid'],
    [{ isActive: 'yes' }, 'invalid boolean'],
    [{ page: '0' }, 'page < 1'],
    [{ pageSize: '1000' }, 'pageSize > max'],
    [{ sort: 'password:asc' }, 'not sortable'],
    [{ sort: 'email:sideways' }, 'bad direction'],
    [{ email: ['a', 'b'] }, 'repeated key'],
  ] as [Record<string, unknown>, string][])('rejects %j (%s)', (query) => {
    expect(() => parseCrudQuery(query, model, options)).toThrow(
      BadRequestException,
    );
  });

  it('allows nothing to be filtered by default', () => {
    expect(() => parseCrudQuery({ email: 'a' }, model, {})).toThrow(
      BadRequestException,
    );
  });

  it('uses operators registered at runtime', () => {
    FilterOperators.register({
      name: 'startswith',
      build: (value) => ({ [Op.startsWith]: value }),
    });
    const { where } = parseCrudQuery(
      { 'email.startswith': 'jane' },
      model,
      options,
    );
    expect(where).toEqual({ email: { [Op.startsWith]: 'jane' } });
  });
});
