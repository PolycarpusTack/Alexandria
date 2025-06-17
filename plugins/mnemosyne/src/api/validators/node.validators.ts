import { body, param, query } from 'express-validator';
import { NodeType } from '../../database/entities/Node.entity';

export const createNodeValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 500 }).withMessage('Title must be less than 500 characters'),
  
  body('content')
    .optional()
    .isString().withMessage('Content must be a string'),
  
  body('type')
    .optional()
    .isIn(Object.values(NodeType)).withMessage('Invalid node type'),
  
  body('parentId')
    .optional()
    .isUUID().withMessage('Parent ID must be a valid UUID'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),
  
  body('metadata.tags')
    .optional()
    .isArray().withMessage('Tags must be an array')
    .custom((tags) => tags.every((tag: any) => typeof tag === 'string'))
    .withMessage('All tags must be strings'),
  
  body('metadata.author')
    .optional()
    .isString().withMessage('Author must be a string')
];

export const updateNodeValidator = [
  param('id')
    .isUUID().withMessage('Invalid node ID'),
  
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 500 }).withMessage('Title must be less than 500 characters'),
  
  body('content')
    .optional()
    .isString().withMessage('Content must be a string'),
  
  body('type')
    .optional()
    .isIn(Object.values(NodeType)).withMessage('Invalid node type'),
  
  body('parentId')
    .optional()
    .isUUID().withMessage('Parent ID must be a valid UUID'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),
  
  body('metadata.tags')
    .optional()
    .isArray().withMessage('Tags must be an array')
    .custom((tags) => tags.every((tag: any) => typeof tag === 'string'))
    .withMessage('All tags must be strings')
];

export const getNodesValidator = [
  query('parentId')
    .optional()
    .isUUID().withMessage('Parent ID must be a valid UUID'),
  
  query('type')
    .optional()
    .isIn(Object.values(NodeType)).withMessage('Invalid node type'),
  
  query('tag')
    .optional()
    .isString().withMessage('Tag must be a string'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer')
];

export const nodeIdValidator = [
  param('id')
    .isUUID().withMessage('Invalid node ID')
];

export const moveNodeValidator = [
  param('id')
    .isUUID().withMessage('Invalid node ID'),
  
  body('parentId')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('Parent ID must be a string or null')
    .custom((value) => value === null || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    .withMessage('Parent ID must be a valid UUID or null')
];