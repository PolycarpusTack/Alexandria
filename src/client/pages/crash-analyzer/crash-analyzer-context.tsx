import { createContext, useContext } from 'react';

interface CrashAnalyzerService {
  getAllCrashLogs: () => Promise<any[]>;
  getCrashLogById: (id: string) => Promise<any | null>;
  analyzeLog: (logId: string, content: string, metadata: any) => Promise<any>;
  deleteCrashLog: (id: string) => Promise<boolean>;
}

interface CrashAnalyzerContextType {
  service: CrashAnalyzerService;
}

export const CrashAnalyzerContext = createContext<CrashAnalyzerContextType | null>(null);

export const useCrashAnalyzerContext = () => {
  const context = useContext(CrashAnalyzerContext);
  if (!context) {
    throw new Error('useCrashAnalyzerContext must be used within a CrashAnalyzerContext.Provider');
  }
  return context;
};

// Alias for convenience
export const useCrashAnalyzer = useCrashAnalyzerContext;