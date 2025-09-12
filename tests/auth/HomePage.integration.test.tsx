// ERP Nexus - HomePage Integration Tests
// Tests for HomePage authentication state handling and redirection logic

import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import HomePage from '@/app/page';
import { useAuthStore } from '@/stores/auth';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth store
jest.mock('@/stores/auth', () => ({
  useAuthStore: jest.fn(),
}));

// Mock LoadingSpinner component
jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" data-size={size}>Loading...</div>
  ),
}));

const mockRouter = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('HomePage Authentication Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);

    // Clear storage before each test
    localStorage.clear();
    sessionStorage.clear();

    // Mock console.log to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization States', () => {
    it('should show loading state when not initialized', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Inicializando sistema...')).toBeInTheDocument();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should show loading state when still loading', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'loading',
        isAuthenticated: false,
        isInitialized: true,
        isLoading: true,
      });

      render(<HomePage />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Inicializando sistema...')).toBeInTheDocument();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should show redirection message when ready to redirect', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'unauthenticated',
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Redirecionando...')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated User Redirection', () => {
    it('should redirect unauthenticated users to login', async () => {
      mockUseAuthStore.mockReturnValue({
        status: 'unauthenticated',
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
      });

      expect(console.log).toHaveBeenCalledWith(
        '❌ HomePage: Usuário não autenticado, redirecionando para login'
      );
    });

    it('should not redirect if not initialized', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '⏳ HomePage: Aguardando inicialização da autenticação...'
      );
    });

    it('should not redirect if still loading', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'loading',
        isAuthenticated: false,
        isInitialized: true,
        isLoading: true,
      });

      render(<HomePage />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '⏳ HomePage: Autenticação ainda carregando...'
      );
    });
  });

  describe('Authenticated User Redirection', () => {
    it('should redirect authenticated users to dashboard', async () => {
      mockUseAuthStore.mockReturnValue({
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
      });

      expect(console.log).toHaveBeenCalledWith(
        '✅ HomePage: Usuário autenticado, redirecionando para dashboard'
      );
    });

    it('should not redirect authenticated users if status is not authenticated', () => {
      // Edge case: isAuthenticated is true but status is not 'authenticated'
      mockUseAuthStore.mockReturnValue({
        status: 'loading',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should handle mixed authentication state gracefully', () => {
      // Edge case: authenticated but status is unauthenticated
      mockUseAuthStore.mockReturnValue({
        status: 'unauthenticated',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      // Should prioritize status over isAuthenticated flag
      expect(mockRouter.replace).not.toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Status Logging', () => {
    it('should log auth status when determined', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      render(<HomePage />);

      expect(console.log).toHaveBeenCalledWith(
        '🔍 HomePage: Status de autenticação determinado:',
        {
          status: 'authenticated',
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        }
      );
    });

    it('should log different statuses correctly', () => {
      const testCases = [
        { status: 'unauthenticated', isAuthenticated: false },
        { status: 'authenticated', isAuthenticated: true },
        { status: 'loading', isAuthenticated: false },
      ];

      testCases.forEach((testCase) => {
        jest.clearAllMocks();
        
        mockUseAuthStore.mockReturnValue({
          ...testCase,
          isInitialized: true,
          isLoading: false,
        });

        render(<HomePage />);

        expect(console.log).toHaveBeenCalledWith(
          '🔍 HomePage: Status de autenticação determinado:',
          expect.objectContaining(testCase)
        );
      });
    });
  });

  describe('Component State Management', () => {
    it('should update when auth state changes', () => {
      // Initial unauthenticated state
      const { rerender } = render(<HomePage />);

      mockUseAuthStore
        .mockReturnValueOnce({
          status: 'unauthenticated',
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        })
        .mockReturnValueOnce({
          status: 'authenticated',
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });

      // Re-render with authenticated state
      rerender(<HomePage />);

      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle rapid state changes', () => {
      mockUseAuthStore
        .mockReturnValueOnce({
          status: 'initializing',
          isAuthenticated: false,
          isInitialized: false,
          isLoading: true,
        })
        .mockReturnValueOnce({
          status: 'loading',
          isAuthenticated: false,
          isInitialized: true,
          isLoading: true,
        })
        .mockReturnValueOnce({
          status: 'authenticated',
          isAuthenticated: true,
          isInitialized: true,
          isLoading: false,
        });

      const { rerender } = render(<HomePage />);
      
      // First state: should not redirect
      expect(mockRouter.replace).not.toHaveBeenCalled();
      
      // Second state: still should not redirect
      rerender(<HomePage />);
      expect(mockRouter.replace).not.toHaveBeenCalled();
      
      // Third state: should redirect
      rerender(<HomePage />);
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Loading UI', () => {
    it('should display correct loading spinner size', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('data-size', 'lg');
    });

    it('should show ERP Nexus branding', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ERP Nexus');
    });

    it('should have proper CSS classes for styling', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      const { container } = render(<HomePage />);

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-gray-50');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing auth store state gracefully', () => {
      // Mock undefined return from auth store
      mockUseAuthStore.mockReturnValue({} as any);

      expect(() => render(<HomePage />)).not.toThrow();
    });

    it('should handle router navigation errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRouter.replace.mockImplementation(() => {
        throw new Error('Navigation error');
      });

      mockUseAuthStore.mockReturnValue({
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      expect(() => render(<HomePage />)).not.toThrow();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const renderSpy = jest.fn();
      
      const TestComponent = () => {
        renderSpy();
        return <HomePage />;
      };

      mockUseAuthStore.mockReturnValue({
        status: 'authenticated',
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      render(<TestComponent />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should memoize auth store values properly', () => {
      const authState = {
        status: 'authenticated' as const,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      };

      mockUseAuthStore.mockReturnValue(authState);

      const { rerender } = render(<HomePage />);
      
      // Multiple re-renders with same state should not cause issues
      rerender(<HomePage />);
      rerender(<HomePage />);
      
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('ERP Nexus');
    });

    it('should provide informative loading text', () => {
      mockUseAuthStore.mockReturnValue({
        status: 'initializing',
        isAuthenticated: false,
        isInitialized: false,
        isLoading: true,
      });

      render(<HomePage />);

      expect(screen.getByText('Inicializando sistema...')).toBeInTheDocument();
    });
  });
});