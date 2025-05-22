/**
 * styled-components theme type declaration file
 * 
 * This file extends the DefaultTheme interface from styled-components
 * to include the UITheme properties from our application's theme system.
 * This allows TypeScript to provide proper type checking and IntelliSense
 * when using theme properties in styled-components.
 */

import 'styled-components';
import { UITheme } from './ui/interfaces';

declare module 'styled-components' {
  export interface DefaultTheme extends UITheme {
    // The UITheme interface already contains all the properties needed
    // No additional properties required as UITheme has:
    // - colors
    // - spacing
    // - typography
    // - borderRadius
    // - shadows
    // - transitions
    // - zIndex
  }
}