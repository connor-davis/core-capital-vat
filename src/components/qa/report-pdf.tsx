import {
  Document,
  PDFDownloadLink,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';

type ReportCriterion = {
  id: number;
  name: string;
  rationale: string;
  score: number;
};

type ReportResult = {
  confidence: number;
  criteria: Array<ReportCriterion>;
  overallScore: number;
  passed: boolean;
};

type ReportPdfProps = {
  createdAt: number;
  fileName: string;
  result: ReportResult;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 32,
  },
  title: {
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    color: '#475569',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    padding: 10,
  },
  summaryLabel: {
    color: '#475569',
    fontSize: 10,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  criterion: {
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  criterionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  criterionTitle: {
    fontWeight: 700,
    width: '80%',
  },
  badge: {
    color: '#1d4ed8',
    fontSize: 10,
    fontWeight: 700,
  },
  rationale: {
    color: '#475569',
    lineHeight: 1.4,
  },
});

function QaReportDocument({ createdAt, fileName, result }: ReportPdfProps) {
  return (
    <Document title={`QA Report - ${fileName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Lesson QA report</Text>
        <Text style={styles.subtitle}>
          {fileName} • Uploaded {new Date(createdAt).toLocaleString()}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Overall score</Text>
            <Text style={styles.summaryValue}>
              {Math.round(result.overallScore)}%
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Confidence</Text>
            <Text style={styles.summaryValue}>
              {Math.round(result.confidence * 100)}%
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Decision</Text>
            <Text style={styles.summaryValue}>
              {result.passed ? 'Passed' : 'Needs review'}
            </Text>
          </View>
        </View>

        {result.criteria.map((criterion) => (
          <View key={criterion.id} style={styles.criterion}>
            <View style={styles.criterionHeader}>
              <Text style={styles.criterionTitle}>
                {criterion.id}. {criterion.name}
              </Text>
              <Text style={styles.badge}>Score {criterion.score}/2</Text>
            </View>
            <Text style={styles.rationale}>{criterion.rationale}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function ReportPdfDownloadButton({
  createdAt,
  fileName,
  result,
}: ReportPdfProps) {
  return (
    <PDFDownloadLink
      className={buttonVariants({ variant: 'outline' })}
      document={
        <QaReportDocument
          createdAt={createdAt}
          fileName={fileName}
          result={result}
        />
      }
      fileName={`${fileName.replace(/\.[^.]+$/, '')}-qa-report.pdf`}
    >
      {({ loading }): ReactNode =>
        loading ? 'Preparing PDF...' : 'Download PDF'
      }
    </PDFDownloadLink>
  );
}
