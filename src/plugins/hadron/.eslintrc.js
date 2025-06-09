module.exports = {
  extends: ['../../../.eslintrc.js'],
  rules: {
    // Forbid 'any' type
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Require return types on functions
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
    }],
    
    // Require JSDoc for public APIs
    'jsdoc/require-jsdoc': ['warn', {
      publicOnly: true,
      require: {
        ClassDeclaration: true,
        FunctionDeclaration: true,
        MethodDefinition: true
      }
    }],
    
    // CSS-in-JS rules
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TemplateElement[value.raw=/color:\s*#[0-9a-fA-F]{3,6}/]',
        message: 'Use CSS variables instead of hard-coded colors'
      },
      {
        selector: 'TemplateElement[value.raw=/rgb\(/]',
        message: 'Use CSS variables instead of RGB colors'
      }
    ],
    
    // Enforce consistent imports
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../**/enhanced*'],
            message: 'Import from the base service instead of enhanced version'
          }
        ]
      }
    ],
    
    // Error handling
    'no-throw-literal': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    
    // Performance
    'no-await-in-loop': 'warn'
  },
  
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
};