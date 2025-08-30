'use client';

import { useState, useCallback } from 'react';
import { ServicePhoto } from '@/types';
import { Button } from '@/components/ui/button';
import { servicesApi } from '@/lib/api';
import { 
  Upload, 
  Image, 
  X, 
  Eye, 
  Download, 
  Camera,
  AlertCircle
} from 'lucide-react';

interface PhotoUploadProps {
  appointmentId?: string;
  photos: ServicePhoto[];
  onPhotosChange: (photos: ServicePhoto[]) => void;
  maxPhotos?: number;
  allowedTypes?: string[];
  maxFileSize?: number; // em MB
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  appointmentId,
  photos,
  onPhotosChange,
  maxPhotos = 10,
  allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxFileSize = 5,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = async (file: File, type: 'BEFORE' | 'AFTER' | 'DURING') => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('type', type);
    if (appointmentId) {
      formData.append('appointmentId', appointmentId);
    }

    try {
      const response = await servicesApi.post('/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data as ServicePhoto;
    } catch (error) {
      throw new Error('Erro ao fazer upload da foto');
    }
  };

  const handleFileSelect = useCallback(async (files: FileList, type: 'BEFORE' | 'AFTER' | 'DURING' = 'DURING') => {
    setError('');
    setUploading(true);

    try {
      const fileArray = Array.from(files);
      
      // Validações
      if (photos.length + fileArray.length > maxPhotos) {
        setError(`Máximo de ${maxPhotos} fotos permitidas`);
        setUploading(false);
        return;
      }

      for (const file of fileArray) {
        // Verificar tipo do arquivo
        if (!allowedTypes.includes(file.type)) {
          setError(`Tipo de arquivo não permitido: ${file.name}`);
          setUploading(false);
          return;
        }

        // Verificar tamanho do arquivo
        if (file.size > maxFileSize * 1024 * 1024) {
          setError(`Arquivo muito grande: ${file.name} (máximo ${maxFileSize}MB)`);
          setUploading(false);
          return;
        }
      }

      // Upload dos arquivos
      const uploadPromises = fileArray.map(file => uploadFile(file, type));
      const uploadedPhotos = await Promise.all(uploadPromises);

      onPhotosChange([...photos, ...uploadedPhotos]);
    } catch (error) {
      console.error('Erro no upload:', error);
      setError('Erro ao fazer upload das fotos');
    } finally {
      setUploading(false);
    }
  }, [photos, onPhotosChange, appointmentId, maxPhotos, allowedTypes, maxFileSize]);

  const handleDrop = useCallback((e: React.DragEvent, type: 'BEFORE' | 'AFTER' | 'DURING' = 'DURING') => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files, type);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removePhoto = (photoId: string) => {
    onPhotosChange(photos.filter(photo => photo.id !== photoId));
    // TODO: Remover do servidor também
  };

  const getPhotosByType = (type: 'BEFORE' | 'AFTER' | 'DURING') => {
    return photos.filter(photo => photo.type === type);
  };

  const PhotoSection = ({ 
    type, 
    title, 
    color, 
    icon: Icon 
  }: { 
    type: 'BEFORE' | 'AFTER' | 'DURING'; 
    title: string; 
    color: string;
    icon: React.ElementType;
  }) => {
    const sectionPhotos = getPhotosByType(type);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={color} />
          <h3 className="font-medium text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500">({sectionPhotos.length})</span>
        </div>

        {/* Área de upload */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={(e) => handleDrop(e, type)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={(e) => e.target.files && handleFileSelect(e.target.files, type)}
            className="hidden"
            id={`file-input-${type}`}
            disabled={uploading}
          />
          
          <label
            htmlFor={`file-input-${type}`}
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="text-gray-400" size={24} />
            <div className="text-sm">
              <span className="font-medium text-blue-600">Clique para enviar</span>
              <span className="text-gray-500"> ou arraste arquivos aqui</span>
            </div>
            <p className="text-xs text-gray-500">
              PNG, JPG até {maxFileSize}MB
            </p>
          </label>
        </div>

        {/* Grid de fotos */}
        {sectionPhotos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sectionPhotos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.originalName}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/90 text-gray-700 hover:bg-white"
                    onClick={() => window.open(photo.url, '_blank')}
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/90 text-gray-700 hover:bg-white"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = photo.url;
                      link.download = photo.originalName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-red-500/90 text-white hover:bg-red-600"
                    onClick={() => removePhoto(photo.id)}
                  >
                    <X size={14} />
                  </Button>
                </div>
                
                {/* Info da foto */}
                <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs p-1 rounded">
                  <p className="truncate">{photo.originalName}</p>
                  <p>{(photo.size / 1024 / 1024).toFixed(1)}MB</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold">Fotos do Atendimento</h2>
        </div>
        <div className="text-sm text-gray-500">
          {photos.length} de {maxPhotos} fotos
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={16} />
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setError('')}
            className="ml-auto"
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Status de upload */}
      {uploading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
          <span>Fazendo upload das fotos...</span>
        </div>
      )}

      {/* Seções de fotos */}
      <div className="space-y-8">
        <PhotoSection 
          type="BEFORE" 
          title="Fotos Antes" 
          color="text-blue-600"
          icon={Camera}
        />
        <PhotoSection 
          type="DURING" 
          title="Fotos Durante" 
          color="text-orange-600"
          icon={Camera}
        />
        <PhotoSection 
          type="AFTER" 
          title="Fotos Depois" 
          color="text-green-600"
          icon={Camera}
        />
      </div>

      {/* Resumo */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Resumo das Fotos</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {getPhotosByType('BEFORE').length}
            </div>
            <div className="text-gray-600">Antes</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-orange-600">
              {getPhotosByType('DURING').length}
            </div>
            <div className="text-gray-600">Durante</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {getPhotosByType('AFTER').length}
            </div>
            <div className="text-gray-600">Depois</div>
          </div>
        </div>
      </div>
    </div>
  );
};