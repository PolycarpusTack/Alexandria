/**
 * Enhanced Variable Input Component
 *
 * Advanced form input with real-time validation, AI suggestions,
 * auto-completion, and smart defaults
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VariableSchema } from '../../services/template-engine/interfaces';
import { Input } from '../../../../../client/components/ui/input';
import { Button } from '../../../../../client/components/ui/button';
import { Badge } from '../../../../../client/components/ui/badge';
import { Alert, AlertDescription } from '../../../../../client/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../../../../../client/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../../../../client/components/ui/select';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  RefreshCw,
  Copy
} from 'lucide-react';

import { clientLogger } from '@/utils/client-logger';
export interface VariableInputProps {
  variable: VariableSchema;
  value: any;
  onChange: (value: any) => void;
  aiSuggestion?: any;
  defaultValue?: any;
  onRequestSuggestion?: (variable: VariableSchema) => Promise<any>;
  validationErrors?: string[];
  disabled?: boolean;
  className?: string;
}

interface ValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface SuggestionState {
  isLoading: boolean;
  suggestions: Array<{ value: any; confidence: number; reasoning: string }>;
  error?: string;
}

export const VariableInput: React.FC<VariableInputProps> = ({
  variable,
  value,
  onChange,
  aiSuggestion,
  defaultValue,
  onRequestSuggestion,
  validationErrors = [],
  disabled = false,
  className = ''
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [validation, setValidation] = useState<ValidationState>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    isLoading: false,
    suggestions: [],
    error: undefined
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);

  // Auto-complete suggestions for common variable types
  const autoCompleteOptions = useMemo(() => {
    const varName = variable.name.toLowerCase();
    const options: string[] = [];

    if (varName.includes('name')) {
      options.push('MyComponent', 'MyProject', 'MyService', 'MyModule');
    }
    if (varName.includes('author')) {
      options.push('Your Name', 'Team Name', 'Organization');
    }
    if (varName.includes('email')) {
      options.push('your.email@example.com', 'team@company.com');
    }
    if (varName.includes('version')) {
      options.push('1.0.0', '0.1.0', '2.0.0');
    }
    if (varName.includes('license')) {
      options.push('MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause');
    }
    if (varName.includes('url')) {
      options.push('https://example.com', 'https://github.com/user/repo');
    }

    return options;
  }, [variable.name]);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Validate on value change
  useEffect(() => {
    const validationResult = validateValue(localValue);
    setValidation(validationResult);
  }, [localValue, variable]);

  // Load AI suggestions when component mounts
  useEffect(() => {
    if (onRequestSuggestion && !aiSuggestion) {
      loadAISuggestions();
    }
  }, [variable, onRequestSuggestion]);

  const validateValue = useCallback(
    (val: any): ValidationState => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Required validation
      if (variable.required && (val == null || val === '')) {
        errors.push('This field is required');
      }

      // Type-specific validation
      if (val != null && val !== '' && variable.validation) {
        const validation = variable.validation;

        // Pattern validation
        if (validation.pattern && typeof val === 'string') {
          try {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(val)) {
              errors.push('Value does not match the required pattern');
            }
          } catch (error) {
            warnings.push('Invalid validation pattern');
          }
        }

        // Length validation
        if (validation.minLength && typeof val === 'string') {
          if (val.length < validation.minLength) {
            errors.push(`Must be at least ${validation.minLength} characters`);
          }
        }

        if (validation.maxLength && typeof val === 'string') {
          if (val.length > validation.maxLength) {
            errors.push(`Must be at most ${validation.maxLength} characters`);
          }
        }

        // Number range validation
        if (variable.type === 'number') {
          const numVal = Number(val);
          if (isNaN(numVal)) {
            errors.push('Must be a valid number');
          } else {
            if (validation.min !== undefined && numVal < validation.min) {
              errors.push(`Must be at least ${validation.min}`);
            }
            if (validation.max !== undefined && numVal > validation.max) {
              errors.push(`Must be at most ${validation.max}`);
            }
          }
        }

        // Options validation
        if (validation.options && !validation.options.includes(val)) {
          errors.push(`Must be one of: ${validation.options.join(', ')}`);
        }
      }

      // Add external validation errors
      errors.push(...validationErrors);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    },
    [variable, validationErrors]
  );

  const loadAISuggestions = async () => {
    if (!onRequestSuggestion) return;

    setSuggestions((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const suggestion = await onRequestSuggestion(variable);

      if (suggestion) {
        setSuggestions({
          isLoading: false,
          suggestions: [
            {
              value: suggestion,
              confidence: 0.8,
              reasoning: 'AI-generated based on project context'
            }
          ],
          error: undefined
        });
      }
    } catch (error) {
      setSuggestions({
        isLoading: false,
        suggestions: [],
        error: 'Failed to load AI suggestions'
      });
    }
  };

  const handleInputChange = (newValue: any) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const applySuggestion = (suggestionValue: any) => {
    handleInputChange(suggestionValue);
    setShowSuggestions(false);
  };

  const applyDefault = () => {
    if (defaultValue != null) {
      handleInputChange(defaultValue);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      clientLogger.warn('Failed to copy to clipboard:', error);
    }
  };

  const renderInput = () => {
    const commonProps = {
      disabled,
      className: `${validation.errors.length > 0 ? 'border-red-500' : ''} ${
        validation.isValid && localValue ? 'border-green-500' : ''
      }`,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false)
    };

    switch (variable.type) {
      case 'boolean':
        return (
          <div className='flex items-center space-x-3'>
            <input
              type='checkbox'
              id={variable.name}
              checked={Boolean(localValue)}
              onChange={(e) => handleInputChange(e.target.checked)}
              disabled={disabled}
              className='w-4 h-4 text-blue-600 rounded focus:ring-blue-500'
            />
            <label htmlFor={variable.name} className='text-sm font-medium'>
              {variable.description || variable.name}
            </label>
          </div>
        );

      case 'select':
        if (!variable.validation?.options) {
          return (
            <Alert variant='destructive'>
              <AlertTriangle className='h-4 w-4' />
              <AlertDescription>Select variable missing options configuration</AlertDescription>
            </Alert>
          );
        }

        return (
          <Select value={localValue} onValueChange={handleInputChange} disabled={disabled}>
            <SelectTrigger className={commonProps.className}>
              <SelectValue placeholder='Select an option...' />
            </SelectTrigger>
            <SelectContent>
              {variable.validation.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'number':
        return (
          <div className='relative'>
            <Input
              type='number'
              value={localValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={variable.default ? `Default: ${variable.default}` : 'Enter a number...'}
              min={variable.validation?.min}
              max={variable.validation?.max}
              {...commonProps}
            />
          </div>
        );

      case 'array':
        return (
          <div className='space-y-2'>
            <Input
              type='text'
              value={Array.isArray(localValue) ? localValue.join(', ') : localValue}
              onChange={(e) => {
                const arrayValue = e.target.value
                  .split(',')
                  .map((item) => item.trim())
                  .filter((item) => item);
                handleInputChange(arrayValue);
              }}
              placeholder='Enter comma-separated values...'
              {...commonProps}
            />
            <p className='text-xs text-gray-500'>Separate multiple values with commas</p>
          </div>
        );

      default: // string
        return (
          <div className='relative'>
            <Input
              type='text'
              value={localValue}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={variable.default ? `Default: ${variable.default}` : 'Enter value...'}
              list={`${variable.name}-autocomplete`}
              {...commonProps}
            />

            {/* Auto-complete datalist */}
            {autoCompleteOptions.length > 0 && (
              <datalist id={`${variable.name}-autocomplete`}>
                {autoCompleteOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
        );
    }
  };

  const renderSuggestions = () => {
    if (!showSuggestions) return null;

    return (
      <Card className='mt-2 border-blue-200 bg-blue-50'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm flex items-center gap-2'>
            <Sparkles className='w-4 h-4 text-blue-500' />
            Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='space-y-2'>
            {/* AI Suggestion */}
            {aiSuggestion && (
              <div className='flex items-center justify-between p-2 bg-white rounded border'>
                <div className='flex-1'>
                  <div className='font-medium text-sm'>AI Suggestion</div>
                  <div className='text-xs text-gray-600'>{String(aiSuggestion)}</div>
                </div>
                <div className='flex gap-1'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => copyToClipboard(String(aiSuggestion))}
                  >
                    <Copy className='w-3 h-3' />
                  </Button>
                  <Button size='sm' onClick={() => applySuggestion(aiSuggestion)}>
                    Use
                  </Button>
                </div>
              </div>
            )}

            {/* Default Value */}
            {defaultValue != null && defaultValue !== localValue && (
              <div className='flex items-center justify-between p-2 bg-white rounded border'>
                <div className='flex-1'>
                  <div className='font-medium text-sm'>Default Value</div>
                  <div className='text-xs text-gray-600'>{String(defaultValue)}</div>
                </div>
                <Button size='sm' variant='outline' onClick={applyDefault}>
                  Use
                </Button>
              </div>
            )}

            {/* Auto-complete suggestions */}
            {autoCompleteOptions.slice(0, 3).map((option) => (
              <div
                key={option}
                className='flex items-center justify-between p-2 bg-white rounded border cursor-pointer hover:bg-gray-50'
                onClick={() => applySuggestion(option)}
              >
                <div className='flex-1'>
                  <div className='text-sm'>{option}</div>
                </div>
                <Button size='sm' variant='ghost'>
                  Use
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderValidationFeedback = () => {
    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      return null;
    }

    return (
      <div className='mt-2 space-y-1'>
        {validation.errors.map((error, index) => (
          <Alert key={index} variant='destructive' className='py-2'>
            <AlertTriangle className='h-3 w-3' />
            <AlertDescription className='text-xs'>{error}</AlertDescription>
          </Alert>
        ))}

        {validation.warnings.map((warning, index) => (
          <Alert key={index} className='py-2'>
            <Info className='h-3 w-3' />
            <AlertDescription className='text-xs'>{warning}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  const renderActionButtons = () => {
    const hasAI = aiSuggestion || onRequestSuggestion;
    const hasDefault = defaultValue != null;

    if (!hasAI && !hasDefault && autoCompleteOptions.length === 0) {
      return null;
    }

    return (
      <div className='flex items-center gap-2 mt-2'>
        {hasAI && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => setShowSuggestions(!showSuggestions)}
            className='flex items-center gap-1'
          >
            <Sparkles className='w-3 h-3' />
            {showSuggestions ? 'Hide' : 'Show'} Suggestions
          </Button>
        )}

        {onRequestSuggestion && (
          <Button
            size='sm'
            variant='outline'
            onClick={loadAISuggestions}
            disabled={suggestions.isLoading}
            className='flex items-center gap-1'
          >
            <RefreshCw className={`w-3 h-3 ${suggestions.isLoading ? 'animate-spin' : ''}`} />
            Refresh AI
          </Button>
        )}

        {hasDefault && defaultValue !== localValue && (
          <Button
            size='sm'
            variant='outline'
            onClick={applyDefault}
            className='flex items-center gap-1'
          >
            <Lightbulb className='w-3 h-3' />
            Use Default
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card
      className={`transition-all duration-200 ${focused ? 'ring-2 ring-blue-500 ring-opacity-20' : ''} ${className}`}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <CardTitle className='text-base flex items-center gap-2'>
              {variable.description || variable.name}
              {variable.required && (
                <Badge variant='destructive' className='text-xs'>
                  Required
                </Badge>
              )}
              {validation.isValid && localValue && (
                <CheckCircle className='w-4 h-4 text-green-500' />
              )}
            </CardTitle>
            {variable.description && variable.description !== variable.name && (
              <CardDescription className='mt-1'>Variable: {variable.name}</CardDescription>
            )}
          </div>

          <div className='flex items-center gap-1'>
            <Badge variant='outline' className='text-xs'>
              {variable.type}
            </Badge>
            {aiSuggestion && (
              <Badge variant='secondary' className='text-xs flex items-center gap-1'>
                <Sparkles className='w-3 h-3' />
                AI
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className='pt-0'>
        {renderInput()}
        {renderValidationFeedback()}
        {renderActionButtons()}
        {renderSuggestions()}

        {/* Help text */}
        {variable.validation?.pattern && (
          <div className='mt-2 p-2 bg-gray-50 rounded text-xs'>
            <div className='font-medium'>Pattern:</div>
            <code className='text-gray-600'>{variable.validation.pattern}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
