# Alexandria Platform Global Styles

This directory contains the global CSS theme for the Alexandria platform, ensuring consistent styling across all plugins and components.

## Files

- **global.css** - The main global stylesheet containing all theme variables, components, and utilities
- **globalStyles.ts** - TypeScript module for importing and applying styles programmatically

## Usage

### 1. In HTML/Static Files

Simply link to the global CSS file in your HTML:

```html
<link rel="stylesheet" href="/src/styles/global.css">
```

### 2. In React/TypeScript Components

Import the helper functions:

```typescript
import { injectAlexandriaStyles, applyPluginTheme } from '@/styles/globalStyles';

// Inject styles into the document
injectAlexandriaStyles();

// Apply plugin-specific theme
const container = document.getElementById('plugin-container');
applyPluginTheme(container, 'alfred');
```
### 3. CSS Variables

The theme uses CSS custom properties that can be accessed and modified:

```javascript
import { getThemeVariable, setThemeVariable } from '@/styles/globalStyles';

// Get a theme variable
const primaryColor = getThemeVariable('color-primary');

// Set a theme variable
setThemeVariable('color-primary', '#007bff');
```

## Available CSS Classes

### Layout Components
- `.card` - Standard card container
- `.card-header`, `.card-body`, `.card-footer` - Card sections
- `.plugin-container` - Main container for plugins

### Buttons
- `.btn` - Base button class
- `.btn-primary` - Primary action button
- `.btn-secondary` - Secondary action button
- `.btn-ghost` - Ghost/transparent button

### Typography
- `.text-primary`, `.text-secondary`, `.text-muted` - Text color utilities
- `.text-success`, `.text-warning`, `.text-danger` - Contextual text colors
### Badges
- `.badge` - Base badge class
- `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-danger` - Badge variants

### Forms
- `.form-group` - Form field container
- `.form-label` - Form labels
- `.form-control` - Form inputs
- `.search-input` - Search input styling

### Tables
- `.table-container` - Scrollable table wrapper
- Standard `table`, `th`, `td` elements are automatically styled

### Alerts
- `.alert` - Base alert class
- `.alert-info`, `.alert-success`, `.alert-warning`, `.alert-danger` - Alert variants

### Utilities
- `.d-flex`, `.d-block`, `.d-none` - Display utilities
- `.mt-1` to `.mt-5`, `.mb-1` to `.mb-5` - Margin utilities
- `.p-1` to `.p-5` - Padding utilities
- `.gap-1` to `.gap-4` - Flex gap utilities

## Theme Variables

Key CSS variables that can be customized:
```css
/* Primary Colors */
--color-primary: #3b82f6;
--color-secondary: #6366f1;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger: #ef4444;

/* Dark Theme Colors */
--color-bg-dark: #0d0d0d;
--color-surface-dark: #171717;
--color-card-dark: #1a1a1a;
--color-border-dark: #262626;

/* Plugin Colors */
--color-alfred: #38bdf8;
--color-hadron: #f43f5e;
--color-heimdall: #a78bfa;

/* Text Colors */
--text-primary: #e5e5e5;
--text-secondary: #cccccc;
--text-muted: #8b8b8b;
--text-disabled: #6b6b6b;
```

## Plugin Integration

Each plugin should apply the global styles to maintain consistency:

1. Import the global styles in your plugin's main file
2. Use the provided CSS classes and variables
3. Apply plugin-specific theme classes when needed
4. Follow the established design patterns

## Best Practices

1. Always use theme variables instead of hardcoded colors
2. Leverage utility classes before writing custom CSS
3. Maintain consistent spacing using the spacing variables
4. Use the predefined animation classes for transitions
5. Follow the dark theme aesthetic throughout your plugin

## Support

For questions or issues related to styling, please refer to the main Alexandria documentation or contact the platform team.