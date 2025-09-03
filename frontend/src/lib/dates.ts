/**
 * Data/Time Utilities para ERP Nexus
 * 
 * Padronização: API comunica sempre strings ISO 8601, frontend converte para exibição
 * Resolve inconsistência crítica #7 do critical-code-inconsistencies-analysis.md
 */

import { format, parseISO, formatDistanceToNow, isValid, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte string ISO 8601 da API para formato brasileiro (dd/MM/yyyy)
 * @param isoString - String no formato ISO 8601 (ex: "2024-08-23T14:30:00Z")
 * @returns String formatada (ex: "23/08/2024") ou string vazia se inválida
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

/**
 * Converte string ISO 8601 da API para formato de data e hora brasileira
 * @param isoString - String no formato ISO 8601
 * @returns String formatada (ex: "23/08/2024 às 14:30") ou string vazia se inválida
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Converte string ISO 8601 da API para formato de hora (HH:mm)
 * @param isoString - String no formato ISO 8601
 * @returns String formatada (ex: "14:30") ou string vazia se inválida
 */
export function formatTime(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

/**
 * Converte string ISO 8601 para tempo relativo (ex: "há 2 horas")
 * @param isoString - String no formato ISO 8601
 * @returns String com tempo relativo ou string vazia se inválida
 */
export function formatTimeAgo(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { 
      addSuffix: true, 
      locale: ptBR 
    });
  } catch {
    return '';
  }
}

/**
 * Converte um objeto Date local para string ISO 8601 para envio à API
 * @param date - Objeto Date local
 * @returns String ISO 8601 (ex: "2024-08-23T14:30:00.000Z")
 */
export function toISOString(date: Date): string {
  if (!date || !isValid(date)) return '';
  return date.toISOString();
}

/**
 * Converte valores de input[type="date"] e input[type="time"] para ISO string
 * @param dateValue - Valor do input date (ex: "2024-08-23")
 * @param timeValue - Valor do input time (ex: "14:30")
 * @returns String ISO 8601 combinada
 */
export function combineDateTime(dateValue: string, timeValue: string): string {
  if (!dateValue) return '';
  
  try {
    // Se não há horário, usa 00:00
    const timeStr = timeValue || '00:00';
    const combinedStr = `${dateValue}T${timeStr}:00`;
    const date = new Date(combinedStr);
    
    if (!isValid(date)) return '';
    return date.toISOString();
  } catch {
    return '';
  }
}

/**
 * Extrai a parte de data de uma string ISO 8601 para input[type="date"]
 * @param isoString - String ISO 8601
 * @returns String no formato YYYY-MM-DD para input date
 */
export function extractDateForInput(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

/**
 * Extrai a parte de hora de uma string ISO 8601 para input[type="time"]
 * @param isoString - String ISO 8601
 * @returns String no formato HH:mm para input time
 */
export function extractTimeForInput(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

/**
 * Obtém a data atual no formato ISO 8601
 * @returns String ISO 8601 da data/hora atual
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

/**
 * Obtém a data atual no formato YYYY-MM-DD para inputs
 * @returns String no formato YYYY-MM-DD
 */
export function getCurrentDateForInput(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Obtém a hora atual no formato HH:mm para inputs
 * @returns String no formato HH:mm
 */
export function getCurrentTimeForInput(): string {
  return format(new Date(), 'HH:mm');
}

/**
 * Valida se uma string representa uma data válida
 * @param dateString - String a ser validada
 * @returns true se é uma data válida
 */
export function isValidDateString(dateString: string): boolean {
  if (!dateString) return false;
  
  try {
    const date = parseISO(dateString);
    return isValid(date);
  } catch {
    return false;
  }
}

/**
 * Converte uma data para o início do dia (00:00:00) em ISO string
 * @param isoString - String ISO 8601
 * @returns String ISO 8601 do início do dia
 */
export function toStartOfDayISO(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return startOfDay(date).toISOString();
  } catch {
    return '';
  }
}

/**
 * Converte uma data para o fim do dia (23:59:59) em ISO string
 * @param isoString - String ISO 8601
 * @returns String ISO 8601 do fim do dia
 */
export function toEndOfDayISO(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return '';
    return endOfDay(date).toISOString();
  } catch {
    return '';
  }
}