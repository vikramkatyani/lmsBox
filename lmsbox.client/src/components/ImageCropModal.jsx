import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { XMarkIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const file = new File([blob], 'cropped-banner.jpg', { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.95);
  });
}

export default function ImageCropModal({ isOpen, onClose, onCropComplete: onCropCompleteCallback, aspectRatio = 37 / 9 }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function to determine aspect ratio display text
  const getAspectRatioText = () => {
    const ratio = Math.round(aspectRatio * 100) / 100;
    const fourThirds = Math.round((4/3) * 100) / 100;
    const thirtySevenNinths = Math.round((37/9) * 100) / 100;
    
    if (Math.abs(ratio - fourThirds) < 0.01) {
      return '4:3 (800x600px)';
    } else if (Math.abs(ratio - thirtySevenNinths) < 0.01) {
      return '37:9';
    } else if (Math.abs(ratio - 16/9) < 0.01) {
      return '16:9';
    } else {
      return `${aspectRatio.toFixed(2)}:1`;
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    }
  };

  const readFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const handleCropAndUpload = async () => {
    try {
      setIsProcessing(true);
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImage) {
        await onCropCompleteCallback(croppedImage);
        handleClose();
      }
    } catch (e) {
      console.error('Error cropping image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onClose();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 1));
  };

  // Helper function to determine image type for header
  const getImageType = () => {
    const ratio = Math.round(aspectRatio * 100) / 100;
    const fourThirds = Math.round((4/3) * 100) / 100;
    
    if (Math.abs(ratio - fourThirds) < 0.01) {
      return 'Thumbnail';
    }
    return 'Banner';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-80 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal container */}
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Modal panel */}
        <div className="relative bg-white rounded-xl shadow-2xl transform transition-all w-full max-w-3xl z-10">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {imageSrc ? `Adjust Your ${getImageType()}` : `Upload ${getImageType()} Image`}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {!imageSrc ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-full max-w-md">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500 font-semibold">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">
                        PNG, JPG, GIF up to 10MB
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Recommended ratio: {getAspectRatioText()}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={onFileChange}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cropper area */}
                <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspectRatio}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    objectFit="contain"
                    showGrid={false}
                    style={{
                      containerStyle: {
                        backgroundColor: '#111827',
                      },
                    }}
                  />
                </div>

                {/* Zoom controls */}
                <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    disabled={zoom <= 1}
                  >
                    <MagnifyingGlassMinusIcon className={`h-5 w-5 ${zoom <= 1 ? 'text-gray-300' : 'text-gray-600'}`} />
                  </button>
                  
                  <div className="flex-1">
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    disabled={zoom >= 3}
                  >
                    <MagnifyingGlassPlusIcon className={`h-5 w-5 ${zoom >= 3 ? 'text-gray-300' : 'text-gray-600'}`} />
                  </button>
                </div>

                {/* Info text */}
                <p className="text-sm text-center text-gray-500">
                  Drag to reposition • Scroll or use slider to zoom
                </p>

                {/* Change image button */}
                <div className="flex justify-center">
                  <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    Choose Different Image
                    <input
                      type="file"
                      className="hidden"
                      onChange={onFileChange}
                      accept="image/*"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {imageSrc && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropAndUpload}
                disabled={isProcessing}
                className="px-5 py-2.5 text-sm font-semibold text-[#1b365d] bg-[#2afeae] rounded-lg hover:bg-[#25e89e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Save & Upload'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
