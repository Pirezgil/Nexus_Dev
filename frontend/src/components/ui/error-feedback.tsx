// ERP Nexus - Enhanced Error Feedback Component
// Provides comprehensive error messaging with actionable suggestions

import React from 'react';
import { AlertCircle, InfoIcon, RefreshCw, HelpCircle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface ErrorDetails {
  title: string;
  message: string;
  type: 'validation' | 'not_found' | 'unauthorized' | 'forbidden' | 'conflict' | 'server_error' | 'network_error';
  suggestions?: string[];
  code?: string;
  timestamp?: string;
  canRetry?: boolean;
  supportUrl?: string;
  technicalDetails?: {
    status?: number;
    endpoint?: string;
    requestId?: string;
    errorStack?: string;
  };
}

interface ErrorFeedbackProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  variant?: 'inline' | 'modal' | 'toast';
  showTechnicalDetails?: boolean;
}

const getErrorIcon = (type: ErrorDetails['type']) => {
  switch (type) {
    case 'validation':
      return <AlertCircle className="h-5 w-5 text-orange-500" />;
    case 'not_found':
      return <HelpCircle className="h-5 w-5 text-blue-500" />;
    case 'unauthorized':
    case 'forbidden':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'conflict':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case 'network_error':
      return <AlertCircle className="h-5 w-5 text-purple-500" />;
    case 'server_error':
    default:
      return <AlertCircle className="h-5 w-5 text-red-500" />;
  }
};

const getErrorBadgeVariant = (type: ErrorDetails['type']) => {
  switch (type) {
    case 'validation':
      return 'secondary';
    case 'not_found':
      return 'outline';
    case 'unauthorized':
    case 'forbidden':
      return 'destructive';
    case 'conflict':
      return 'secondary';
    case 'network_error':
      return 'outline';
    case 'server_error':
    default:
      return 'destructive';
  }
};

const getErrorTypeLabel = (type: ErrorDetails['type']) => {
  const labels = {
    validation: 'Validação',
    not_found: 'Não Encontrado',
    unauthorized: 'Não Autorizado',
    forbidden: 'Acesso Negado',
    conflict: 'Conflito',
    network_error: 'Erro de Rede',
    server_error: 'Erro do Servidor'
  };
  return labels[type] || 'Erro';
};

export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  variant = 'inline',
  showTechnicalDetails = false,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  const renderSuggestions = () => {
    if (!error.suggestions || error.suggestions.length === 0) return null;

    return (
      <div className="mt-3">
        <p className="text-sm font-medium text-gray-700 mb-2">Sugestões:</p>
        <ul className="space-y-1">
          {error.suggestions.map((suggestion, index) => (
            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderActions = () => {
    if (!onRetry && !error.supportUrl && !onDismiss) return null;

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && error.canRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar Novamente
          </Button>
        )}
        
        {error.supportUrl && (
          <Button
            onClick={() => window.open(error.supportUrl, '_blank')}
            variant="ghost"
            size="sm"
            className="h-8"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Ajuda
          </Button>
        )}
        
        {onDismiss && (
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="sm"
            className="h-8"
          >
            Fechar
          </Button>
        )}
      </div>
    );
  };

  const renderTechnicalDetails = () => {
    if (!showTechnicalDetails || !error.technicalDetails) return null;

    const { status, endpoint, requestId, errorStack } = error.technicalDetails;

    return (
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 p-0 text-xs text-gray-500 hover:text-gray-700 mt-2"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Ocultar' : 'Mostrar'} detalhes técnicos
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border space-y-1">
            {status && <div><strong>Status:</strong> {status}</div>}
            {endpoint && <div><strong>Endpoint:</strong> {endpoint}</div>}
            {requestId && <div><strong>Request ID:</strong> {requestId}</div>}
            {error.timestamp && (
              <div><strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString('pt-BR')}</div>
            )}
            {error.code && <div><strong>Code:</strong> {error.code}</div>}
            {errorStack && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Stack Trace</summary>
                <pre className="mt-1 text-xs whitespace-pre-wrap bg-white p-2 border rounded">
                  {errorStack}
                </pre>
              </details>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const content = (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {getErrorIcon(error.type)}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{error.title}</h4>
            <Badge variant={getErrorBadgeVariant(error.type) as any} className="text-xs">
              {getErrorTypeLabel(error.type)}
            </Badge>
          </div>
          <p className="text-sm text-gray-700">{error.message}</p>
          {renderSuggestions()}
          {renderActions()}
          {renderTechnicalDetails()}
        </div>
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <Card className={`max-w-lg ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Erro</CardTitle>
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'toast') {
    return (
      <div className={`bg-white border rounded-lg shadow-lg p-4 max-w-sm ${className}`}>
        {content}
      </div>
    );
  }

  // Default inline variant
  return (
    <Alert className={`border-l-4 ${className}`}>
      <AlertDescription>
        {content}
      </AlertDescription>
    </Alert>
  );
};

// Utility function to create ErrorDetails from common error scenarios
export const createErrorDetails = {
  customerNotFound: (customerId: string): ErrorDetails => ({
    title: 'Cliente não encontrado',
    message: `O cliente com ID ${customerId} não foi encontrado ou foi removido.`,
    type: 'not_found',
    suggestions: [
      'Verifique se o ID está correto',
      'Confirme se o cliente ainda existe no sistema',
      'Atualize a lista de clientes'
    ],
    canRetry: true,
    timestamp: new Date().toISOString()
  }),

  invalidUUID: (field = 'ID'): ErrorDetails => ({
    title: 'Formato inválido',
    message: `${field} possui formato inválido`,
    type: 'validation',
    suggestions: [
      'Verifique se o ID foi copiado corretamente',
      'O formato deve ser: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      'Utilize apenas caracteres hexadecimais (0-9, a-f)'
    ],
    canRetry: false
  }),

  networkError: (): ErrorDetails => ({
    title: 'Erro de conexão',
    message: 'Não foi possível conectar ao servidor',
    type: 'network_error',
    suggestions: [
      'Verifique sua conexão com a internet',
      'Tente novamente em alguns segundos',
      'Contate o administrador se o problema persistir'
    ],
    canRetry: true,
    timestamp: new Date().toISOString()
  }),

  serverError: (message?: string): ErrorDetails => ({
    title: 'Erro interno do servidor',
    message: message || 'Ocorreu um erro interno no servidor',
    type: 'server_error',
    suggestions: [
      'Tente novamente em alguns minutos',
      'Se o problema persistir, contate o suporte técnico',
      'Reporte este erro com os detalhes técnicos'
    ],
    canRetry: true,
    supportUrl: '/help/contact',
    timestamp: new Date().toISOString()
  }),

  unauthorized: (): ErrorDetails => ({
    title: 'Não autorizado',
    message: 'Você não tem permissão para realizar esta operação',
    type: 'unauthorized',
    suggestions: [
      'Verifique se você está logado corretamente',
      'Contate o administrador para obter as permissões necessárias',
      'Faça login novamente se sua sessão expirou'
    ],
    canRetry: false
  }),

  validationError: (errors: Record<string, string>): ErrorDetails => ({
    title: 'Dados inválidos',
    message: 'Os dados fornecidos não passaram na validação',
    type: 'validation',
    suggestions: Object.values(errors).concat([
      'Verifique todos os campos obrigatórios',
      'Corrija os erros indicados'
    ]),
    canRetry: false
  })
};

export default ErrorFeedback;