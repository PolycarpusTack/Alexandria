import { body, param } from 'express-validator';

export const createTemplateValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Template name is required')
    .isLength({ max: 255 }).withMessage('Name must be less than 255 characters'),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Template content is required'),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Icon must be less than 50 characters')
];

export const updateTemplateValidator = [
  param('id')
    .isUUID().withMessage('Invalid template ID'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Template name cannot be empty')
    .isLength({ max: 255 }).withMessage('Name must be less than 255 characters'),
  
  body('content')
    .optional()
    .trim()
    .notEmpty().withMessage('Template content cannot be empty'),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Icon must be less than 50 characters')
];

export const templateIdValidator = [
  param('id')
    .isUUID().withMessage('Invalid template ID')
];