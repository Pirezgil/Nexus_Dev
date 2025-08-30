// ERP Nexus - Avatar Crop Modal
// Modal para edição e recorte de imagens de perfil

'use client';

import * as React from 'react';
import ReactCrop, { 
  type Crop, 
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop
} from 'react-image-crop';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RotateCw, ZoomIn, ZoomOut, Move, Crop as CropIcon } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImageBlob: Blob) => void;
  imageFile: File | null;
}

// Função para criar um canvas com a imagem recortada
function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop,
  rotation = 0,
  scale = 1
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Definir tamanho final do avatar (quadrado de alta qualidade)
    const size = 400;
    canvas.width = size;
    canvas.height = size;

    // Calcular coordenadas reais baseadas na imagem natural
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const realCropX = crop.x * scaleX;
    const realCropY = crop.y * scaleY;
    const realCropWidth = crop.width * scaleX;
    const realCropHeight = crop.height * scaleY;

    // Limpar canvas
    ctx.clearRect(0, 0, size, size);

    // Aplicar transformações se necessário
    ctx.save();
    
    if (rotation !== 0) {
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-size / 2, -size / 2);
    }

    // Desenhar usando coordenadas da imagem natural (mesma lógica do preview)
    ctx.drawImage(
      image,
      realCropX, // x da área selecionada na imagem natural
      realCropY, // y da área selecionada na imagem natural
      realCropWidth, // largura da área selecionada na imagem natural
      realCropHeight, // altura da área selecionada na imagem natural
      0, 0, // posição no canvas final
      size, size // tamanho final (400x400)
    );

    ctx.restore();

    // Converter para blob
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  onClose,
  onSave,
  imageFile,
}) => {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [imageSrc, setImageSrc] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // Aspect ratio 1:1 para avatar circular
  const aspect = 1;

  // Carregar imagem quando o modal abrir
  React.useEffect(() => {
    if (imageFile && isOpen) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile, isOpen]);

  // Reset valores quando fechar
  React.useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setRotation(0);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setImageSrc('');
    }
  }, [isOpen]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  // Função para gerar preview em tempo real
  const generatePreview = React.useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !completedCrop || !imgRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = imgRef.current;
    
    // Configurar canvas
    const size = 80;
    canvas.width = size;
    canvas.height = size;
    
    // Calcular coordenadas reais baseadas na imagem natural
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const realCropX = completedCrop.x * scaleX;
    const realCropY = completedCrop.y * scaleY;
    const realCropWidth = completedCrop.width * scaleX;
    const realCropHeight = completedCrop.height * scaleY;
    
    // Debug: log das coordenadas
    console.log('🔍 Preview Debug:', {
      cropX: completedCrop.x,
      cropY: completedCrop.y,
      cropWidth: completedCrop.width,
      cropHeight: completedCrop.height,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      displayWidth: image.width,
      displayHeight: image.height,
      scaleX,
      scaleY,
      realCropX,
      realCropY,
      realCropWidth,
      realCropHeight
    });

    // Limpar canvas
    ctx.clearRect(0, 0, size, size);
    
    // Aplicar transformações se necessário
    ctx.save();
    
    if (rotation !== 0) {
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-size / 2, -size / 2);
    }
    
    // Desenhar usando coordenadas da imagem natural
    ctx.drawImage(
      image,
      realCropX,
      realCropY,
      realCropWidth,
      realCropHeight,
      0,
      0,
      size,
      size
    );
    
    ctx.restore();
  }, [completedCrop, rotation, scale]);

  // Atualizar preview quando qualquer parâmetro mudar
  React.useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsProcessing(true);
    try {
      const croppedImageBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        rotation,
        scale
      );
      
      if (croppedImageBlob) {
        onSave(croppedImageBlob);
        onClose();
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImage = () => {
    setScale(1);
    setRotation(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="w-5 h-5" />
            Editar Foto de Perfil
          </DialogTitle>
          <DialogDescription>
            Ajuste, recorte e redimensione sua foto antes de salvar. 
            Use os controles para obter o melhor resultado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 max-h-[60vh]">
          {/* Área de Crop */}
          <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg p-4 overflow-hidden">
            {imageSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(convertToPixelCrop(c, imgRef.current!.width, imgRef.current!.height))}
                aspect={aspect}
                className="max-w-full max-h-full"
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imageSrc}
                  style={{ 
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                    maxHeight: '400px',
                    maxWidth: '100%'
                  }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            )}
          </div>

          {/* Controles */}
          <div className="lg:w-80 space-y-6">
            {/* Zoom */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Zoom: {Math.round(scale * 100)}%
              </Label>
              <Slider
                value={[scale]}
                onValueChange={(value) => setScale(value[0])}
                max={3}
                min={0.5}
                step={0.1}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(Math.min(3, scale + 0.1))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(1)}
                >
                  Reset
                </Button>
              </div>
            </div>

            <Separator />

            {/* Rotação */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Rotação: {rotation}°
              </Label>
              <Slider
                value={[rotation]}
                onValueChange={(value) => setRotation(value[0])}
                max={360}
                min={-360}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation(rotation - 90)}
                >
                  -90°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation(rotation + 90)}
                >
                  +90°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation(0)}
                >
                  Reset
                </Button>
              </div>
            </div>

            <Separator />

            {/* Preview do resultado */}
            <div className="space-y-3">
              <Label>Preview:</Label>
              <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto flex items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  className="w-20 h-20 rounded-full border-2 border-blue-500"
                  width={80}
                  height={80}
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={resetImage}
              className="w-full"
            >
              <Move className="w-4 h-4 mr-2" />
              Resetar Ajustes
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isProcessing || !completedCrop}>
            {isProcessing ? 'Processando...' : 'Salvar Avatar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};