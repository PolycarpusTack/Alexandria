import { body, param } from 'express-validator';
import { ConnectionType } from '../../database/entities/Connection.entity';

export const createConnectionValidator = [
  body('sourceId')
    .notEmpty().withMessage('Source ID is required')
    .isUUID().withMessage('Source ID must be a valid UUID'),
  
  body('targetId')
    .notEmpty().withMessage('Target ID is required')
    .isUUID().withMessage('Target ID must be a valid UUID'),
  
  body('type')
    .optional()
    .isIn(Object.values(ConnectionType)).withMessage('Invalid connection type'),
  
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),
  
  body()
    .custom((value) => value.sourceId !== value.targetId)
    .withMessage('Source and target nodes must be different')
];

export const connectionIdValidator = [
  param('id')
    .isUUID().withMessage('Invalid connection ID')
];

export const nodeConnectionsValidator = [
  param('id')
    .isUUID().withMessage('Invalid node ID')
];