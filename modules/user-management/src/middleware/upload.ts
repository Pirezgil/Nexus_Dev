import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { ValidationError } from '../types';

// Configure multer for avatar uploads
const storage = multer.memoryStorage(); // Store in memory for processing

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ValidationError('Tipo de arquivo inválido', {
      file: ['Apenas arquivos de imagem são permitidos (JPEG, PNG, WebP)']
    }));
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1, // Only one file
  },
});

// Middleware for single avatar upload
export const uploadAvatar = upload.single('avatar');

// Error handler for multer errors
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Arquivo muito grande',
        message: 'O arquivo deve ter no máximo 5MB',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Muitos arquivos',
        message: 'Envie apenas um arquivo por vez',
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Campo inválido',
        message: 'Use o campo "avatar" para enviar o arquivo',
      });
    }
  }
  next(error);
};