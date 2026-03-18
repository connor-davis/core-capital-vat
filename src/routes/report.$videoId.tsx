import {
  ArrowLeft,
  CircleNotch,
  DownloadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import { Link, createFileRoute } from '@tanstack/react-router';
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useAction,
  useQuery,
} from 'convex/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { ReportPdfDownloadButton } from '@/components/qa/report-pdf';
import { VideoStatusBadge } from '@/components/qa/video-status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { asVideoId } from '@/lib/convex-ids';

import { api } from '../../convex/_generated/api';
import {
  RUBRIC_CRITERIA,
  formatConfidence,
  formatOverallScore,
} from '../../shared/qa';

export const Route = createFileRoute('/report/$videoId')({
  component: ReportRoute,
});

function ReportRoute() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            QA report
          </p>
          <h1 className="text-2xl font-semibold">Lesson review report</h1>
        </div>
        <Link className={buttonVariants({ variant: 'outline' })} to="/">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </div>

      <AuthLoading>
        <StateCard
          icon={<CircleNotch className="size-5 animate-spin" />}
          message="Loading report..."
        />
      </AuthLoading>

      <Authenticated>
        <ReportContent />
      </Authenticated>

      <Unauthenticated>
        <StateCard
          icon={<WarningCircle className="size-5 text-muted-foreground" />}
          message="You must sign in to view this report."
        />
      </Unauthenticated>
    </div>
  );
}

function ReportContent() {
  const { videoId } = Route.useParams();
  const currentVideoId = asVideoId(videoId);
  const report = useQuery(api.videos.getForViewer, {
    videoId: currentVideoId,
  });
  const sendReportEmail = useAction(api.reporting.sendReportEmail);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  if (report === undefined) {
    return (
      <StateCard
        icon={<CircleNotch className="size-5 animate-spin" />}
        message="Loading report data..."
      />
    );
  }

  if (report === null) {
    return (
      <StateCard
        icon={<WarningCircle className="size-5 text-muted-foreground" />}
        message="This report could not be found for the current reviewer."
      />
    );
  }

  const currentReport = report;

  function downloadJsonReport() {
    const reportJson = JSON.stringify(currentReport.result ?? {}, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${currentReport.fileName.replace(/\.[^.]+$/, '')}-qa-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendEmail() {
    if (!recipientEmail) {
      setEmailFeedback('Enter an email address before sending the report.');
      return;
    }

    setIsSendingEmail(true);
    setEmailFeedback(null);

    try {
      await sendReportEmail({
        recipientEmail,
        reportUrl: window.location.href,
        videoId: currentVideoId,
      });
      setEmailFeedback(`Report sent to ${recipientEmail}.`);
    } catch (error) {
      setEmailFeedback(
        error instanceof Error
          ? error.message
          : 'Failed to send the report email.'
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card className="border border-border/60">
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{currentReport.fileName}</CardTitle>
              <VideoStatusBadge status={currentReport.status} />
            </div>
            <CardDescription>
              Uploaded {new Date(currentReport.createdAt).toLocaleString()}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadJsonReport}>
              <DownloadSimple className="size-4" />
              Download JSON
            </Button>
            {currentReport.result ? (
              <ReportPdfDownloadButton
                createdAt={currentReport.createdAt}
                fileName={currentReport.fileName}
                result={currentReport.result}
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {currentReport.result ? (
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                helper={currentReport.result.passed ? 'Passed' : 'Needs review'}
                label="Overall score"
                value={formatOverallScore(currentReport.result.overallScore)}
              />
              <SummaryCard
                helper="Gemini confidence"
                label="Confidence"
                value={formatConfidence(currentReport.result.confidence)}
              />
              <SummaryCard
                helper="Report record expiry"
                label="Retention"
                value={new Date(currentReport.retainUntil).toLocaleDateString()}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
              This upload is still being processed. Refresh later or return to
              the dashboard to monitor progress.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Email report link</CardTitle>
          <CardDescription>
            Send the completed report through Resend once the API key and sender
            are configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="reviewer@example.com"
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
            <Button
              disabled={!currentReport.result || isSendingEmail}
              onClick={() => void handleSendEmail()}
            >
              {isSendingEmail ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send report'
              )}
            </Button>
          </div>
          {emailFeedback ? (
            <div className="rounded-lg border border-border/60 bg-muted/25 p-3 text-sm text-muted-foreground">
              {emailFeedback}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Rubric breakdown</CardTitle>
          <CardDescription>
            All 21 criteria are stored as structured JSON so QA reviewers can
            audit the score.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentReport.result
            ? currentReport.result.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="rounded-xl border border-border/60 bg-card/60 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {criterion.id}. {criterion.name}
                    </p>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Score {criterion.score}/2
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {criterion.rationale}
                  </p>
                </div>
              ))
            : RUBRIC_CRITERIA.map((criterion) => (
                <div
                  key={criterion.id}
                  className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground"
                >
                  {criterion.id}. {criterion.name}
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function StateCard({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
        {icon}
        <span>{message}</span>
      </CardContent>
    </Card>
  );
}
