import {
  CircleNotchIcon,
  FloppyDiskIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from 'convex/react';
import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import {
  RubricEditor,
  validateRubric,
} from '@/components/rubric-editor';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { api } from '../../convex/_generated/api';

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Rubric Settings' },
        ]}
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <AuthLoading>
          <StateCard
            icon={<CircleNotchIcon className="size-5 animate-spin" />}
            message="Loading..."
          />
        </AuthLoading>

        <Authenticated>
          <RubricSettingsContent />
        </Authenticated>

        <Unauthenticated>
          <StateCard
            icon={
              <WarningCircleIcon className="size-5 text-muted-foreground" />
            }
            message="You must sign in to manage organization settings."
          />
        </Unauthenticated>
      </div>
    </>
  );
}

function rubricToJson(doc: {
  criteria: Array<{ id: number; name: string }>;
  passingScore: number;
}): string {
  return JSON.stringify(
    { criteria: doc.criteria, passingScore: doc.passingScore },
    null,
    2
  );
}

function RubricSettingsContent() {
  const rubric = useQuery(api.rubrics.getForOrganization, {});
  const saveRubric = useMutation(api.rubrics.save);

  const [editorValue, setEditorValue] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed editor value from the server once.
  useEffect(() => {
    if (rubric && editorValue === null) {
      setEditorValue(rubricToJson(rubric));
    }
  }, [rubric, editorValue]);

  const handleChange = useCallback((value: string) => {
    setEditorValue(value);
  }, []);

  async function handleSave() {
    if (!editorValue) return;
    const result = validateRubric(editorValue);
    if (!result.ok) {
      toast.error(result.errors[0]);
      return;
    }
    setIsSaving(true);
    try {
      await saveRubric({
        criteria: result.doc.criteria,
        passingScore: result.doc.passingScore,
      });
      toast.success('Rubric saved.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save rubric.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = validateRubric(text);
      if (result.ok) {
        setEditorValue(rubricToJson(result.doc));
        toast.success('Rubric loaded from file. Review and save.');
      } else {
        setEditorValue(text);
        toast.error(`Validation errors found in uploaded file.`);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  if (rubric === undefined) {
    return (
      <StateCard
        icon={<CircleNotchIcon className="size-5 animate-spin" />}
        message="Loading rubric..."
      />
    );
  }

  const currentValidation = editorValue ? validateRubric(editorValue) : null;
  const isValid = currentValidation?.ok ?? false;

  return (
    <div className="grid gap-6">
      <Card className="border border-border/60">
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Rubric editor</CardTitle>
            <CardDescription>
              {rubric.isDefault
                ? 'You are viewing the built-in default rubric. Edit below or upload a JSON file to customize.'
                : `Custom rubric last updated ${new Date(rubric.updatedAt).toLocaleString()}.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label>
              <input
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                type="file"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimpleIcon className="size-4" />
                Upload JSON
              </Button>
            </label>

            <Button
              disabled={!isValid || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FloppyDiskIcon className="size-4" />
                  Save rubric
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {editorValue !== null ? (
            <RubricEditor value={editorValue} onChange={handleChange} />
          ) : null}

          {currentValidation && !currentValidation.ok ? (
            <div className="space-y-1 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              {currentValidation.errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">JSON format</p>
            <p>
              The rubric must be a JSON object with{' '}
              <code className="rounded bg-muted px-1">"criteria"</code> (an
              array of <code className="rounded bg-muted px-1">{'{ "id": number, "name": string }'}</code>{' '}
              objects) and{' '}
              <code className="rounded bg-muted px-1">"passingScore"</code> (a
              number between 0 and 100). Each criterion is scored 0, 1, or 2 during
              QA review.
            </p>
          </div>
        </CardContent>
      </Card>
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
