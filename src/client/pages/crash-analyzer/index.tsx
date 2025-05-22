import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CrashLogDashboard } from './crash-log-dashboard';
import { CrashLogDetail } from './crash-log-detail';
import { CrashLogUpload } from './crash-log-upload';
import { CrashAnalyzerContext } from './crash-analyzer-context';

// Mock service implementation for demo purposes
const createMockCrashAnalyzerService = () => {
  // In-memory storage for demo
  let crashLogs: any[] = [];
  
  return {
    getAllCrashLogs: async () => {
      return Promise.resolve(crashLogs);
    },
    
    getCrashLogById: async (id: string) => {
      const log = crashLogs.find(log => log.id === id);
      return Promise.resolve(log || null);
    },
    
    analyzeLog: async (logId: string, content: string, metadata: any) => {
      // Generate a dummy analysis result
      const now = new Date();
      const newLog = {
        id: logId,
        title: metadata.fileName || `Crash log (${now.toLocaleString()})`,
        content,
        uploadedAt: now,
        userId: 'demo-user',
        metadata,
        parsedData: {
          timestamps: [],
          errorMessages: [{ message: 'NullPointerException', level: 'ERROR' }],
          stackTraces: [{ 
            message: 'null pointer exception in process()', 
            frames: [
              { functionName: 'process', fileName: 'Main.java', lineNumber: 42 },
              { functionName: 'run', fileName: 'Thread.java', lineNumber: 120 }
            ] 
          }],
          systemInfo: {
            osType: metadata.platform || 'Unknown',
            osVersion: 'Unknown',
            deviceModel: metadata.device || 'Unknown',
            appVersion: metadata.appVersion || 'Unknown'
          },
          logLevel: { ERROR: 3, WARN: 5, INFO: 12 },
          metadata: {}
        },
        analysis: {
          id: `analysis-${Date.now()}`,
          crashLogId: logId,
          timestamp: now,
          primaryError: 'NullPointerException in Main.process()',
          failingComponent: 'Main.java',
          potentialRootCauses: [
            {
              cause: 'Null reference passed to process() method',
              confidence: 0.85,
              explanation: 'The process method is attempting to access a property of a null object.',
              category: 'null-reference',
              supportingEvidence: [
                {
                  description: 'Stack trace points to line 42 in Main.java',
                  location: 'Main.java:42',
                  snippet: 'result = object.getProperty();'
                }
              ]
            },
            {
              cause: 'Uninitialized variable in process method',
              confidence: 0.65,
              explanation: 'The process method likely has an uninitialized variable.',
              category: 'initialization',
              supportingEvidence: [
                {
                  description: 'Error occurs in process method',
                  location: 'Main.java:42',
                  snippet: 'process()'
                }
              ]
            }
          ],
          troubleshootingSteps: [
            'Check the object passed to process() for null values',
            'Add null checks before accessing object properties',
            'Review the initialization of variables in the process method'
          ],
          summary: 'NullPointerException caused by accessing properties of a null object in the process() method.',
          llmModel: 'llama2:8b-chat-q4',
          confidence: 0.85,
          inferenceTime: 1200
        }
      };
      
      // Add to our in-memory store
      crashLogs.push(newLog);
      
      return Promise.resolve(newLog.analysis);
    },
    
    deleteCrashLog: async (id: string) => {
      crashLogs = crashLogs.filter(log => log.id !== id);
      return Promise.resolve(true);
    }
  };
};

export const CrashAnalyzerRoutes: React.FC = () => {
  const [service] = useState(() => createMockCrashAnalyzerService());
  
  return (
    <CrashAnalyzerContext.Provider value={{ service }}>
      <Routes>
        <Route path="/" element={<CrashLogDashboard />} />
        <Route path="/upload" element={<CrashLogUpload />} />
        <Route path="/logs/:logId" element={<CrashLogDetail />} />
        <Route path="*" element={<Navigate to="/crash-analyzer" replace />} />
      </Routes>
    </CrashAnalyzerContext.Provider>
  );
};