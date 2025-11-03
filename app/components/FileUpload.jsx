'use client';

import { useState, useCallback } from 'react';

export default function FileUpload({ onFileUploaded, onFileRemoved, uploadedFiles, isOpen, onClose }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [activeTab, setActiveTab] = useState('pdf'); // 'pdf', 'url', 'youtube'
    const [urlInput, setUrlInput] = useState('');
    const [youtubeInput, setYoutubeInput] = useState('');

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
                body: JSON.stringify({
                    filename: uploadData.filename,
                    filepath: uploadData.filepath
                }),
            });

            if (!indexResponse.ok) {
                throw new Error('Failed to index file');
            }

            setUploadProgress(100);

            // Call the parent component's callback
            onFileUploaded({
                name: file.name,
                serverFilename: uploadData.filename, // Store the server filename for deletion
                size: formatFileSize(file.size),
                type: file.type,
                filepath: uploadData.filepath,
                uploadedAt: new Date().toISOString(),
            });

            // Reset progress after a short delay
            setTimeout(() => {
                setUploadProgress(0);
                onClose(); // Close the modal after successful upload
            }, 1000);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload and process file. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUrlUpload = async () => {
        if (!urlInput.trim()) {
            alert('Please enter a URL');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const response = await fetch('/api/files/url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: urlInput }),
            });

            setUploadProgress(50);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process URL');
            }

            const data = await response.json();
            setUploadProgress(100);

            // Extract a friendly name from URL
            const urlObj = new URL(urlInput);
            const friendlyName = urlObj.hostname.replace('www.', '') + urlObj.pathname.substring(0, 20);

            onFileUploaded({
                name: friendlyName,
                serverFilename: data.collectionName,
                size: `${data.chunksCount} chunks`,
                type: 'website',
                url: urlInput,
                uploadedAt: new Date().toISOString(),
            });

            setTimeout(() => {
                setUploadProgress(0);
                setUrlInput('');
                onClose();
            }, 1000);

        } catch (error) {
            console.error('URL processing error:', error);
            alert(error.message || 'Failed to process URL. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleYoutubeUpload = async () => {
        if (!youtubeInput.trim()) {
            alert('Please enter a YouTube URL');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const response = await fetch('/api/files/youtube', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: youtubeInput }),
            });

            setUploadProgress(50);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process YouTube video');
            }

            const data = await response.json();
            setUploadProgress(100);

            onFileUploaded({
                name: `YouTube: ${data.videoId}`,
                serverFilename: data.collectionName,
                size: `${data.chunksCount} chunks`,
                type: 'youtube',
                url: youtubeInput,
                videoId: data.videoId,
                uploadedAt: new Date().toISOString(),
            });

            setTimeout(() => {
                setUploadProgress(0);
                setYoutubeInput('');
                onClose();
            }, 1000);

        } catch (error) {
            console.error('YouTube processing error:', error);
            alert(error.message || 'Failed to process YouTube video. Make sure the video has captions.');
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

    const removeFile = async (index) => {
        const file = uploadedFiles[index];
        if (!file) return;

        // Call the parent component's callback to handle the deletion

        if (onFileRemoved) {
            await onFileRemoved(index);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Add Source</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex space-x-2 mb-4 bg-gray-700 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('pdf')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pdf'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        📄 PDF
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'url'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        🌐 Website
                    </button>
                    <button
                        onClick={() => setActiveTab('youtube')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'youtube'
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-300 hover:text-white'
                            }`}
                    >
                        ▶️ YouTube
                    </button>
                </div>

                <div className="space-y-4">
                    {/* PDF Upload Tab */}
                    {activeTab === 'pdf' && (
                        <div
                            className={`relative p-6 text-center transition-colors rounded-lg border-2 border-dashed ${isDragOver
                                    ? 'border-blue-400 bg-blue-500/10'
                                    : 'border-gray-600 bg-gray-700'
                                }`}
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
                                <div className="w-12 h-12 rounded-lg mx-auto flex items-center justify-center bg-gray-600">
                                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>

                                {isUploading ? (
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-300">Uploading and processing...</p>
                                        <div className="w-full rounded-full h-2 bg-gray-600">
                                            <div
                                                className="h-2 rounded-full transition-all duration-300 bg-blue-500"
                                                style={{ width: `${uploadProgress}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-gray-400">{uploadProgress}% complete</p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-300">
                                            Drop your PDF here or <span className="font-medium text-blue-400">browse files</span>
                                        </p>
                                        <p className="text-xs text-gray-400">PDF files only, up to 10MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* URL Input Tab */}
                    {activeTab === 'url' && (
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-700 rounded-lg">
                                <div className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center bg-gray-600">
                                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-300 text-center mb-3">
                                    Add a website URL to analyze its content
                                </p>
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://example.com/documentation"
                                    className="w-full px-3 py-2 bg-gray-600 text-white rounded-md border border-gray-500 focus:border-blue-400 focus:outline-none text-sm"
                                    disabled={isUploading}
                                />
                            </div>

                            {isUploading && (
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-300 text-center">Processing website...</p>
                                    <div className="w-full rounded-full h-2 bg-gray-600">
                                        <div
                                            className="h-2 rounded-full transition-all duration-300 bg-blue-500"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">{uploadProgress}% complete</p>
                                </div>
                            )}

                            <button
                                onClick={handleUrlUpload}
                                disabled={isUploading || !urlInput.trim()}
                                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-md transition-colors font-medium"
                            >
                                {isUploading ? 'Processing...' : 'Add Website'}
                            </button>
                        </div>
                    )}

                    {/* YouTube Input Tab */}
                    {activeTab === 'youtube' && (
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-700 rounded-lg">
                                <div className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center bg-red-600">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-300 text-center mb-3">
                                    Add a YouTube video URL to analyze its transcript
                                </p>
                                <input
                                    type="url"
                                    value={youtubeInput}
                                    onChange={(e) => setYoutubeInput(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="w-full px-3 py-2 bg-gray-600 text-white rounded-md border border-gray-500 focus:border-blue-400 focus:outline-none text-sm"
                                    disabled={isUploading}
                                />
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                    Note: Video must have captions/subtitles available
                                </p>
                            </div>

                            {isUploading && (
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-300 text-center">Processing video transcript...</p>
                                    <div className="w-full rounded-full h-2 bg-gray-600">
                                        <div
                                            className="h-2 rounded-full transition-all duration-300 bg-blue-500"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">{uploadProgress}% complete</p>
                                </div>
                            )}

                            <button
                                onClick={handleYoutubeUpload}
                                disabled={isUploading || !youtubeInput.trim()}
                                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-md transition-colors font-medium"
                            >
                                {isUploading ? 'Processing...' : 'Add YouTube Video'}
                            </button>
                        </div>
                    )}

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-white">Added Sources</h3>
                            {uploadedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg group">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        <div className={`w-8 h-8 rounded flex items-center justify-center ${file.type === 'youtube' ? 'bg-red-100' :
                                                file.type === 'website' ? 'bg-blue-100' :
                                                    'bg-red-100'
                                            }`}>
                                            {file.type === 'youtube' ? (
                                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                                </svg>
                                            ) : file.type === 'website' ? (
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                            <p className="text-xs text-gray-400">
                                                {file.size} • {file.type === 'youtube' ? 'YouTube' : file.type === 'website' ? 'Website' : 'PDF'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="flex-shrink-0 ml-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded p-1 transition-all duration-200"
                                        title="Remove source"
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
            </div>
        </div>
    );
}
