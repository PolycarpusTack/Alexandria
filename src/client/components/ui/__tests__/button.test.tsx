import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from '../button';

describe('Button Component', () => {
  it('renders a button with default props', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-primary-foreground');
  });

  it('applies different variants correctly', () => {
    const { rerender } = render(<Button variant='destructive'>Destructive</Button>);

    let button = screen.getByRole('button', { name: /destructive/i });
    expect(button).toHaveClass('bg-destructive');
    expect(button).toHaveClass('text-destructive-foreground');

    rerender(<Button variant='outline'>Outline</Button>);
    button = screen.getByRole('button', { name: /outline/i });
    expect(button).toHaveClass('border-input');
    expect(button).toHaveClass('bg-background');

    rerender(<Button variant='secondary'>Secondary</Button>);
    button = screen.getByRole('button', { name: /secondary/i });
    expect(button).toHaveClass('bg-secondary');
    expect(button).toHaveClass('text-secondary-foreground');

    rerender(<Button variant='ghost'>Ghost</Button>);
    button = screen.getByRole('button', { name: /ghost/i });
    expect(button).toHaveClass('hover:bg-accent');

    rerender(<Button variant='link'>Link</Button>);
    button = screen.getByRole('button', { name: /link/i });
    expect(button).toHaveClass('text-primary');
    expect(button).toHaveClass('hover:underline');
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Button size='default'>Default</Button>);

    let button = screen.getByRole('button', { name: /default/i });
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('px-4');
    expect(button).toHaveClass('py-2');

    rerender(<Button size='sm'>Small</Button>);
    button = screen.getByRole('button', { name: /small/i });
    expect(button).toHaveClass('h-9');
    expect(button).toHaveClass('px-3');

    rerender(<Button size='lg'>Large</Button>);
    button = screen.getByRole('button', { name: /large/i });
    expect(button).toHaveClass('h-11');
    expect(button).toHaveClass('px-8');

    rerender(<Button size='icon'>Icon</Button>);
    button = screen.getByRole('button', { name: /icon/i });
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('w-10');
  });

  it('accepts and applies additional className', () => {
    render(<Button className='extra-class'>With Class</Button>);

    const button = screen.getByRole('button', { name: /with class/i });
    expect(button).toHaveClass('extra-class');
    expect(button).toHaveClass('bg-primary'); // Still has default classes
  });

  it('renders as a child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href='/'>Link Button</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveClass('bg-primary'); // Button styles applied to link
  });

  it('passes button HTML attributes to the rendered element', async () => {
    const handleClick = jest.fn();

    render(
      <Button onClick={handleClick} disabled={false} type='submit' aria-label='Submit Form'>
        Submit
      </Button>
    );

    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-label', 'Submit Form');
    expect(button).not.toBeDisabled();

    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('handles disabled state correctly', async () => {
    const handleClick = jest.fn();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');

    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  describe('buttonVariants', () => {
    it('generates correct class names based on variants', () => {
      const classes = buttonVariants({ variant: 'destructive', size: 'lg' });

      expect(classes).toContain('bg-destructive');
      expect(classes).toContain('text-destructive-foreground');
      expect(classes).toContain('h-11');
      expect(classes).toContain('px-8');
    });

    it('applies default variants when none specified', () => {
      const classes = buttonVariants({});

      expect(classes).toContain('bg-primary');
      expect(classes).toContain('h-10');
      expect(classes).toContain('px-4');
    });

    it('merges with additional class names', () => {
      const classes = buttonVariants({ className: 'my-custom-class' });

      expect(classes).toContain('my-custom-class');
      expect(classes).toContain('bg-primary'); // Still has default classes
    });
  });
});
