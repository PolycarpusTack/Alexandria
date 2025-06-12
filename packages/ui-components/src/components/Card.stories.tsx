import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Button } from './Button';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible container component for grouping related content. Includes sub-components for header, title, description, content, and footer.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outline', 'ghost', 'filled'],
      description: 'The visual style variant of the card',
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'default', 'lg'],
      description: 'The padding size of the card',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as a child component (for composition)',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'default',
    padding: 'default',
    children: 'This is a default card with some content.',
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'This card has an elevated shadow effect.',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'This card has a thicker outline border.',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'This card has minimal styling (ghost variant).',
  },
};

export const Filled: Story = {
  args: {
    variant: 'filled',
    children: 'This card has a filled background.',
  },
};

export const WithHeaderAndFooter: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>
          This is a card description that explains what the card contains.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here. This could be any type of content like text, images, forms, or other components.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A complete card example with header, title, description, content, and footer.',
      },
    },
  },
};

export const PaddingVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <Card padding="none" variant="outline">
        <div className="p-2 bg-blue-50 text-blue-800 text-sm">No padding</div>
      </Card>
      <Card padding="sm" variant="outline">
        <div className="bg-blue-50 text-blue-800 text-sm">Small padding</div>
      </Card>
      <Card padding="default" variant="outline">
        <div className="bg-blue-50 text-blue-800 text-sm">Default padding</div>
      </Card>
      <Card padding="lg" variant="outline">
        <div className="bg-blue-50 text-blue-800 text-sm">Large padding</div>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different padding variants of the card component.',
      },
    },
  },
};

export const InteractiveCard: Story = {
  render: () => (
    <Card className="w-96 cursor-pointer transition-all hover:shadow-lg hover:scale-105">
      <CardHeader>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>
          This card responds to hover interactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Hover over this card to see the interactive effects. This demonstrates how cards can be used as clickable elements.</p>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'An interactive card that responds to hover effects.',
      },
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
      <Card variant="default">
        <CardHeader>
          <CardTitle>Default</CardTitle>
        </CardHeader>
        <CardContent>Default card variant</CardContent>
      </Card>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Elevated</CardTitle>
        </CardHeader>
        <CardContent>Elevated card variant</CardContent>
      </Card>
      <Card variant="outline">
        <CardHeader>
          <CardTitle>Outline</CardTitle>
        </CardHeader>
        <CardContent>Outline card variant</CardContent>
      </Card>
      <Card variant="ghost">
        <CardHeader>
          <CardTitle>Ghost</CardTitle>
        </CardHeader>
        <CardContent>Ghost card variant</CardContent>
      </Card>
      <Card variant="filled">
        <CardHeader>
          <CardTitle>Filled</CardTitle>
        </CardHeader>
        <CardContent>Filled card variant</CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All card variants displayed together for comparison.',
      },
    },
  },
};