import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { uploadFile, deleteFile } from '../lib/supabase';

interface FileUploadProps {
  value: string;
  onChange: (url: string) => void;
  accept: 'image' | 'pdf' | 'all';
  label?: string;
  folder: string;
}

export function FileUpload({ value, onChange, accept, label, folder }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = {
    image: 'image/jpeg,image/png,image/gif,image/webp,image/avif',
    pdf: 'application/pdf',
    all: 'image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf',
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url);
  };

  const handleUpload = async (file: File) => {
    setError('');

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    const allowedTypes = acceptTypes[accept].split(',');
    if (!allowedTypes.includes(file.type)) {
      setError(`Invalid file type. ${accept === 'image' ? 'Please upload an image.' : accept === 'pdf' ? 'Please upload a PDF.' : 'Please upload an image or PDF.'}`);
      return;
    }

    setUploading(true);

    if (value) {
      await deleteFile(value);
    }

    const url = await uploadFile(file, folder);

    setUploading(false);

    if (url) {
      onChange(url);
    } else {
      setError('Failed to upload file. Please try again.');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleUpload(files[0]);
      }
    },
    [value, folder]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleRemove = async () => {
    if (value) {
      await deleteFile(value);
    }
    onChange('');
  };

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}

      {value ? (
        <div className="relative group">
          {isImage(value) ? (
            <div className="relative w-full h-48 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
              <img
                src={value}
                alt="Uploaded"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-amber-500 rounded-lg text-slate-900 hover:bg-amber-400 transition-colors"
                >
                  <Upload size={20} />
                </button>
                <button
                  onClick={handleRemove}
                  className="p-3 bg-red-500 rounded-lg text-white hover:bg-red-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <FileText className="text-red-400" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">Resume uploaded</p>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:underline"
                >
                  View file
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                >
                  <Upload size={18} />
                </button>
                <button
                  onClick={handleRemove}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes[accept]}
            onChange={handleFileChange}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-amber-400" size={32} />
              <p className="text-sm text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-slate-700/50 rounded-full">
                {accept === 'pdf' ? (
                  <FileText className="text-gray-400" size={32} />
                ) : accept === 'image' ? (
                  <ImageIcon className="text-gray-400" size={32} />
                ) : (
                  <Upload className="text-gray-400" size={32} />
                )}
              </div>
              <div>
                <p className="text-gray-300 font-medium">
                  {isDragging ? 'Drop file here' : 'Drag and drop or click to upload'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {accept === 'image'
                    ? 'PNG, JPG, GIF, WebP, AVIF (max 5MB)'
                    : accept === 'pdf'
                    ? 'PDF files only (max 5MB)'
                    : 'Images or PDF (max 5MB)'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
