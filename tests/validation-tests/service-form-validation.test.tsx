/**
 * Testes de Validação do Formulário de Serviços
 * Verifica se a validação compartilhada funciona corretamente no frontend
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceForm } from '../../frontend/src/components/forms/ServiceForm';
import { SERVICE_VALIDATION_RULES } from '../../shared/validation/service-schemas';

// Mock da função onSubmit
const mockOnSubmit = jest.fn();

describe('ServiceForm - Validação Compartilhada', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('Validação de Duração - Erro #10 Corrigido', () => {
    test('ERRO #10: Deve mostrar erro instantâneo para duração máxima excedida (481 minutos)', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      // Localizar campo de duração
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Inserir valor inválido (acima do máximo)
      await user.clear(durationInput);
      await user.type(durationInput, '481');
      
      // Mover foco para outro campo para disparar validação
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      // Verificar se mensagem de erro aparece imediatamente
      await waitFor(() => {
        expect(screen.getByText(/duração máxima é de 480 minutos/i)).toBeInTheDocument();
      });
      
      // Verificar que o botão de submit ainda não foi clicado
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('ERRO #10: Deve mostrar erro instantâneo para duração mínima inválida (0 minutos)', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Inserir valor inválido (abaixo do mínimo)
      await user.clear(durationInput);
      await user.type(durationInput, '0');
      
      // Mover foco para disparar validação
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      await waitFor(() => {
        expect(screen.getByText(/duração mínima é de 1 minuto/i)).toBeInTheDocument();
      });
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('ERRO #10: Deve aceitar duração válida (60 minutos) sem erro', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Inserir valor válido
      await user.clear(durationInput);
      await user.type(durationInput, '60');
      
      // Mover foco para verificar que não há erro
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      // Aguardar um momento para garantir que nenhum erro apareça
      await waitFor(() => {
        expect(screen.queryByText(/duração máxima/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/duração mínima/i)).not.toBeInTheDocument();
      });
    });

    test('ERRO #10: Deve aceitar exatamente o limite máximo (480 minutos)', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Inserir valor no limite máximo
      await user.clear(durationInput);
      await user.type(durationInput, '480');
      
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      await waitFor(() => {
        expect(screen.queryByText(/duração máxima/i)).not.toBeInTheDocument();
      });
    });

    test('ERRO #10: Deve aceitar exatamente o limite mínimo (1 minuto)', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Inserir valor no limite mínimo
      await user.clear(durationInput);
      await user.type(durationInput, '1');
      
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      await waitFor(() => {
        expect(screen.queryByText(/duração mínima/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Validação Completa do Formulário', () => {
    test('Deve impedir submit com dados inválidos e mostrar todos os erros', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      // Preencher formulário com dados inválidos
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      const priceInput = screen.getByLabelText(/preço/i);
      
      await user.clear(nameInput);
      await user.type(nameInput, 'AB'); // Muito curto (< 3 caracteres)
      
      await user.clear(durationInput);
      await user.type(durationInput, '500'); // Muito longo (> 480 minutos)
      
      await user.clear(priceInput);
      await user.type(priceInput, '-10'); // Negativo
      
      // Tentar submeter o formulário
      const submitButton = screen.getByRole('button', { name: /salvar serviço/i });
      await user.click(submitButton);
      
      // Verificar que erros são mostrados e submit não é chamado
      await waitFor(() => {
        expect(screen.getByText(/nome deve ter pelo menos 3 caracteres/i)).toBeInTheDocument();
        expect(screen.getByText(/duração máxima é de 480 minutos/i)).toBeInTheDocument();
        expect(screen.getByText(/preço deve ser um valor positivo/i)).toBeInTheDocument();
      });
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('Deve permitir submit com dados válidos', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      // Preencher formulário com dados válidos
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      const priceInput = screen.getByLabelText(/preço/i);
      
      await user.clear(nameInput);
      await user.type(nameInput, 'Corte de Cabelo Masculino');
      
      await user.clear(durationInput);
      await user.type(durationInput, '45');
      
      await user.clear(priceInput);
      await user.type(priceInput, '35.00');
      
      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /salvar serviço/i });
      await user.click(submitButton);
      
      // Verificar que submit é chamado com dados corretos
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Corte de Cabelo Masculino',
          duration: 45,
          price: 35.00,
          description: '',
          category: '',
          requirements: ''
        });
      });
    });
  });

  describe('Consistência com Constantes de Validação', () => {
    test('Deve usar as mesmas constantes de validação do schema compartilhado', () => {
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      // Verificar se os hints no formulário correspondem às constantes
      const durationHint = screen.getByText(new RegExp(`Máximo: ${SERVICE_VALIDATION_RULES.DURATION_MAX} min`));
      expect(durationHint).toBeInTheDocument();
      
      const minHint = screen.getByText(new RegExp(`Mínimo: ${SERVICE_VALIDATION_RULES.DURATION_MIN} min`));
      expect(minHint).toBeInTheDocument();
      
      // Verificar atributos HTML dos inputs
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      expect(durationInput).toHaveAttribute('min', SERVICE_VALIDATION_RULES.DURATION_MIN.toString());
      expect(durationInput).toHaveAttribute('max', SERVICE_VALIDATION_RULES.DURATION_MAX.toString());
    });
  });

  describe('UX - Feedback Visual', () => {
    test('Deve alterar estilo visual do campo com erro', async () => {
      const user = userEvent.setup();
      
      render(<ServiceForm onSubmit={mockOnSubmit} />);
      
      const durationInput = screen.getByLabelText(/duração.*minutos/i);
      
      // Campo válido inicialmente
      expect(durationInput).not.toHaveClass('border-red-300');
      
      // Inserir valor inválido
      await user.clear(durationInput);
      await user.type(durationInput, '600');
      
      // Mover foco para disparar validação
      const nameInput = screen.getByLabelText(/nome do serviço/i);
      await user.click(nameInput);
      
      // Verificar que estilo de erro é aplicado
      await waitFor(() => {
        expect(durationInput).toHaveClass('border-red-300');
      });
    });
  });
});