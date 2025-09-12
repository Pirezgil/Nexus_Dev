'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Trash2, 
  Archive, 
  Tag, 
  Mail, 
  Phone, 
  MoreHorizontal,
  X
} from 'lucide-react';
import { Customer } from '@/hooks/api/use-customers';

interface BulkActionsProps {
  selectedItems: Customer[];
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete?: (items: Customer[]) => void;
  onBulkInactivate?: (items: Customer[]) => void;
  onBulkAddTags?: (items: Customer[], tags: string[]) => void;
  onBulkExport?: (items: Customer[]) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedItems,
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkInactivate,
  onBulkAddTags,
  onBulkExport,
}) => {
  if (selectedCount === 0) return null;

  const handleBulkInactivate = () => {
    if (confirm(`Tem certeza que deseja inativar ${selectedCount} cliente(s) selecionado(s)?`)) {
      onBulkInactivate?.(selectedItems);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`⚠️ ATENÇÃO: Esta ação irá remover permanentemente ${selectedCount} cliente(s) do sistema.\n\nEsta operação NÃO pode ser desfeita.\n\nDeseja continuar?`)) {
      onBulkDelete?.(selectedItems);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg border">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
            {selectedCount}
          </Badge>
          <span className="text-sm font-medium">
            {selectedCount === 1 ? 'cliente selecionado' : 'clientes selecionados'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Quick Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBulkExport?.(selectedItems)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
            title="Exportar selecionados"
          >
            <Mail className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkInactivate}
            className="text-primary-foreground hover:bg-primary-foreground/20"
            title="Inativar selecionados"
          >
            <Archive className="h-4 w-4" />
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onBulkAddTags?.(selectedItems, ['VIP'])}>
                <Tag className="h-4 w-4 mr-2" />
                Adicionar Tags
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkExport?.(selectedItems)}>
                <Mail className="h-4 w-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleBulkInactivate}
                className="text-warning"
              >
                <Archive className="h-4 w-4 mr-2" />
                Inativar Clientes
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleBulkDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Permanentemente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Selection */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-primary-foreground hover:bg-primary-foreground/20 ml-2"
            title="Limpar seleção"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};