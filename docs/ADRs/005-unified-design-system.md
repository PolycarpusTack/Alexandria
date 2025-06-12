# ADR-005: Unified Design System

## Status
**Accepted** - 2025-01-11

## Context

The Alexandria Platform had multiple conflicting CSS approaches:
- Multiple CSS files with competing design tokens
- Inconsistent theme implementations (Tailwind, custom CSS, ShadCN)
- Conflicting color systems and class naming
- Fragmented dark mode implementations
- No single source of truth for design decisions

This created:
- Inconsistent user experience across plugins
- Difficult maintenance and debugging
- Duplication of design code
- Problems with theme switching
- Conflicts between different styling approaches

## Decision

We will implement a **unified design system** based on:

### Foundation: Design Tokens
- **Single source**: `src/styles/tokens.css`
- **HSL color system**: Consistent with CSS custom properties
- **Semantic naming**: `--primary`, `--background`, `--foreground`
- **Theme support**: Light, dark, and system preference detection

### Architecture: Layered Approach
```css
src/styles/
├── tokens.css          # Design tokens (colors, spacing, typography)
├── base.css           # Foundation styles and resets
└── components.css     # Component-specific styles (in global.css)
```

### Technology Stack
- **Tailwind CSS**: Utility-first framework configured with design tokens
- **CSS Custom Properties**: For dynamic theming
- **PostCSS**: For processing and optimization
- **ShadCN UI**: Component library aligned with design system

### Design Token Structure
```css
:root {
  /* Color System */
  --color-primary-50: 239 246 255;
  --color-primary-500: 59 130 246;
  --color-primary-900: 30 58 138;
  
  /* Semantic Mappings */
  --background: var(--color-neutral-50);
  --foreground: var(--color-neutral-900);
  --primary: var(--color-primary-500);
  
  /* Component Tokens */
  --sidebar-width: 240px;
  --header-height: 48px;
  --radius: 0.375rem;
}

[data-theme="dark"] {
  --background: var(--color-neutral-950);
  --foreground: var(--color-neutral-50);
  --primary: var(--color-primary-400);
}
```

### Theme System
- **Data attribute approach**: `[data-theme="dark"]`
- **System preference**: Automatic detection via CSS media queries
- **Smooth transitions**: CSS transitions for theme changes
- **Plugin consistency**: Shared theme tokens across all plugins

### Component Naming Convention
- **Prefix system**: `.alexandria-` for platform components
- **BEM methodology**: `.alexandria-card--elevated`
- **Utility classes**: Tailwind utilities for common patterns
- **Legacy support**: Gradual migration with backward compatibility

## Consequences

### Positive
- **Consistency**: Single source of truth for all design decisions
- **Maintainability**: Centralized design token management
- **Theme Support**: Robust light/dark mode implementation
- **Performance**: Optimized CSS with minimal conflicts
- **Developer Experience**: Clear patterns and utilities
- **Plugin Consistency**: Shared design language across all plugins

### Negative
- **Migration Effort**: Existing components need updates
- **Learning Curve**: Team needs to learn new patterns
- **Bundle Size**: Initial increase due to comprehensive token system
- **Breaking Changes**: Some existing styles may need updates

### Mitigation Strategies
- Legacy class support during transition period
- Comprehensive documentation and examples
- Gradual migration strategy
- Component library with pre-built patterns

## Implementation Details

### Tailwind Configuration
```javascript
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          50: 'hsl(var(--color-primary-50))',
          500: 'hsl(var(--color-primary-500))',
          900: 'hsl(var(--color-primary-900))',
        }
      },
      spacing: {
        'sidebar': 'var(--sidebar-width)',
        'header': 'var(--header-height)',
      }
    }
  }
};
```

### Theme Provider
```typescript
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);
  
  return <>{children}</>;
}
```

### Component Classes
```css
.alexandria-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: var(--card-padding);
  box-shadow: var(--shadow-sm);
}
```

## Migration Strategy

### Phase 1: Foundation (Completed)
- ✅ Create unified design tokens
- ✅ Update Tailwind configuration
- ✅ Implement theme system
- ✅ Create base component classes

### Phase 2: Component Migration (In Progress)
- Update existing components to use new tokens
- Create component library documentation
- Implement legacy class support
- Test theme switching across all components

### Phase 3: Optimization (Future)
- Remove legacy CSS files
- Optimize bundle size
- Add design system documentation
- Create component usage analytics

## Implementation Status

- ✅ Design token system created
- ✅ Tailwind configuration updated
- ✅ Theme provider implemented
- ✅ Base component classes defined
- ✅ PostCSS configuration updated
- ✅ Legacy support maintained
- ⏳ Component migration ongoing
- ⏳ Documentation creation

## Related Decisions
- [ADR-001: Microkernel Plugin Architecture](./001-microkernel-plugin-architecture.md)
- [ADR-004: Shared Component Library](./004-shared-component-library.md)
- [ADR-007: Build Process Standardization](./007-build-process-standardization.md)