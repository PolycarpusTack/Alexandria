import React, { useState, useEffect } from 'react';
import apiClient from '../../../../utils/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../../../../ui/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../../../../ui/components/ui/table";
import {
  Badge,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
} from "../../../../ui/components";
import { SecurityScanIcon, ShieldCheckIcon, ShieldAlertIcon, ShieldXIcon } from "lucide-react";

interface FileScanResult {
  fileId: string;
  filename: string;
  isMalicious: boolean;
  detectedThreats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  scannedAt: string;
  quarantined?: boolean;
  quarantinePath?: string;
}

interface QuarantinedFile {
  id: string;
  filename: string;
  metadata?: {
    securityScan?: {
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    };
    quarantinedAt?: string;
  };
}

interface SecurityScanResultsProps {
  sessionId?: string;
  fileId?: string;
  onScanComplete?: (results: FileScanResult[]) => void;
  readOnly?: boolean;
}

/**
 * Component to display security scan results and manage quarantined files
 */
export const SecurityScanResults: React.FC<SecurityScanResultsProps> = ({
  sessionId,
  fileId,
  onScanComplete,
  readOnly = false,
}) => {
  const [scanResults, setScanResults] = useState<FileScanResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quarantinedFiles, setQuarantinedFiles] = useState<QuarantinedFile[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Load quarantined files on component mount
  useEffect(() => {
    if (!readOnly) {
      loadQuarantinedFiles();
    }
  }, [readOnly]);

  // Load quarantined files
  const loadQuarantinedFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/security/quarantine');
      setQuarantinedFiles(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load quarantined files');
      setLoading(false);
      console.error('Error loading quarantined files:', err);
    }
  };

  // Scan a single file
  const scanFile = async (fileId: string, autoQuarantine: boolean = false) => {
    if (!fileId) return;

    try {
      setLoading(true);
      setActionInProgress(fileId);
      const response = await apiClient.post(`/security/scan/${fileId}`, {
        autoQuarantine,
      });
      
      setScanResults([response.data]);
      if (onScanComplete) {
        onScanComplete([response.data]);
      }
      
      // Refresh quarantined files if we auto-quarantined
      if (autoQuarantine && !readOnly) {
        await loadQuarantinedFiles();
      }
      
      setLoading(false);
      setActionInProgress(null);
    } catch (err) {
      setError('Failed to scan file');
      setLoading(false);
      setActionInProgress(null);
      console.error('Error scanning file:', err);
    }
  };

  // Batch scan all files in a session
  const batchScanSession = async (sessionId: string, autoQuarantine: boolean = false) => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setActionInProgress(sessionId);
      const response = await apiClient.post(`/security/batch-scan/${sessionId}`, {
        autoQuarantine,
      });
      
      setScanResults(response.data);
      if (onScanComplete) {
        onScanComplete(response.data);
      }
      
      // Refresh quarantined files if we auto-quarantined
      if (autoQuarantine && !readOnly) {
        await loadQuarantinedFiles();
      }
      
      setLoading(false);
      setActionInProgress(null);
    } catch (err) {
      setError('Failed to batch scan session files');
      setLoading(false);
      setActionInProgress(null);
      console.error('Error batch scanning files:', err);
    }
  };

  // Release a file from quarantine
  const releaseFromQuarantine = async (fileId: string, force: boolean = false) => {
    try {
      setActionInProgress(fileId);
      await apiClient.post(`/security/quarantine/release/${fileId}`, {
        force,
      });
      
      // Refresh quarantined files
      await loadQuarantinedFiles();
      setActionInProgress(null);
    } catch (err) {
      setError('Failed to release file from quarantine');
      setActionInProgress(null);
      console.error('Error releasing file:', err);
    }
  };

  // Function to render risk level as a badge
  const renderRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <Badge variant="success">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
      case 'critical':
        return (
          <Badge variant="destructive" className="bg-red-700">
            Critical Risk
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Render threat icon based on risk level
  const renderThreatIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low':
        return <ShieldCheckIcon className="w-5 h-5 text-green-500" />;
      case 'medium':
        return <ShieldAlertIcon className="w-5 h-5 text-amber-500" />;
      case 'high':
      case 'critical':
        return <ShieldXIcon className="w-5 h-5 text-red-500" />;
      default:
        return <SecurityScanIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Scan Controls */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SecurityScanIcon className="w-5 h-5" />
              Security Scanner
            </CardTitle>
            <CardDescription>
              Scan files for security issues and manage quarantined files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {fileId && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Scan Single File</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => scanFile(fileId, false)}
                      disabled={loading || actionInProgress !== null}
                      variant="outline"
                      size="small"
                    >
                      Scan Only
                    </Button>
                    <Button
                      onClick={() => scanFile(fileId, true)}
                      disabled={loading || actionInProgress !== null}
                      variant="default"
                      size="small"
                    >
                      Scan & Quarantine
                    </Button>
                  </div>
                </div>
              )}

              {sessionId && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Batch Scan Session</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => batchScanSession(sessionId, false)}
                      disabled={loading || actionInProgress !== null}
                      variant="outline"
                      size="small"
                    >
                      Scan All Files
                    </Button>
                    <Button
                      onClick={() => batchScanSession(sessionId, true)}
                      disabled={loading || actionInProgress !== null}
                      variant="default"
                      size="small"
                    >
                      Scan & Quarantine All
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          {loading && (
            <CardFooter>
              <div className="w-full text-center text-sm text-muted-foreground">
                {actionInProgress ? (
                  <span>Processing {actionInProgress}...</span>
                ) : (
                  <span>Loading...</span>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scan Results */}
      {scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
            <CardDescription>
              {scanResults.length} file(s) scanned on{" "}
              {new Date(scanResults[0].scannedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Threats</TableHead>
                  <TableHead>Quarantined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanResults.map((result) => (
                  <TableRow key={result.fileId}>
                    <TableCell>
                      {renderThreatIcon(result.riskLevel)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {result.filename}
                    </TableCell>
                    <TableCell>{renderRiskBadge(result.riskLevel)}</TableCell>
                    <TableCell>
                      {result.detectedThreats.length > 0 ? (
                        <ul className="text-xs list-disc pl-4">
                          {result.detectedThreats.map((threat, idx) => (
                            <li key={idx}>{threat}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No threats detected
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.quarantined ? "Yes" : "No"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quarantined Files */}
      {!readOnly && quarantinedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quarantined Files</CardTitle>
            <CardDescription>
              Files that have been quarantined due to security concerns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Quarantined At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarantinedFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      {file.filename}
                    </TableCell>
                    <TableCell>
                      {renderRiskBadge(
                        file.metadata?.securityScan?.riskLevel || "unknown"
                      )}
                    </TableCell>
                    <TableCell>
                      {file.metadata?.quarantinedAt
                        ? new Date(
                            file.metadata.quarantinedAt
                          ).toLocaleString()
                        : "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            releaseFromQuarantine(file.id, false)
                          }
                          disabled={
                            actionInProgress === file.id ||
                            (file.metadata?.securityScan?.riskLevel === "high" ||
                              file.metadata?.securityScan?.riskLevel ===
                                "critical")
                          }
                          variant="outline"
                          size="small"
                        >
                          Release
                        </Button>
                        <Button
                          onClick={() => releaseFromQuarantine(file.id, true)}
                          disabled={actionInProgress === file.id}
                          variant="destructive"
                          size="small"
                        >
                          Force Release
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!loading && scanResults.length === 0 && !readOnly && quarantinedFiles.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <SecurityScanIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No scan results or quarantined files to display. Start a scan to see results.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityScanResults;