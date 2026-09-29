import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('test pipeline', () => {
  it('runs plain assertions', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders with React Testing Library and jsdom', () => {
    render(<p>hello</p>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
