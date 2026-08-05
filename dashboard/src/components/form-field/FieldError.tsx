import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  /** Referenced by the field's aria-describedby so screen readers announce it. */
  id?: string;
  message?: string | null;
}

/**
 * Validation message tied to a single field. Renders nothing without a message,
 * so a field can include one unconditionally.
 *
 * Pair it with aria-invalid on the control: Input already styles that state with
 * a destructive border and ring.
 */
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="text-destructive flex items-center gap-1.5 text-xs">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}
