// ERP Nexus - Document Validation Hook
// Hook para validação em tempo real de documentos (CPF/CNPJ)

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { isValidCPF, formatDocument } from '@/utils';
import { useToast } from '@/stores/ui';

// Simple CNPJ validation function
const isValidCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, '');
  
  if (cleaned.length !== 14 || /^(\d)\1+$/.test(cleaned)) {
    return false;
  }
  
  let sum = 0;
  let weight = 5;
  
  // First digit verification
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  let digit = 11 - (sum % 11);
  const firstDigit = digit === 10 || digit === 11 ? 0 : digit;
  
  if (parseInt(cleaned.charAt(12)) !== firstDigit) {
    return false;
  }
  
  // Second digit verification
  sum = 0;
  weight = 6;
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  
  digit = 11 - (sum % 11);
  const secondDigit = digit === 10 || digit === 11 ? 0 : digit;
  
  return parseInt(cleaned.charAt(13)) === secondDigit;
};

interface DocumentValidation {
  isValid: boolean;
  isDuplicate: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useDocumentValidation = () => {
  const [validation, setValidation] = useState<DocumentValidation>({
    isValid: false,
    isDuplicate: false,
    isLoading: false,
    error: null,
  });
  
  const { error: showError } = useToast();
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const validateDocument = useCallback(async (document: string, customerId?: string) => {
    const cleanedDocument = document.replace(/\D/g, '');
    
    // Clear existing debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Don't validate if document is too short
    if (cleanedDocument.length < 11) {
      setValidation({
        isValid: false,
        isDuplicate: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Set loading state immediately
    setValidation(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    // Debounce the API call (500ms delay)
    return new Promise<void>((resolve) => {
      debounceTimeout.current = setTimeout(async () => {
        try {
          // 1. Validate document format
          if (cleanedDocument.length === 11) {
            if (!isValidCPF(cleanedDocument)) {
              setValidation({
                isValid: false,
                isDuplicate: false,
                isLoading: false,
                error: 'CPF inválido',
              });
              resolve();
              return;
            }
          } else if (cleanedDocument.length === 14) {
            if (!isValidCNPJ(cleanedDocument)) {
              setValidation({
                isValid: false,
                isDuplicate: false,
                isLoading: false,
                error: 'CNPJ inválido',
              });
              resolve();
              return;
            }
          } else {
            setValidation({
              isValid: false,
              isDuplicate: false,
              isLoading: false,
              error: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos',
            });
            resolve();
            return;
          }

          // 2. Check for duplicates (only if format is valid)
          try {
            const params = new URLSearchParams();
            params.append('document', cleanedDocument);
            if (customerId) {
              params.append('excludeId', customerId);
            }

            const response = await api.get(`/api/crm/customers/check-document?${params.toString()}`);
            
            if (response.data.exists) {
              setValidation({
                isValid: false,
                isDuplicate: true,
                isLoading: false,
                error: 'Já existe um cliente cadastrado com este documento',
              });
              
              // Show toast notification for duplicate
              showError('Documento duplicado', 'Já existe um cliente cadastrado com este CPF/CNPJ.');
            } else {
              setValidation({
                isValid: true,
                isDuplicate: false,
                isLoading: false,
                error: null,
              });
            }
          } catch (error) {
            // If the endpoint doesn't exist or fails, we'll consider it valid
            // This prevents blocking the form due to API issues
            console.warn('Document validation endpoint not available:', error);
            setValidation({
              isValid: true,
              isDuplicate: false,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          setValidation({
            isValid: false,
            isDuplicate: false,
            isLoading: false,
            error: 'Erro ao validar documento',
          });
        }
        resolve();
      }, 500); // 500ms debounce
    });
  }, [showError]);

  const resetValidation = useCallback(() => {
    setValidation({
      isValid: false,
      isDuplicate: false,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...validation,
    validateDocument,
    resetValidation,
    formatDocument,
  };
};