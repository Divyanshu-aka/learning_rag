'use client';

import { useState, useRef, useEffect } from 'react';
import TopBar from './components/TopBar';
import FileUpload from './components/FileUpload';

export default function Home() {
  // state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef(null);

  // effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // handlers
  const handleNewNotebook = () => {
    setMessages([]);
    setUploadedFiles([]);
    setSelectedFile(null);
    setShowUpload(false);
  };

  const handleSettingsClick = () => {
    alert('Settings functionality coming soon!');
  };

  const handleFileUploaded = (fileInfo) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev, fileInfo];
      // If this is the first file or no file is selected, select this one
      if (prev.length === 0 || !selectedFile) {
        setSelectedFile(fileInfo);
      }
      return newFiles;
    });
    setShowUpload(false);
  };

  const handleFileRemoved = async (fileIndex) => {
    const file = uploadedFiles[fileIndex];
    if (!file) return;

    try {
      // Use the server filename from uploadData (which was used during indexing)
      const filenameToDelete = file.serverFilename || file.name;

      // Call the delete API to remove from Qdrant collection
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: filenameToDelete }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete file from collection');
      }

      // Remove from local state
      setUploadedFiles((prev) => {
        const newFiles = prev.filter((_, index) => index !== fileIndex);

        // If the removed file was selected, select the first remaining file
        if (selectedFile && selectedFile.serverFilename === file.serverFilename) {
          setSelectedFile(newFiles.length > 0 ? newFiles[0] : null);
        }

        return newFiles;
      });

      console.log(`File ${filenameToDelete} removed successfully`);
    } catch (error) {
      console.error('Error removing file:', error);
      alert('Failed to remove file. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Check if a file is selected
    if (!selectedFile) {
      alert('Please select a file to chat with first.');
      return;
    }

    const userMessage = inputValue;
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    const collectionNameToUse = selectedFile.serverFilename || selectedFile.name;
    console.log('Sending chat request:', {
      userQuery: userMessage,
      collectionName: collectionNameToUse,
      selectedFile: selectedFile
    });

    try {
      const response = await fetch('/api/files/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: userMessage,
          collectionName: collectionNameToUse
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.result }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Sorry, I encountered an error: ${data.error}. Please try again.` },
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // render
  return (
    <div className="h-screen flex flex-col bg-gray-700">
      <TopBar uploadedFiles={uploadedFiles} onNewNotebook={handleNewNotebook} onSettingsClick={handleSettingsClick} />

      <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
        {/* Sources Panel */}
        <aside className="w-80 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Sources</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowUpload(!showUpload)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition-colors">+ Add</button>
                <button className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-3 rounded transition-colors">Discover</button>
              </div>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              {uploadedFiles.length > 0 ? (
                uploadedFiles.map((file, index) => {
                  const isSelected = selectedFile && selectedFile.serverFilename === file.serverFilename;
                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors group cursor-pointer ${isSelected
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${isSelected ? 'bg-blue-500' : 'bg-gray-600'
                        }`}>
                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-white">{file.name}</p>
                        <p className={`text-xs ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                          {file.size} • PDF {isSelected ? '• Active' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" title="Indexed"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent file selection when clicking delete
                            handleFileRemoved(index);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all duration-200 p-1"
                          title="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center bg-gray-700">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Saved sources will appear here</p>
                  <p className="text-xs text-gray-500 mt-1">Click Add source above to add PDFs, websites, text, videos or audio files. Or import a file directly from Google Drive.</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Chat Panel */}
        <section className="flex-1 bg-gray-800 rounded-lg flex flex-col overflow-hidden min-h-0">
          <div className="px-5 py-3 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Chat</h2>
              {selectedFile && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Chatting with: {selectedFile.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-blue-500/20">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium mb-1 text-white">
                    {uploadedFiles.length === 0 ? "Add a source to get started" : "Select a file to chat with"}
                  </h2>
                  <p className="mb-6 text-sm text-gray-400">
                    {uploadedFiles.length === 0
                      ? "Upload some documents first, then ask questions about them."
                      : selectedFile
                        ? "Ask questions about your uploaded documents and I'll help you find answers."
                        : "Click on a file in the sources panel to start chatting with it."}
                  </p>
                  <div className="flex items-center justify-center">
                    {uploadedFiles.length === 0 ? (
                      <button onClick={() => setShowUpload(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">Upload a source</button>
                    ) : !selectedFile ? (
                      <p className="text-xs text-gray-500">👈 Click on a file to select it</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                          {message.role === 'user' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className={`px-4 py-3 rounded-xl ${message.role === 'user' ? 'bg-blue-500/20 text-white' : 'bg-gray-700 text-white'}`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-3xl">
                      <div className="flex-shrink-0 mr-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                      </div>
                      <div className="px-4 py-3 rounded-xl bg-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400"></div>
                            <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm text-gray-400">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Footer input */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-700">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center bg-gray-700 rounded-lg px-4 py-2">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={uploadedFiles.length > 0 ? 'Start typing...' : 'Upload a source to get started'}
                      className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none text-sm"
                      rows={1}
                      disabled={isLoading || uploadedFiles.length === 0}
                    />
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-100 min-w-[72px] text-right">{uploadedFiles.length} {uploadedFiles.length === 1 ? 'source' : 'sources'}</div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading || uploadedFiles.length === 0}
                        className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                        aria-label="Send message"
                      >
                        <svg className="w-5 h-5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      {/* File Upload Modal */}
      <FileUpload
        onFileUploaded={handleFileUploaded}
        onFileRemoved={handleFileRemoved}
        uploadedFiles={uploadedFiles}
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </div>
  );
}
