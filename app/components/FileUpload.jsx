'use client';

import { useState, useCallback } from 'react';

export default function FileUpload({ onFileUploaded, uploadedFiles }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        handleFileUpload(files[0]);
    }, []);

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    }, []);

    const handleFileUpload = async (file) => {
        if (!file) return;

        // Check if file is PDF
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Upload file
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            const uploadData = await uploadResponse.json();
            setUploadProgress(50);

            // Index the file
            const indexResponse = await fetch('/api/files/indexing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uploadedFile: uploadData.filepath }),
            });

            if (!indexResponse.ok) {
                throw new Error('Failed to index file');
            }

            setUploadProgress(100);

            // Call the parent component's callback
            onFileUploaded({
                name: file.name,
                size: formatFileSize(file.size),
                type: file.type,
                filepath: uploadData.filepath,
                uploadedAt: new Date().toISOString(),
            });

            // Reset progress after a short delay
            setTimeout(() => {
                setUploadProgress(0);
            }, 1000);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload and process file. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const removeFile = (index) => {
        // This would need to be implemented based on your requirements
        console.log('Remove file at index:', index);
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div
                className={`relative p-6 text-center transition-colors card ${isDragOver ? '' : ''}`}
                style={{ borderStyle: 'dashed', borderColor: isDragOver ? 'var(--primary)' : 'var(--border)', background: isDragOver ? 'color-mix(in srgb, var(--primary) 6%, var(--surface))' : 'var(--surface)', borderWidth: '2px' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                />

                <div className="space-y-2">
                    <div className="w-12 h-12 rounded-lg mx-auto flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                        <svg className="w-6 h-6" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    {isUploading ? (
                        <div className="space-y-2">
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Uploading and processing...</p>
                            <div className="w-full rounded-full h-2" style={{ background: '#e5e7eb' }}>
                                <div
                                    className="h-2 rounded-full transition-all duration-300"
                                    style={{ background: 'var(--primary)', width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{uploadProgress}% complete</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Drop your PDF here or <span style={{ color: 'var(--primary)' }} className="font-medium">browse files</span>
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PDF files only, up to 10MB</p>
                        </>
                    )}
                </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>Uploaded Documents</h3>
                    {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 card">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: '#fee2e2' }}>
                                    <svg className="w-4 h-4" style={{ color: '#b91c1c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{file.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{file.size} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => removeFile(index)}
                                className="transition-colors"
                                style={{ color: '#a1a1aa' }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
