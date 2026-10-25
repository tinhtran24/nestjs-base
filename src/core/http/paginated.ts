import { ApiProperty } from '@nestjs/swagger';

export class PageMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  totalItems: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

/**
 * Returned by list endpoints. The response interceptor recognises it and
 * renders `{ data: items, meta }` instead of `{ data }`.
 */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  static of<T>(
    items: T[],
    totalItems: number,
    page: number,
    pageSize: number,
  ): Paginated<T> {
    return new Paginated(items, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  }
}
