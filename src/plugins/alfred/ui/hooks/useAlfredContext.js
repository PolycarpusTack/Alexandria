"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlfredProvider = exports.useAlfredContext = void 0;
const react_1 = __importStar(require("react"));
const client_logger_1 = require("../../../../client/utils/client-logger");
const logger = (0, client_logger_1.createClientLogger)({ serviceName: 'alfred-context' });
const AlfredContext = (0, react_1.createContext)({
    alfredService: null,
    streamingService: null,
    projectAnalyzer: null,
    codeGenerator: null,
    templateManager: null,
    isLoading: true
});
const useAlfredContext = () => {
    const context = (0, react_1.useContext)(AlfredContext);
    if (!context) {
        throw new Error('useAlfredContext must be used within AlfredProvider');
    }
    return context;
};
exports.useAlfredContext = useAlfredContext;
const AlfredProvider = ({ children }) => {
    const [services, setServices] = (0, react_1.useState)({
        alfredService: null,
        streamingService: null,
        projectAnalyzer: null,
        codeGenerator: null,
        templateManager: null,
        isLoading: true
    });
    (0, react_1.useEffect)(() => {
        // Try to get services from window.alfred
        const initializeServices = () => {
            if (window.alfred?.services) {
                logger.info('Using real Alfred services from window.alfred');
                const { alfredService, streamingService, projectAnalyzer, codeGenerator, templateManager } = window.alfred.services;
                setServices({
                    alfredService,
                    streamingService,
                    projectAnalyzer,
                    codeGenerator,
                    templateManager,
                    isLoading: false
                });
            }
            else {
                logger.warn('Alfred services not available, creating mock services');
                // Create mock services for development
                const mockServices = createMockServices();
                setServices({
                    ...mockServices,
                    isLoading: false
                });
            }
        };
        // Check if window.alfred is already available
        if (window.alfred) {
            initializeServices();
        }
        else {
            // Wait for alfred to be available
            const checkInterval = setInterval(() => {
                if (window.alfred) {
                    clearInterval(checkInterval);
                    initializeServices();
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!services.alfredService) {
                    logger.error('Alfred services not available after timeout, using mocks');
                    const mockServices = createMockServices();
                    setServices({
                        ...mockServices,
                        isLoading: false
                    });
                }
            }, 5000);
        }
    }, []);
    return (react_1.default.createElement(AlfredContext.Provider, { value: services }, children));
};
exports.AlfredProvider = AlfredProvider;
// Create mock services for development
function createMockServices() {
    const mockAlfredService = {
        async getSessions() {
            return [];
        },
        async getSession(id) {
            return {
                id,
                name: 'Mock Session',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
        },
        async createSession(projectPath) {
            return {
                id: 'mock-' + Date.now(),
                name: 'New Session',
                projectPath,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
        },
        async sendMessage(sessionId, content) {
            return {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: 'This is a mock response from Alfred.',
                timestamp: new Date()
            };
        },
        async generateCode(request) {
            return {
                code: '// Mock generated code\nconsole.log("Hello from Alfred!");',
                language: 'javascript'
            };
        },
        async analyzeProject(projectPath) {
            return {
                projectPath,
                structure: {
                    files: [],
                    statistics: {
                        totalFiles: 0,
                        languageBreakdown: {}
                    }
                }
            };
        }
    };
    const mockStreamingService = {
        streamChat: async function* (sessionId, message) {
            yield 'This ';
            yield 'is ';
            yield 'a ';
            yield 'mock ';
            yield 'streaming ';
            yield 'response.';
        },
        cancelAllStreams: () => { },
        removeAllListeners: () => { }
    };
    const mockProjectAnalyzer = {
        analyzeProject: async (path) => ({
            projectPath: path,
            structure: { files: [], statistics: { totalFiles: 0, languageBreakdown: {} } }
        })
    };
    const mockCodeGenerator = {
        generateCode: async (request) => ({
            code: '// Mock code',
            language: 'javascript'
        })
    };
    const mockTemplateManager = {
        getTemplates: async () => [],
        createTemplate: async (template) => template,
        deleteTemplate: async (id) => { }
    };
    return {
        alfredService: mockAlfredService,
        streamingService: mockStreamingService,
        projectAnalyzer: mockProjectAnalyzer,
        codeGenerator: mockCodeGenerator,
        templateManager: mockTemplateManager
    };
}
