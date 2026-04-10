import { json } from '@codemirror/lang-json';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

export type RubricCriterion = { id: number; name: string };

export type RubricDocument = {
  criteria: RubricCriterion[];
  passingScore: number;
};

type RubricValidation =
  | { ok: true; doc: RubricDocument }
  | { ok: false; errors: string[] };

/**
 * Validate a raw JSON string as a rubric definition.
 */
export function validateRubric(source: string): RubricValidation {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { ok: false, errors: ['Invalid JSON syntax.'] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: ['Root value must be a JSON object with "criteria" and "passingScore".'],
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.criteria)) {
    errors.push('"criteria" must be an array.');
  } else {
    obj.criteria.forEach((item: unknown, idx: number) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`criteria[${idx}] must be an object.`);
        return;
      }
      const c = item as Record<string, unknown>;
      if (typeof c.id !== 'number' || !Number.isInteger(c.id) || c.id < 1) {
        errors.push(`criteria[${idx}].id must be a positive integer.`);
      }
      if (typeof c.name !== 'string' || c.name.trim().length === 0) {
        errors.push(`criteria[${idx}].name must be a non-empty string.`);
      }
    });
  }

  if (typeof obj.passingScore !== 'number') {
    errors.push('"passingScore" must be a number.');
  } else if (obj.passingScore < 0 || obj.passingScore > 100) {
    errors.push('"passingScore" must be between 0 and 100.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    doc: {
      criteria: (obj.criteria as Array<Record<string, unknown>>).map((c) => ({
        id: c.id as number,
        name: (c.name as string).trim(),
      })),
      passingScore: obj.passingScore as number,
    },
  };
}

const rubricLinter = linter((view) => {
  const source = view.state.doc.toString();
  if (!source.trim()) return [];

  const result = validateRubric(source);
  if (result.ok) return [];

  const diagnostics: Diagnostic[] = result.errors.map((msg) => ({
    from: 0,
    to: Math.min(source.length, 1),
    severity: 'error',
    message: msg,
  }));

  return diagnostics;
});

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  },
  '.cm-editor': {
    borderRadius: '0.75rem',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  '.cm-content': {
    padding: '12px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRight: '1px solid var(--border)',
    borderRadius: '0.75rem 0 0 0.75rem',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
  },
});

interface RubricEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RubricEditor({ value, onChange, className }: RubricEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const createView = useCallback(() => {
    if (!containerRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        rubricLinter,
        editorTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    createView();
    return () => viewRef.current?.destroy();
  }, [createView]);

  // Sync external value changes that didn't originate from the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn('min-h-[300px] overflow-hidden rounded-xl', className)}
    />
  );
}
