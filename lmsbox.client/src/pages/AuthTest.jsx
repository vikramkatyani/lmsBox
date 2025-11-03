import React, { useState, useEffect } from 'react';
import { getAuthToken, isAuthenticated, getUserRole, decodeToken } from '../utils/auth';

export default function AuthTest() {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const checkAuth = () => {
    addLog('🔍 Checking authentication...');
    
    const token = getAuthToken();
    const authenticated = isAuthenticated();
    const role = getUserRole();
    
    const rawToken = localStorage.getItem('token');
    const rawExpiration = localStorage.getItem('tokenExpiration');
    
    let decoded = null;
    if (token) {
      decoded = decodeToken(token);
    }
    
    const info = {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      isAuthenticated: authenticated,
      role: role,
      rawToken: rawToken ? rawToken.substring(0, 30) + '...' : 'none',
      rawExpiration: rawExpiration,
      expirationDate: rawExpiration ? new Date(parseInt(rawExpiration)).toISOString() : 'N/A',
      currentTime: new Date().getTime(),
      currentTimeISO: new Date().toISOString(),
      timeUntilExpiry: rawExpiration ? Math.floor((parseInt(rawExpiration) - new Date().getTime()) / 1000 / 60) : 'N/A',
      decoded: decoded
    };
    
    setTokenInfo(info);
    addLog(`✅ Auth check complete: ${authenticated ? 'Authenticated' : 'Not authenticated'}`, authenticated ? 'success' : 'warning');
  };

  useEffect(() => {
    addLog('📱 AuthTest component mounted');
    checkAuth();
    
    // Auto-check every 10 seconds
    const interval = setInterval(() => {
      addLog('⏰ Auto-checking auth status...');
      checkAuth();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const clearStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    addLog('🗑️ Cleared all storage', 'warning');
    checkAuth();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Authentication Diagnostics</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Token Status</h2>
            <div className="space-x-2">
              <button
                onClick={checkAuth}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Status
              </button>
              <button
                onClick={clearStorage}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Clear Storage
              </button>
            </div>
          </div>
          
          {tokenInfo && (
            <div className="space-y-2 font-mono text-sm">
              <div className={`p-2 rounded ${tokenInfo.isAuthenticated ? 'bg-green-100' : 'bg-red-100'}`}>
                <strong>Authenticated:</strong> {tokenInfo.isAuthenticated ? '✅ YES' : '❌ NO'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Has Token:</strong> {tokenInfo.hasToken ? 'Yes' : 'No'} ({tokenInfo.tokenLength} chars)
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Role:</strong> {tokenInfo.role || 'None'}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Current Time:</strong> {tokenInfo.currentTimeISO}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Token Expiration:</strong> {tokenInfo.expirationDate}
              </div>
              <div className={`p-2 rounded ${typeof tokenInfo.timeUntilExpiry === 'number' && tokenInfo.timeUntilExpiry > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>Time Until Expiry:</strong> {tokenInfo.timeUntilExpiry} minutes
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Raw Token (preview):</strong> {tokenInfo.rawToken}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <strong>Raw Expiration:</strong> {tokenInfo.rawExpiration}
              </div>
              {tokenInfo.decoded && (
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Decoded Token:</strong>
                  <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(tokenInfo.decoded, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-sm font-mono ${
                  log.type === 'success' ? 'bg-green-50' :
                  log.type === 'warning' ? 'bg-yellow-50' :
                  log.type === 'error' ? 'bg-red-50' :
                  'bg-gray-50'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
