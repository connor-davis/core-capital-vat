import {
  CircleNotchIcon,
  FileArrowUpIcon,
  ShieldCheckIcon,
  SparkleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@workos-inc/authkit-react';
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from 'convex/react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { VideoStatusBadge } from '@/components/qa/video-status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { asStorageId } from '@/lib/convex-ids';
import { cn } from '@/lib/utils';

import { api } from '../../convex/_generated/api';
import { formatConfidence, formatOverallScore } from '../../shared/qa';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { user, signIn } = useAuth();

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="flex flex-1 flex-col gap-6 p-6">
        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">
                Upload, score, and review teaching sessions in one place.
              </CardTitle>
              <CardDescription>
                QA reviewers can upload lesson recordings, monitor Gemini
                processing, and open structured score reports without leaving
                the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <ValueCard
                description="Store recordings in Convex, queue scoring immediately, and track status end to end."
                icon={<FileArrowUpIcon className="size-4" />}
                title="Secure uploads"
              />
              <ValueCard
                description="Process recordings against a 21-point rubric and persist JSON results for review."
                icon={<SparkleIcon className="size-4" />}
                title="Gemini scoring"
              />
              <ValueCard
                description="Automatically clean up source videos and aged reports with scheduled Convex jobs."
                icon={<ShieldCheckIcon className="size-4" />}
                title="Retention controls"
              />
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle>Reviewer session</CardTitle>
              <CardDescription>
                {user
                  ? `Signed in as ${user.firstName ?? user.email}`
                  : 'Sign in with WorkOS to upload and review QA reports.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/35 p-4 text-sm text-muted-foreground">
                Only authenticated reviewers can create uploads, retry failed
                analyses, or view report details.
              </div>
              {!user ? (
                <Button className="w-full" onClick={() => void signIn()}>
                  Sign in to start reviewing
                </Button>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                  Your QA workspace is active. Upload a recording below to kick
                  off analysis.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <AuthLoading>
          <LoadingCard />
        </AuthLoading>

        <Authenticated>
          <DashboardContent />
        </Authenticated>

        <Unauthenticated>
          <SignedOutState />
        </Unauthenticated>
      </main>
    </>
  );
}

function LoadingCard() {
  return (
    <Card className="border border-border/60">
      <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <CircleNotchIcon className="size-4 animate-spin" />
        Loading your QA workspace...
      </CardContent>
    </Card>
  );
}

function SignedOutState() {
  return (
    <Card className="border border-dashed border-border/60">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <WarningCircleIcon className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">
          You need to sign in before uploading recordings.
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">
          Once authenticated, this dashboard will show upload progress,
          processing status, and report links for each teaching session.
        </p>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const videos = useQuery(api.videos.listForViewer, {});
  const generateUploadUrl = useMutation(api.videos.generateUploadUrl);
  const createVideo = useMutation(api.videos.createVideo);
  const retryVideo = useMutation(api.videos.retryVideo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const summary = useMemo(() => {
    const items = videos ?? [];
    return {
      total: items.length,
      completed: items.filter((video) => video.status === 'completed').length,
      processing: items.filter((video) => video.status === 'processing').length,
      failed: items.filter((video) => video.status === 'failed').length,
    };
  }, [videos]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      for (const file of Array.from(fileList)) {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}.`);
        }

        const payload = (await response.json()) as { storageId?: unknown };

        await createVideo({
          fileName: file.name,
          mimeType: file.type || 'video/mp4',
          sizeBytes: file.size,
          sourceStorageId: asStorageId(payload.storageId),
        });
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed unexpectedly.'
      );
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    void uploadFiles(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Uploads tracked" value={summary.total} />
        <MetricCard label="Completed" value={summary.completed} />
        <MetricCard label="Processing" value={summary.processing} />
        <MetricCard label="Needs attention" value={summary.failed} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle>Upload queue</CardTitle>
            <CardDescription>
              Upload lesson recordings to Convex storage and queue Gemini
              scoring immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className={cn(
                'flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 bg-muted/20 hover:bg-muted/35'
              )}
              onDragEnter={() => setIsDragActive(true)}
              onDragLeave={() => setIsDragActive(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="rounded-full border border-border/60 p-3">
                <FileArrowUpIcon className="size-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drag and drop lesson recordings here
                </p>
                <p className="text-sm text-muted-foreground">
                  Or browse for one or more files to queue for QA analysis.
                </p>
              </div>
              <input
                ref={fileInputRef}
                accept="video/*"
                className="hidden"
                multiple
                type="file"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <>
                    <CircleNotchIcon className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Choose recordings'
                )}
              </Button>
            </label>

            {uploadError ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                {uploadError}
              </div>
            ) : null}

            <div className="rounded-lg border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
              Completed and failed jobs are scheduled for source-video deletion
              after processing, and full report records age out automatically
              based on the retention cron.
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>
              Monitor upload state, retry failed analyses, and open completed
              reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!videos ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                <CircleNotchIcon className="size-4 animate-spin" />
                Loading recent uploads...
              </div>
            ) : videos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                No lesson recordings have been uploaded yet.
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video._id}
                  className="rounded-xl border border-border/60 bg-card/60 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{video.fileName}</p>
                        <VideoStatusBadge status={video.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Added {new Date(video.createdAt).toLocaleString()}
                      </p>
                      {video.result ? (
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>
                            Score{' '}
                            {formatOverallScore(video.result.overallScore)}
                          </span>
                          <span>
                            Confidence{' '}
                            {formatConfidence(video.result.confidence)}
                          </span>
                        </div>
                      ) : null}
                      {video.errorMessage ? (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                          {video.errorMessage}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {video.status === 'completed' ? (
                        <Link
                          className={buttonVariants({ variant: 'default' })}
                          params={{ videoId: video._id }}
                          to="/report/$videoId"
                        >
                          Open report
                        </Link>
                      ) : null}
                      {video.status === 'failed' ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void retryVideo({ videoId: video._id })
                          }
                        >
                          Retry analysis
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border border-border/60">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ValueCard({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
