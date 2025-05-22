import React from 'react';
import { render, screen } from '@testing-library/react';
import { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '../card';

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with default styles', () => {
      render(<Card data-testid="card">Card Content</Card>);
      
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('Card Content');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-card');
      expect(card).toHaveClass('text-card-foreground');
      expect(card).toHaveClass('shadow-sm');
    });

    it('accepts and applies additional className', () => {
      render(<Card className="extra-class" data-testid="card">Card Content</Card>);
      
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('extra-class');
      expect(card).toHaveClass('rounded-lg'); // Still has default classes
    });

    it('forwards additional props to the div element', () => {
      render(
        <Card 
          data-testid="card"
          aria-label="Card Example"
          tabIndex={0}
        >
          Card Content
        </Card>
      );
      
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('aria-label', 'Card Example');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });

  describe('CardHeader', () => {
    it('renders with default styles', () => {
      render(<CardHeader data-testid="card-header">Header Content</CardHeader>);
      
      const header = screen.getByTestId('card-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Header Content');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('flex-col');
      expect(header).toHaveClass('space-y-1.5');
      expect(header).toHaveClass('p-6');
    });

    it('accepts and applies additional className', () => {
      render(<CardHeader className="extra-class" data-testid="card-header">Header Content</CardHeader>);
      
      const header = screen.getByTestId('card-header');
      expect(header).toHaveClass('extra-class');
      expect(header).toHaveClass('p-6'); // Still has default classes
    });
  });

  describe('CardTitle', () => {
    it('renders as an h3 with default styles', () => {
      render(<CardTitle data-testid="card-title">Card Title</CardTitle>);
      
      const title = screen.getByTestId('card-title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Card Title');
      expect(title.tagName).toBe('H3');
      expect(title).toHaveClass('text-2xl');
      expect(title).toHaveClass('font-semibold');
      expect(title).toHaveClass('leading-none');
      expect(title).toHaveClass('tracking-tight');
    });

    it('accepts and applies additional className', () => {
      render(<CardTitle className="extra-class" data-testid="card-title">Card Title</CardTitle>);
      
      const title = screen.getByTestId('card-title');
      expect(title).toHaveClass('extra-class');
      expect(title).toHaveClass('text-2xl'); // Still has default classes
    });
  });

  describe('CardDescription', () => {
    it('renders as a paragraph with default styles', () => {
      render(<CardDescription data-testid="card-desc">Card Description</CardDescription>);
      
      const desc = screen.getByTestId('card-desc');
      expect(desc).toBeInTheDocument();
      expect(desc).toHaveTextContent('Card Description');
      expect(desc.tagName).toBe('P');
      expect(desc).toHaveClass('text-sm');
      expect(desc).toHaveClass('text-muted-foreground');
    });

    it('accepts and applies additional className', () => {
      render(<CardDescription className="extra-class" data-testid="card-desc">Card Description</CardDescription>);
      
      const desc = screen.getByTestId('card-desc');
      expect(desc).toHaveClass('extra-class');
      expect(desc).toHaveClass('text-sm'); // Still has default classes
    });
  });

  describe('CardContent', () => {
    it('renders with default styles', () => {
      render(<CardContent data-testid="card-content">Content</CardContent>);
      
      const content = screen.getByTestId('card-content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('Content');
      expect(content).toHaveClass('p-6');
      expect(content).toHaveClass('pt-0');
    });

    it('accepts and applies additional className', () => {
      render(<CardContent className="extra-class" data-testid="card-content">Content</CardContent>);
      
      const content = screen.getByTestId('card-content');
      expect(content).toHaveClass('extra-class');
      expect(content).toHaveClass('p-6'); // Still has default classes
    });
  });

  describe('CardFooter', () => {
    it('renders with default styles', () => {
      render(<CardFooter data-testid="card-footer">Footer Content</CardFooter>);
      
      const footer = screen.getByTestId('card-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('Footer Content');
      expect(footer).toHaveClass('flex');
      expect(footer).toHaveClass('items-center');
      expect(footer).toHaveClass('p-6');
      expect(footer).toHaveClass('pt-0');
    });

    it('accepts and applies additional className', () => {
      render(<CardFooter className="extra-class" data-testid="card-footer">Footer Content</CardFooter>);
      
      const footer = screen.getByTestId('card-footer');
      expect(footer).toHaveClass('extra-class');
      expect(footer).toHaveClass('flex'); // Still has default classes
    });
  });

  it('all components work together to create a complete card', () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>Card Content</CardContent>
        <CardFooter>Card Footer</CardFooter>
      </Card>
    );
    
    const card = screen.getByTestId('full-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('Card Title');
    expect(card).toHaveTextContent('Card Description');
    expect(card).toHaveTextContent('Card Content');
    expect(card).toHaveTextContent('Card Footer');
    
    // Check structure
    expect(card.children[0]).toHaveClass('flex flex-col space-y-1.5 p-6'); // CardHeader
    expect(card.children[0].children[0]).toHaveClass('text-2xl font-semibold'); // CardTitle
    expect(card.children[0].children[1]).toHaveClass('text-sm text-muted-foreground'); // CardDescription
    expect(card.children[1]).toHaveClass('p-6 pt-0'); // CardContent
    expect(card.children[2]).toHaveClass('flex items-center p-6 pt-0'); // CardFooter
  });
});