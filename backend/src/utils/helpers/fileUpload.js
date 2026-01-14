// src/utils/helpers/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('./apiError');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = uploadDir;
    
    if (file.mimetype.startsWith('image/')) {
      dir = path.join(uploadDir, 'images');
    } else if (file.mimetype.startsWith('video/')) {
      dir = path.join(uploadDir, 'videos');
    } else {
      dir = path.join(uploadDir, 'files');
    }
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(`File type ${file.mimetype} is not allowed`, 400), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Image processing middleware
const processImage = async (filePath, options = {}) => {
  const { width = 800, height = 600, quality = 80 } = options;
  
  const processedFilePath = filePath.replace(
    path.extname(filePath),
    `_processed${path.extname(filePath)}`
  );
  
  await sharp(filePath)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality })
    .png({ quality })
    .toFile(processedFilePath);
  
  return processedFilePath;
};

// Generate thumbnail
const generateThumbnail = async (filePath, size = 200) => {
  const thumbnailPath = filePath.replace(
    path.extname(filePath),
    `_thumb${path.extname(filePath)}`
  );
  
  await sharp(filePath)
    .resize(size, size, {
      fit: 'cover',
      position: 'center'
    })
    .toFile(thumbnailPath);
  
  return thumbnailPath;
};

// Delete file
const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  upload,
  processImage,
  generateThumbnail,
  deleteFile,
  uploadDir
};