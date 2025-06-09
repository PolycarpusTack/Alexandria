# Hadron Plugin CSS Alignment Report

## Summary
After analyzing the Hadron plugin's CSS usage against the global CSS instructions, the plugin is **mostly compliant** with the Alexandria design system. The plugin primarily uses:
1. Tailwind CSS utility classes
2. ShadCN UI components
3. Minimal inline styles (only for dynamic values)

## Compliance Status

### ✅ **Compliant Areas**

1. **Component Library Usage**
   - Uses ShadCN UI components (`Card`, `Button`, `Input`, etc.)
   - Leverages existing component styles from global CSS
   - No custom component libraries introduced

2. **Color System**
   - Uses CSS variables defined in global.css
   - Properly supports dark mode with `dark:` prefixes
   - Uses semantic color variables (--primary-color, --text-color, etc.)

3. **Spacing and Layout**
   - Uses Tailwind spacing utilities (p-6, m-4, gap-2, etc.)
   - Follows consistent spacing patterns
   - Grid and flexbox layouts use Tailwind classes

4. **Typography**
   - Uses Tailwind text utilities (text-sm, font-medium, etc.)
   - Follows global font family settings
   - Consistent text color usage with variables

### ⚠️ **Minor Issues Found**

1. **Inline Styles**
   - Chart components use `style={{ height }}` for dynamic heights
   - Some components use inline styles for dynamic values
   - **Recommendation**: These are acceptable for dynamic values

2. **Missing Plugin-Specific Styles**
   - No Hadron-specific color defined in global CSS
   - Plugin card styling doesn't use the `.plugin-card.hadron` class
   - **Fix Required**: Add Hadron styles to match other plugins

3. **Chart Styling**
   - Chart.js components don't fully integrate with theme colors
   - Hard-coded colors in some chart configurations
   - **Fix Required**: Use CSS variables for chart colors

## Required Fixes

### 1. Add Hadron Plugin Styles to Global CSS

The global CSS already defines styles for Alfred and Heimdall plugins but Hadron uses `--hadron-color: #f43f5e;`. We need to ensure plugin cards use this styling.

### 2. Update Chart Colors to Use CSS Variables

Charts currently use hard-coded colors like `#3b82f6`. These should use CSS variables:
```typescript
// Instead of:
borderColor: '#3b82f6'

// Use:
borderColor: getComputedStyle(document.documentElement)
  .getPropertyValue('--primary-color')
```

### 3. Create Hadron-Specific Component Classes

Add these classes to components:
```tsx
// For plugin cards
<Card className="plugin-card hadron">

// For Hadron-specific badges
<Badge className="badge-hadron">
```

## Recommendations

1. **Create a theme utilities file** for consistent color access:
   ```typescript
   // src/plugins/hadron/ui/utils/theme.ts
   export const getThemeColor = (variable: string) => {
     return getComputedStyle(document.documentElement)
       .getPropertyValue(variable);
   };
   ```

2. **Use CSS Modules or styled-components** for complex component styles instead of inline styles

3. **Add Hadron-specific utility classes** to global CSS:
   ```css
   .hadron-accent {
     color: var(--hadron-color);
   }
   
   .hadron-border {
     border-color: var(--hadron-color);
   }
   ```

## Conclusion

The Hadron plugin follows the global CSS guidelines well, with only minor adjustments needed:
- Replace hard-coded colors with CSS variables
- Add plugin-specific styling classes
- Ensure all components use the established design system

No major refactoring is required. The plugin maintains consistency with the Alexandria design system.