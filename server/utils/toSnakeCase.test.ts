import { toSnakeCase } from './toSnakeCase';

describe('toSnakeCase', () => {
  it('should convert flat object keys to snake_case', () => {
    const input = { firstName: 'John', lastName: 'Doe' };
    const expected = { first_name: 'John', last_name: 'Doe' };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it('should convert nested object keys to snake_case', () => {
    const input = { user: { firstName: 'John', lastName: 'Doe' } };
    const expected = { user: { first_name: 'John', last_name: 'Doe' } };
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it('should convert array elements to snake_case', () => {
    const input = [{ firstName: 'John' }, { lastName: 'Doe' }];
    const expected = [{ first_name: 'John' }, { last_name: 'Doe' }];
    expect(toSnakeCase(input)).toEqual(expected);
  });

  it('should handle non-object values', () => {
    expect(toSnakeCase('string')).toBe('string');
    expect(toSnakeCase(123)).toBe(123);
    expect(toSnakeCase(null)).toBe(null);
  });
}); 