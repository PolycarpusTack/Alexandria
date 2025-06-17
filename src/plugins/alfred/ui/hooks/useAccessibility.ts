import { useEffect } from 'react';

export function useAccessibility() {
    useEffect(() => {
        // Set up keyboard navigation
        const handleKeyDown = (e: KeyboardEvent) => {
            // Handle escape key
            if (e.key === 'Escape') {
                const activeElement = document.activeElement as HTMLElement;
                if (activeElement) {
                    activeElement.blur();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Ensure proper ARIA labels
        const ensureAccessibility = () => {
            // Add ARIA labels to interactive elements without them
            const interactiveElements = document.querySelectorAll(
                'button:not([aria-label]), a:not([aria-label]), input:not([aria-label])'
            );
            
            interactiveElements.forEach((element) => {
                const text = element.textContent?.trim();
                if (text && !element.getAttribute('aria-label')) {
                    element.setAttribute('aria-label', text);
                }
            });
        };

        ensureAccessibility();

        // Set up mutation observer to handle dynamic content
        const observer = new MutationObserver(ensureAccessibility);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            observer.disconnect();
        };
    }, []);

    return {
        announceToScreenReader: (message: string) => {
            const announcement = document.createElement('div');
            announcement.setAttribute('role', 'status');
            announcement.setAttribute('aria-live', 'polite');
            announcement.textContent = message;
            announcement.style.position = 'absolute';
            announcement.style.left = '-9999px';
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
    };
}

export default useAccessibility;
