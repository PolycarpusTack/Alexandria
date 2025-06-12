import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card';

expect.extend(toHaveNoViolations);

describe('Card Component', () => {
  describe('Rendering', () => {
    it('renders basic card with content', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with different variants', () => {
      const variants = ['default', 'elevated', 'outline', 'ghost', 'filled'] as const;
      
      variants.forEach((variant) => {
        const { rerender } = render(<Card variant={variant}>Test {variant}</Card>);
        const card = screen.getByText(`Test ${variant}`).parentElement;
        expect(card).toHaveAttribute('class');
        rerender(<div />);
      });
    });

    it('renders with different padding options', () => {
      const paddings = ['none', 'sm', 'default', 'lg'] as const;
      
      paddings.forEach((padding) => {
        const { rerender } = render(<Card padding={padding}>Test {padding}</Card>);
        const card = screen.getByText(`Test ${padding}`).parentElement;
        expect(card).toHaveAttribute('class');
        rerender(<div />);
      });
    });

    it('applies custom className', () => {
      render(<Card className="custom-class">Test</Card>);
      const card = screen.getByText('Test').parentElement;
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('Sub-components', () => {
    it('renders CardHeader correctly', () => {
      render(
        <Card>
          <CardHeader>Header content</CardHeader>
        </Card>
      );
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('renders CardTitle with proper heading semantics', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
          </CardHeader>
        </Card>
      );
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent('Test Title');
    });

    it('renders CardDescription with proper text styling', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>Test description</CardDescription>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description</CardDescription>
          </CardHeader>
          <CardContent>Card content</CardContent>
          <CardFooter>Card footer</CardFooter>
        </Card>
      );

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Card Title');
      expect(screen.getByText('Card description')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
      expect(screen.getByText('Card footer')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Accessible Card</CardTitle>
            <CardDescription>This card is accessible</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content with proper semantic structure</p>
          </CardContent>
        </Card>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains heading hierarchy', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Main Title</CardTitle>
          </CardHeader>
          <CardContent>
            <h4>Subsection</h4>
            <p>Content under subsection</p>
          </CardContent>
        </Card>
      );

      const mainHeading = screen.getByRole('heading', { level: 3 });
      const subHeading = screen.getByRole('heading', { level: 4 });
      
      expect(mainHeading).toHaveTextContent('Main Title');
      expect(subHeading).toHaveTextContent('Subsection');
    });

    it('supports ARIA attributes', () => {
      render(
        <Card role="region" aria-labelledby="card-title">
          <CardHeader>
            <CardTitle id="card-title">Labeled Card</CardTitle>
          </CardHeader>
          <CardContent>Card content</CardContent>
        </Card>
      );

      const card = screen.getByRole('region');
      expect(card).toHaveAttribute('aria-labelledby', 'card-title');
    });
  });

  describe('Polymorphic behavior', () => {
    it('renders as different elements when asChild is true', () => {
      render(
        <Card asChild>
          <article>Article card</article>
        </Card>
      );
      
      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
      expect(article).toHaveTextContent('Article card');
    });
  });

  describe('Visual regression tests', () => {
    it('matches snapshot for default card', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
            <CardDescription>Test description</CardDescription>
          </CardHeader>
          <CardContent>Test content</CardContent>
          <CardFooter>Test footer</CardFooter>
        </Card>
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for all variants', () => {
      const variants = ['default', 'elevated', 'outline', 'ghost', 'filled'] as const;
      
      variants.forEach((variant) => {
        const { container } = render(
          <Card variant={variant}>
            <CardContent>Test {variant}</CardContent>
          </Card>
        );
        expect(container.firstChild).toMatchSnapshot(`card-${variant}`);
      });
    });
  });
});