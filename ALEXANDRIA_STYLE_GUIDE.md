# Alexandria Platform Style Guide

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Plugin Development Guidelines](#plugin-development-guidelines)
7. [Code Examples](#code-examples)
8. [Accessibility](#accessibility)
9. [Dark Mode](#dark-mode)
10. [Best Practices](#best-practices)

---

## Design Philosophy

Alexandria follows a **modern, clean, and consistent** design language inspired by VS Code and other professional development tools. The key principles are:

- **Clarity**: Every element should have a clear purpose
- **Consistency**: Similar elements behave similarly across all plugins
- **Efficiency**: Minimize cognitive load and maximize productivity
- **Accessibility**: Usable by everyone, regardless of abilities
- **Modularity**: Components can be mixed and matched easily

---

## Color System

### Primary Colors
```css
/* Use for primary actions, links, and focus states */
--alexandria-primary: #3b82f6;
--alexandria-primary-hover: #2563eb;
--alexandria-primary-active: #1d4ed8;
```

### Status Colors
```css
/* Success - Use for positive feedback, completed states */
--alexandria-success: #10b981;

/* Warning - Use for caution states, non-critical alerts */
--alexandria-warning: #f59e0b;

/* Error - Use for errors, destructive actions */
--alexandria-error: #ef4444;

/* Info - Use for informational messages */
--alexandria-info: #3b82f6;
```

### Neutral Colors
```css
/* Text hierarchy */
--alexandria-text-primary: #111827;    /* Main content */
--alexandria-text-secondary: #6b7280;  /* Supporting text */
--alexandria-text-tertiary: #9ca3af;   /* De-emphasized text */

/* Backgrounds */
--alexandria-bg-primary: #ffffff;      /* Main background */
--alexandria-bg-secondary: #f9fafb;    /* Sidebar, secondary areas */
--alexandria-bg-tertiary: #f3f4f6;     /* Hover states, wells */
```

### Usage Guidelines
- **Primary colors** for CTAs and important interactive elements
- **Status colors** for feedback and system states
- **Neutral colors** for content and UI structure
- Always ensure **4.5:1 contrast ratio** for text

---

## Typography

### Font Stack
```css
/* System fonts for performance and native feel */
--alexandria-font-sans: system-ui, -apple-system, BlinkMacSystemFont, 
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Monospace for code */
--alexandria-font-mono: 'SF Mono', Monaco, 'Cascadia Code', 
  'Roboto Mono', Consolas, 'Courier New', monospace;
```

### Font Sizes
```css
--alexandria-text-xs: 0.75rem;    /* 12px - Labels, badges */
--alexandria-text-sm: 0.875rem;   /* 14px - Body text, buttons */
--alexandria-text-base: 1rem;     /* 16px - Default */
--alexandria-text-lg: 1.125rem;   /* 18px - Headings */
--alexandria-text-xl: 1.25rem;    /* 20px - Page titles */
--alexandria-text-2xl: 1.5rem;    /* 24px - Main headings */
```

### Font Weights
```css
--alexandria-font-normal: 400;    /* Body text */
--alexandria-font-medium: 500;    /* Emphasized text */
--alexandria-font-semibold: 600; /* Headings */
--alexandria-font-bold: 700;      /* Strong emphasis */
```

### Usage
- **Headings**: Use semibold weight with larger sizes
- **Body text**: Normal weight at sm or base size
- **Labels**: Small size with medium weight
- **Code**: Always use mono font family

---

## Spacing & Layout

### Spacing Scale
```css
--alexandria-space-xs: 0.25rem;   /* 4px */
--alexandria-space-sm: 0.5rem;    /* 8px */
--alexandria-space-md: 1rem;      /* 16px */
--alexandria-space-lg: 1.5rem;    /* 24px */
--alexandria-space-xl: 2rem;      /* 32px */
--alexandria-space-2xl: 3rem;     /* 48px */
```

### Layout Structure
```
┌─────────────────────────────────────────────┐
│ Title Bar (32px)                            │
├─────┬───────────────┬───────────────────────┤
│     │               │                       │
│  A  │   Sidebar     │    Content Area      │
│  c  │   (260px)     │    (flexible)        │
│  t  │               │                       │
│  i  │               │                       │
│  v  │               │                       │
│  i  │               │                       │
│  t  │               │                       │
│  y  │               │                       │
│     │               │                       │
│(48) │               │                       │
└─────┴───────────────┴───────────────────────┘
```

---

## Components

### Buttons

#### Primary Button
```html
<button class="alexandria-btn alexandria-btn-primary">
  Save Changes
</button>
```

#### Secondary Button
```html
<button class="alexandria-btn alexandria-btn-secondary">
  Cancel
</button>
```

#### Ghost Button
```html
<button class="alexandria-btn alexandria-btn-ghost">
  <svg>...</svg>
  Options
</button>
```

### Cards
```html
<div class="alexandria-card">
  <div class="alexandria-card-header">
    <h3 class="alexandria-text-lg alexandria-font-semibold">
      Card Title
    </h3>
  </div>
  <div class="alexandria-card-content">
    <!-- Content -->
  </div>
</div>
```

### Forms
```html
<div class="alexandria-form-group">
  <label class="alexandria-label">Username</label>
  <input type="text" class="alexandria-input" placeholder="Enter username">
</div>
```

### Navigation
```html
<nav class="alexandria-nav-section">
  <div class="alexandria-nav-section-title">NAVIGATION</div>
  <div class="alexandria-nav-item active">
    <svg>...</svg>
    <span>Dashboard</span>
  </div>
  <div class="alexandria-nav-item">
    <svg>...</svg>
    <span>Settings</span>
  </div>
</nav>
```

---

## Plugin Development Guidelines

### 1. File Structure
```
your-plugin/
├── ui/
│   ├── components/
│   │   ├── YourPluginEnhancedLayout.tsx
│   │   ├── Dashboard.tsx
│   │   └── ...
│   ├── styles/
│   │   └── plugin-specific.css (if needed)
│   └── index.ts
└── plugin.json
```

### 2. Enhanced Layout Template
```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { /* your icons */ } from 'lucide-react';
import '../../../../client/styles/enhanced-mockup-layout.css';

interface YourPluginEnhancedLayoutProps {
  children: React.ReactNode;
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export function YourPluginEnhancedLayout({ 
  children, 
  activeView = 'dashboard', 
  onViewChange 
}: YourPluginEnhancedLayoutProps) {
  // Implementation following the pattern in HadronEnhancedLayout.tsx
}
```

### 3. Using Global Classes
Always prefix global classes with `alexandria-`:
```html
<!-- Good -->
<button class="alexandria-btn alexandria-btn-primary">Click me</button>

<!-- Bad -->
<button class="btn btn-primary">Click me</button>
```

### 4. Custom Styling
If you need plugin-specific styles:
```css
/* Use CSS custom properties */
.your-plugin-special {
  background: var(--alexandria-primary-light);
  padding: var(--alexandria-space-md);
  border-radius: var(--alexandria-radius-lg);
}

/* Scope your styles */
.your-plugin-container .special-element {
  /* styles */
}
```

---

## Code Examples

### Basic Plugin Dashboard
```tsx
import React from 'react';
import { YourPluginEnhancedLayout } from './YourPluginEnhancedLayout';

export function YourPluginDashboard() {
  return (
    <YourPluginEnhancedLayout activeView="dashboard">
      <div className="alexandria-p-lg">
        <div className="alexandria-content-header">
          <h1 className="alexandria-text-2xl alexandria-font-semibold">
            Your Plugin Name
          </h1>
          <p className="alexandria-text-secondary alexandria-text-sm">
            Plugin description
          </p>
        </div>
        
        <div className="alexandria-grid alexandria-grid-cols-3 alexandria-gap-md alexandria-m-lg">
          <div className="alexandria-card">
            <div className="alexandria-card-content">
              <div className="alexandria-stat-item">
                <span className="alexandria-stat-label">Total Items</span>
                <span className="alexandria-stat-value">1,234</span>
              </div>
            </div>
          </div>
          {/* More cards */}
        </div>
      </div>
    </YourPluginEnhancedLayout>
  );
}
```

### Activity Bar Items
```tsx
const navigationItems = [
  { id: 'dashboard', icon: <Home size={16} />, label: 'Dashboard' },
  { id: 'analytics', icon: <BarChart3 size={16} />, label: 'Analytics' },
  { id: 'settings', icon: <Settings size={16} />, label: 'Settings' },
];
```

---

## Accessibility

### Requirements
1. **Keyboard Navigation**: All interactive elements must be keyboard accessible
2. **ARIA Labels**: Use proper ARIA labels for screen readers
3. **Focus Indicators**: Clear focus states (use the primary color)
4. **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text

### Example
```html
<button 
  class="alexandria-btn alexandria-btn-primary"
  aria-label="Save document"
  aria-pressed="false"
>
  <svg aria-hidden="true">...</svg>
  Save
</button>
```

---

## Dark Mode

### Implementation
All colors should adapt automatically when `[data-theme="dark"]` is set:

```css
/* Light mode (default) */
.my-element {
  background: var(--alexandria-bg-primary);
  color: var(--alexandria-text-primary);
}

/* Dark mode is handled automatically by the CSS variables */
```

### Testing
Always test your plugin in both light and dark modes:
```javascript
// Toggle theme for testing
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-theme', 'light');
```

---

## Best Practices

### Do's ✅
- Use the global CSS variables for consistency
- Follow the established component patterns
- Test in both light and dark modes
- Keep activity bar items to 5-7 maximum
- Use icons from Lucide React for consistency
- Implement loading and error states
- Add hover and focus states to all interactive elements

### Don'ts ❌
- Don't override global styles without good reason
- Don't use inline styles except for dynamic values
- Don't create custom color schemes
- Don't use fixed pixel values for responsive layouts
- Don't forget error handling in UI components
- Don't skip accessibility requirements

### Performance Tips
1. Use CSS classes instead of inline styles
2. Lazy load heavy components
3. Virtualize long lists
4. Debounce search inputs
5. Use React.memo for expensive components

---

## Quick Reference

### Essential Classes
```css
/* Layout */
.alexandria-enhanced-layout
.alexandria-activity-bar
.alexandria-sidebar
.alexandria-content-area

/* Components */
.alexandria-btn
.alexandria-card
.alexandria-input
.alexandria-badge

/* Utilities */
.alexandria-text-{size}
.alexandria-font-{weight}
.alexandria-m-{size}
.alexandria-p-{size}
```

### Color Usage
- **Primary**: Actions, links, focus states
- **Success**: Positive feedback, online status
- **Warning**: Caution, pending states
- **Error**: Errors, offline status, destructive actions
- **Neutral**: UI structure, content

### Icon Sizes
- Activity bar: 20px
- Sidebar navigation: 16px
- Inline with text: 14-16px
- Large feature icons: 24-32px

---

## Getting Started Checklist

When creating a new plugin:

- [ ] Create enhanced layout wrapper component
- [ ] Use alexandria- prefixed classes
- [ ] Import global CSS or enhanced-mockup-layout.css
- [ ] Follow the activity bar pattern (5-7 items max)
- [ ] Include proper navigation in sidebar
- [ ] Add quick stats or status indicators
- [ ] Implement quick access modal (⌘K)
- [ ] Test in both light and dark modes
- [ ] Ensure keyboard navigation works
- [ ] Add loading and error states
- [ ] Document any custom styling needs

---

## Questions?

For questions about the style guide or design system:
1. Check existing plugins (Alfred, Hadron, Heimdall) for examples
2. Refer to the global CSS file for available utilities
3. Follow the established patterns for consistency

Remember: **Consistency is key**. When in doubt, follow what existing plugins do.