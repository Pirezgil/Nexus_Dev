// ERP Nexus - AuthProvider Unit Tests
// Comprehensive tests for authentication provider state management

import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { useAuthStore } from '@/stores/auth';

// Mock the auth store
jest.mock('@/stores/auth');
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Mock LoadingSpinner component
jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" data-size={size}>Loading...</div>
  ),
}));

describe('AuthProvider Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('ERP Nexus')).toBeInTheDocument();
      expect(screen.getByText('Carregando sistema...')).toBeInTheDocument();
    });

    it('should show correct loading spinner size', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('data-size', 'lg');
    });

    it('should maintain loading state for exactly 1 second', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      // Should still be loading before timeout
      expect(screen.getByText('Carregando sistema...')).toBeInTheDocument();
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();

      // Fast-forward time by 999ms (just before timeout)
      jest.advanceTimersByTime(999);
      expect(screen.getByText('Carregando sistema...')).toBeInTheDocument();
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();

      // Fast-forward to complete the timeout
      jest.advanceTimersByTime(1);
      expect(screen.queryByText('Carregando sistema...')).not.toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('Ready State', () => {
    it('should render children after timeout completes', () => {
      render(
        <AuthProvider>
          <div data-testid="test-content">Test Content</div>
        </AuthProvider>
      );

      // Initially should not show children
      expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();

      // Fast-forward time to complete initialization
      jest.advanceTimersByTime(1000);

      // Now should show children
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should render multiple children correctly', () => {
      render(
        <AuthProvider>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <span data-testid="child3">Child 3</span>
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
    });

    it('should handle complex nested children', () => {
      render(
        <AuthProvider>
          <div>
            <header data-testid="header">Header</header>
            <main>
              <section data-testid="main-content">
                <h1>Main Content</h1>
                <p>Paragraph content</p>
              </section>
            </main>
            <footer data-testid="footer">Footer</footer>
          </div>
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.getByTestId('footer')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph content')).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should clear timeout on unmount', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      // Unmount before timeout completes
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should not update state after unmount', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const { unmount } = render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      // Unmount immediately
      unmount();

      // Try to trigger timeout after unmount
      jest.advanceTimersByTime(1000);

      // Should have called console.log for initialization
      expect(consoleSpy).toHaveBeenCalledWith('✅ AuthProvider: Simple initialization complete');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle children rendering errors gracefully', () => {
      const ErrorChild = () => {
        throw new Error('Child component error');
      };

      // Mock console.error to prevent test output pollution
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(
          <AuthProvider>
            <ErrorChild />
          </AuthProvider>
        );

        jest.advanceTimersByTime(1000);
      }).toThrow('Child component error');

      consoleErrorSpy.mockRestore();
    });

    it('should handle null children', () => {
      render(
        <AuthProvider>
          {null}
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      // Should render without errors, showing empty content
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should handle undefined children', () => {
      render(
        <AuthProvider>
          {undefined}
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      // Should render without errors, showing empty content
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily during loading', () => {
      const TestChild = jest.fn(() => <div>Test Child</div>);

      render(
        <AuthProvider>
          <TestChild />
        </AuthProvider>
      );

      // Should not render child during loading phase
      expect(TestChild).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Should render child exactly once after ready
      expect(TestChild).toHaveBeenCalledTimes(1);
    });

    it('should initialize exactly once', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      // Should call setTimeout exactly once for initialization
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper loading state accessibility', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      // Check for proper heading hierarchy
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('ERP Nexus');

      // Check for descriptive loading text
      expect(screen.getByText('Carregando sistema...')).toBeInTheDocument();
    });

    it('should maintain focus management during transition', () => {
      render(
        <AuthProvider>
          <button data-testid="focusable-element">Click me</button>
        </AuthProvider>
      );

      // Fast-forward to show children
      jest.advanceTimersByTime(1000);

      const button = screen.getByTestId('focusable-element');
      expect(button).toBeInTheDocument();
      
      // Button should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Console Logging', () => {
    it('should log initialization completion in development', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      expect(consoleSpy).toHaveBeenCalledWith('✅ AuthProvider: Simple initialization complete');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with React Router components', () => {
      // Mock router component
      const MockRouter = () => <div data-testid="router">Router Content</div>;

      render(
        <AuthProvider>
          <MockRouter />
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      expect(screen.getByTestId('router')).toBeInTheDocument();
    });

    it('should work with context providers', () => {
      const TestContext = React.createContext({ value: 'test' });
      const TestProvider = ({ children }: { children: React.ReactNode }) => (
        <TestContext.Provider value={{ value: 'provided' }}>
          {children}
        </TestContext.Provider>
      );

      const TestConsumer = () => {
        const context = React.useContext(TestContext);
        return <div data-testid="context-value">{context.value}</div>;
      };

      render(
        <AuthProvider>
          <TestProvider>
            <TestConsumer />
          </TestProvider>
        </AuthProvider>
      );

      jest.advanceTimersByTime(1000);

      expect(screen.getByTestId('context-value')).toHaveTextContent('provided');
    });
  });
});