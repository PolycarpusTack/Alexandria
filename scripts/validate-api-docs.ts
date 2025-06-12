#!/usr/bin/env ts-node

/**
 * Validate API Documentation Script
 * 
 * This script validates the OpenAPI specification for:
 * - Schema compliance
 * - Security definitions
 * - Response consistency
 * - Documentation completeness
 */

import { validateOpenAPISpec, createSwaggerDocs } from '../src/api/swagger';
import { createLogger } from '../src/utils/logger';

const logger = createLogger({ serviceName: 'docs-validator' });

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  stats: {
    totalPaths: number;
    totalOperations: number;
    documentedOperations: number;
    securedOperations: number;
    operationsWithExamples: number;
  };
}

/**
 * Perform comprehensive API documentation validation
 */
function performDetailedValidation(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    stats: {
      totalPaths: 0,
      totalOperations: 0,
      documentedOperations: 0,
      securedOperations: 0,
      operationsWithExamples: 0
    }
  };

  try {
    // Basic validation first
    const basicValidation = validateOpenAPISpec();
    result.errors.push(...basicValidation.errors);
    
    if (basicValidation.errors.length > 0) {
      result.valid = false;
      return result;
    }

    // Get the OpenAPI specification
    const spec = createSwaggerDocs();
    
    // Validate paths and operations
    if (spec.paths) {
      result.stats.totalPaths = Object.keys(spec.paths).length;
      
      for (const [pathKey, pathValue] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathValue as any)) {
          if (typeof operation === 'object' && operation.operationId) {
            result.stats.totalOperations++;
            
            // Check documentation completeness
            if (operation.summary && operation.description) {
              result.stats.documentedOperations++;
            } else {
              result.warnings.push(`${method.toUpperCase()} ${pathKey}: Missing summary or description`);
            }
            
            // Check security requirements
            if (operation.security || spec.security) {
              result.stats.securedOperations++;
            } else if (!pathKey.includes('/health') && !pathKey.includes('/docs')) {
              result.warnings.push(`${method.toUpperCase()} ${pathKey}: No security requirements defined`);
            }
            
            // Check for examples
            if (operation.responses) {
              let hasExamples = false;
              for (const [statusCode, response] of Object.entries(operation.responses)) {
                if (typeof response === 'object' && response.content) {
                  for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
                    if (typeof mediaTypeObj === 'object' && (mediaTypeObj.examples || mediaTypeObj.example)) {
                      hasExamples = true;
                      break;
                    }
                  }
                }
                if (hasExamples) break;
              }
              
              if (hasExamples) {
                result.stats.operationsWithExamples++;
              } else {
                result.suggestions.push(`${method.toUpperCase()} ${pathKey}: Consider adding response examples`);
              }
            }
            
            // Validate response schemas
            if (operation.responses) {
              for (const [statusCode, response] of Object.entries(operation.responses)) {
                if (typeof response === 'object' && response.content) {
                  for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
                    if (mediaType === 'application/json' && typeof mediaTypeObj === 'object') {
                      if (!mediaTypeObj.schema) {
                        result.warnings.push(`${method.toUpperCase()} ${pathKey} (${statusCode}): Missing response schema`);
                      }
                    }
                  }
                }
              }
            }
            
            // Check request body validation
            if (operation.requestBody && typeof operation.requestBody === 'object') {
              if (operation.requestBody.content?.['application/json']) {
                const jsonContent = operation.requestBody.content['application/json'];
                if (!jsonContent.schema) {
                  result.warnings.push(`${method.toUpperCase()} ${pathKey}: Missing request body schema`);
                }
              }
            }
            
            // Check parameter documentation
            if (operation.parameters) {
              for (const param of operation.parameters) {
                if (typeof param === 'object' && !param.description) {
                  result.warnings.push(`${method.toUpperCase()} ${pathKey}: Parameter '${param.name}' missing description`);
                }
              }
            }
          }
        }
      }
    } else {
      result.errors.push('No API paths defined');
      result.valid = false;
    }

    // Validate components
    if (spec.components) {
      // Check security schemes
      if (!spec.components.securitySchemes || Object.keys(spec.components.securitySchemes).length === 0) {
        result.warnings.push('No security schemes defined in components');
      }
      
      // Check reusable schemas
      if (spec.components.schemas) {
        const schemaCount = Object.keys(spec.components.schemas).length;
        if (schemaCount < 5) {
          result.suggestions.push(`Consider defining more reusable schemas (currently ${schemaCount})`);
        }
      }
      
      // Check common responses
      if (!spec.components.responses || Object.keys(spec.components.responses).length < 3) {
        result.suggestions.push('Consider defining common error responses in components');
      }
    } else {
      result.suggestions.push('Consider adding components section for reusable schemas and responses');
    }

    // Validate info section completeness
    if (spec.info) {
      if (!spec.info.contact) {
        result.suggestions.push('Consider adding contact information in API info');
      }
      if (!spec.info.license) {
        result.suggestions.push('Consider adding license information in API info');
      }
      if (!spec.info.termsOfService) {
        result.suggestions.push('Consider adding terms of service URL in API info');
      }
    }

    // Check for external documentation
    if (!spec.externalDocs) {
      result.suggestions.push('Consider adding external documentation links');
    }

    // Validate tags
    if (spec.tags && spec.tags.length > 0) {
      for (const tag of spec.tags) {
        if (!tag.description) {
          result.suggestions.push(`Tag '${tag.name}' missing description`);
        }
      }
    }

    // Set overall validity
    if (result.errors.length > 0) {
      result.valid = false;
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Validation failed: ${error}`);
  }

  return result;
}

/**
 * Calculate documentation coverage score
 */
function calculateCoverageScore(result: ValidationResult): number {
  const { stats } = result;
  
  if (stats.totalOperations === 0) return 0;
  
  const documentationScore = (stats.documentedOperations / stats.totalOperations) * 40;
  const securityScore = (stats.securedOperations / stats.totalOperations) * 30;
  const examplesScore = (stats.operationsWithExamples / stats.totalOperations) * 20;
  const completenessScore = result.errors.length === 0 ? 10 : 0;
  
  return Math.round(documentationScore + securityScore + examplesScore + completenessScore);
}

/**
 * Generate detailed validation report
 */
function generateReport(result: ValidationResult): void {
  const coverageScore = calculateCoverageScore(result);
  
  console.log('\n📊 API Documentation Validation Report');
  console.log('=' .repeat(50));
  
  // Overall status
  if (result.valid) {
    console.log('✅ Overall Status: VALID');
  } else {
    console.log('❌ Overall Status: INVALID');
  }
  
  console.log(`📈 Coverage Score: ${coverageScore}/100`);
  console.log('');
  
  // Statistics
  console.log('📋 Statistics:');
  console.log(`  • Total API Paths: ${result.stats.totalPaths}`);
  console.log(`  • Total Operations: ${result.stats.totalOperations}`);
  console.log(`  • Documented Operations: ${result.stats.documentedOperations}/${result.stats.totalOperations} (${Math.round(result.stats.documentedOperations / result.stats.totalOperations * 100)}%)`);
  console.log(`  • Secured Operations: ${result.stats.securedOperations}/${result.stats.totalOperations} (${Math.round(result.stats.securedOperations / result.stats.totalOperations * 100)}%)`);
  console.log(`  • Operations with Examples: ${result.stats.operationsWithExamples}/${result.stats.totalOperations} (${Math.round(result.stats.operationsWithExamples / result.stats.totalOperations * 100)}%)`);
  console.log('');
  
  // Errors
  if (result.errors.length > 0) {
    console.log('❌ Errors:');
    result.errors.forEach(error => console.log(`  • ${error}`));
    console.log('');
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`  • ${warning}`));
    console.log('');
  }
  
  // Suggestions
  if (result.suggestions.length > 0) {
    console.log('💡 Suggestions:');
    result.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
    console.log('');
  }
  
  // Quality assessment
  console.log('🎯 Quality Assessment:');
  if (coverageScore >= 90) {
    console.log('  Excellent! Your API documentation is comprehensive and well-structured.');
  } else if (coverageScore >= 75) {
    console.log('  Good! Consider addressing the suggestions to improve documentation quality.');
  } else if (coverageScore >= 60) {
    console.log('  Fair. There are several areas for improvement, especially in documentation completeness.');
  } else {
    console.log('  Needs improvement. Please address the errors and warnings to improve API documentation quality.');
  }
  
  console.log('');
  
  // Recommendations
  if (result.stats.documentedOperations / result.stats.totalOperations < 0.8) {
    console.log('🔧 Priority: Add descriptions and summaries to undocumented operations');
  }
  
  if (result.stats.operationsWithExamples / result.stats.totalOperations < 0.5) {
    console.log('🔧 Priority: Add response examples to improve API usability');
  }
  
  if (result.stats.securedOperations / result.stats.totalOperations < 0.7) {
    console.log('🔧 Priority: Review and add security requirements to operations');
  }
}

/**
 * Main validation function
 */
async function validateDocs(): Promise<void> {
  console.log('🔍 Validating API Documentation...\n');
  
  try {
    const result = performDetailedValidation();
    
    logger.info('API documentation validation completed', {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      suggestionCount: result.suggestions.length,
      coverageScore: calculateCoverageScore(result)
    });
    
    generateReport(result);
    
    // Exit with appropriate code
    if (!result.valid) {
      console.log('❌ Validation failed. Please fix the errors before proceeding.');
      process.exit(1);
    } else if (result.warnings.length > 0) {
      console.log('⚠️  Validation passed with warnings. Consider addressing them.');
      process.exit(0);
    } else {
      console.log('✅ Validation passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('Validation failed with exception', { error });
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
Alexandria Platform API Documentation Validator

USAGE:
  pnpm run docs:validate [OPTIONS]

OPTIONS:
  --help, -h         Show this help message

DESCRIPTION:
  Validates the OpenAPI specification for:
  • Schema compliance and structure
  • Security requirements coverage  
  • Documentation completeness
  • Response schema consistency
  • Example availability
  
  Returns exit code 0 for success, 1 for failure.

EXAMPLES:
  pnpm run docs:validate
  pnpm run docs:validate --help
`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  await validateDocs();
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}