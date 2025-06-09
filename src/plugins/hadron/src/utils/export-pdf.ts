import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { TimeSeriesData, RootCauseDistribution, ModelPerformanceData, SeverityTrendData } from '../interfaces/analytics';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface ExportPDFOptions {
  title?: string;
  timeRange?: { start: Date; end: Date };
  includeCharts?: boolean;
}

export async function exportAnalyticsToPDF(
  data: {
    timeSeriesData?: TimeSeriesData | null;
    rootCauseData?: RootCauseDistribution | null;
    modelPerformance?: ModelPerformanceData[];
    severityTrends?: SeverityTrendData | null;
  },
  options: ExportPDFOptions = {}
) {
  const {
    title = 'Analytics Report',
    timeRange,
    includeCharts = true
  } = options;

  // Create new PDF document
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Generated date and time range
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 5;

  if (timeRange) {
    doc.text(
      `Period: ${format(timeRange.start, 'PP')} - ${format(timeRange.end, 'PP')}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    yPosition += 10;
  }

  doc.setTextColor(0);

  // Executive Summary
  if (data.timeSeriesData || data.rootCauseData) {
    yPosition = addSection(doc, 'Executive Summary', yPosition);
    
    const summaryData = [];
    if (data.timeSeriesData) {
      summaryData.push(['Total Crashes', data.timeSeriesData.totalCount.toLocaleString()]);
      summaryData.push(['Data Points', data.timeSeriesData.series.length.toString()]);
      summaryData.push(['Granularity', data.timeSeriesData.granularity]);
    }
    if (data.rootCauseData) {
      const topCause = data.rootCauseData.categories[0];
      if (topCause) {
        summaryData.push(['Top Root Cause', `${topCause.category} (${topCause.percentage.toFixed(1)}%)`]);
      }
    }

    doc.autoTable({
      startY: yPosition,
      head: [],
      body: summaryData,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin }
    });
    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // Time Series Data
  if (data.timeSeriesData && data.timeSeriesData.series.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 50);
    yPosition = addSection(doc, 'Crash Frequency Over Time', yPosition);

    const tableData = data.timeSeriesData.series.map(point => [
      format(new Date(point.timestamp), 'PPp'),
      point.count.toString(),
      point.metadata?.platform || '-',
      point.metadata?.severity || '-'
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Timestamp', 'Count', 'Platform', 'Severity']],
      body: tableData.slice(0, 20), // Limit to first 20 rows
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin }
    });
    yPosition = doc.lastAutoTable.finalY + 10;

    if (tableData.length > 20) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        `Showing 20 of ${tableData.length} records. Full data available in CSV export.`,
        margin,
        yPosition
      );
      yPosition += 10;
      doc.setTextColor(0);
    }
  }

  // Root Cause Distribution
  if (data.rootCauseData && data.rootCauseData.categories.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 50);
    yPosition = addSection(doc, 'Root Cause Analysis', yPosition);

    const tableData = data.rootCauseData.categories.map(cat => [
      cat.category,
      cat.count.toString(),
      `${cat.percentage.toFixed(1)}%`,
      cat.trend > 0 ? `↑ ${cat.trend.toFixed(1)}%` : `↓ ${Math.abs(cat.trend).toFixed(1)}%`
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Root Cause', 'Count', 'Percentage', 'Trend']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin }
    });
    yPosition = doc.lastAutoTable.finalY + 10;

    // Add insights
    if (data.rootCauseData.insights.length > 0) {
      yPosition = addSubSection(doc, 'Key Insights', yPosition);
      data.rootCauseData.insights.forEach(insight => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${insight.title}`, margin, yPosition);
        yPosition += 5;
        
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(insight.description, pageWidth - 2 * margin - 10);
        doc.text(lines, margin + 5, yPosition);
        yPosition += lines.length * 4;
        
        if (insight.recommendation) {
          doc.setTextColor(0, 0, 255);
          const recLines = doc.splitTextToSize(
            `Recommendation: ${insight.recommendation}`,
            pageWidth - 2 * margin - 10
          );
          doc.text(recLines, margin + 5, yPosition);
          yPosition += recLines.length * 4 + 5;
          doc.setTextColor(0);
        }
      });
    }
  }

  // Model Performance
  if (data.modelPerformance && data.modelPerformance.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 50);
    yPosition = addSection(doc, 'LLM Model Performance', yPosition);

    const tableData = data.modelPerformance.map(model => [
      model.modelName,
      model.requestCount.toString(),
      `${(model.successRate * 100).toFixed(1)}%`,
      `${(model.accuracy * 100).toFixed(1)}%`,
      `${model.averageLatency}ms`
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Model', 'Requests', 'Success Rate', 'Accuracy', 'Avg Latency']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin }
    });
    yPosition = doc.lastAutoTable.finalY + 10;
  }

  // Save the PDF
  const filename = `analytics-report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`;
  doc.save(filename);

  return filename;
}

function addSection(doc: jsPDF, title: string, yPosition: number): number {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPosition);
  return yPosition + 8;
}

function addSubSection(doc: jsPDF, title: string, yPosition: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPosition);
  return yPosition + 6;
}

function checkPageBreak(doc: jsPDF, yPosition: number, requiredSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  
  if (yPosition + requiredSpace > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return yPosition;
}