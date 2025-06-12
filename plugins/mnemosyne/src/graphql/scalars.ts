import { GraphQLScalarType, GraphQLError } from 'graphql';
import { Kind } from 'graphql/language';

/**
 * Custom GraphQL Date scalar
 */
export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  
  serialize(value: any): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new GraphQLError(`Value is not a valid Date: ${value}`);
  },
  
  parseValue(value: any): Date {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new GraphQLError(`Value is not a valid Date string: ${value}`);
      }
      return date;
    }
    if (value instanceof Date) {
      return value;
    }
    throw new GraphQLError(`Value is not a valid Date: ${value}`);
  },
  
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        throw new GraphQLError(`Value is not a valid Date string: ${ast.value}`, [ast]);
      }
      return date;
    }
    throw new GraphQLError(`Can only parse strings to Dates but got a: ${ast.kind}`, [ast]);
  }
});

/**
 * Custom GraphQL JSON scalar
 */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  
  serialize(value: any): any {
    return value;
  },
  
  parseValue(value: any): any {
    return value;
  },
  
  parseLiteral(ast): any {
    switch (ast.kind) {
      case Kind.STRING:
        try {
          return JSON.parse(ast.value);
        } catch {
          return ast.value;
        }
      case Kind.OBJECT:
        return parseObjectLiteral(ast);
      case Kind.LIST:
        return ast.values.map(item => JSONScalar.parseLiteral(item));
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.NULL:
        return null;
      default:
        throw new GraphQLError(`Unexpected kind in JSON literal: ${ast.kind}`, [ast]);
    }
  }
});

/**
 * Helper function to parse object literals in GraphQL
 */
function parseObjectLiteral(ast: any): any {
  const result: any = {};
  
  if (ast.fields) {
    for (const field of ast.fields) {
      result[field.name.value] = JSONScalar.parseLiteral(field.value);
    }
  }
  
  return result;
}

/**
 * All custom scalars
 */
export const customScalars = {
  Date: DateScalar,
  JSON: JSONScalar
};