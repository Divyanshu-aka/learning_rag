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
    setShowUpload(false);
  };

  const handleSettingsClick = () => {
    alert('Settings functionality coming soon!');
  };

  const handleFileUploaded = (fileInfo) => {
    setUploadedFiles((prev) => [...prev, fileInfo]);
    setShowUpload(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/files/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: userMessage }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.result }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <TopBar uploadedFiles={uploadedFiles} onNewNotebook={handleNewNotebook} onSettingsClick={handleSettingsClick} />

      <div className="flex-1 flex gap-3 p-4">
        {/* Sources Panel */}
        <aside className="w-[360px] flex-shrink-0 card overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="px-4 py-3 panel-header">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sources</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowUpload(!showUpload)} className="soft-btn text-xs py-1 px-2">+ Add</button>
                <button className="soft-btn text-xs py-1 px-2">Discover</button>
              </div>
            </div>
          </div>

          <div className="p-4 overflow-y-auto scrollbar-thin" style={{ flex: 1 }}>
            {showUpload && (
              <div className="mb-4">
                <FileUpload onFileUploaded={handleFileUploaded} uploadedFiles={uploadedFiles} />
              </div>
            )}

            <div className="space-y-2">
              {uploadedFiles.length > 0 ? (
                uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 card hover:shadow-sm transition">
                    <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: '#404249' }}>
                      <svg className="w-4 h-4" style={{ color: '#cbd5e1' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{file.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{file.size} • PDF</p>
                    </div>
                    <div className="w-2 h-2 rounded-full" title="Indexed" style={{ background: '#34d399' }}></div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                    <svg className="w-6 h-6" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Saved sources will appear here</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Chat Panel */}
        <section className="flex-1 card flex flex-col overflow-hidden">
          <div className="px-5 py-3 panel-header">
            <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>Chat</h2>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--primary) 20%, transparent)' }}>
                    <svg className="w-6 h-6" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--text)' }}>Add a source to get started</h2>
                  <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {uploadedFiles.length > 0
                      ? "Ask questions about your uploaded documents and I'll help you find answers."
                      : "Upload some documents first, then ask questions about them."}
                  </p>
                  <div className="flex items-center justify-center">
                    <button onClick={() => setShowUpload(true)} className="soft-btn">Upload a source</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'text-white' : ''}`} style={{ background: message.role === 'user' ? 'var(--primary)' : 'var(--muted)', color: message.role === 'user' ? 'white' : '#64748b' }}>
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
                      <div className={`px-4 py-3 rounded-[12px] card`} style={{ background: message.role === 'user' ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface)', color: 'var(--text)' }}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-3xl">
                      <div className="flex-shrink-0 mr-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)', color: '#64748b' }}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                      </div>
                      <div className="px-4 py-3 rounded-[12px] card" style={{ background: 'var(--surface)' }}>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94a3b8' }}></div>
                            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94a3b8', animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94a3b8', animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Thinking...</span>
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
          <div className="px-5 py-4 panel-header" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="pill-area px-4 py-2" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={uploadedFiles.length > 0 ? 'Upload a source to get started' : 'Upload a source to get started'}
                      className="w-full bg-transparent resize-none focus:outline-none text-sm"
                      rows={1}
                      disabled={isLoading || uploadedFiles.length === 0}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-[var(--text-muted)] min-w-[72px] text-right">{uploadedFiles.length} {uploadedFiles.length === 1 ? 'source' : 'sources'}</div>
                  <button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading || uploadedFiles.length === 0} className="icon-btn" aria-label="Send message">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
