import React from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { SessionForm } from './SessionForm';

interface AddSessionDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal wrapper around the add-session form, for adding a session from the
 * sidebar. The welcome screen embeds SessionForm directly instead.
 */
export const AddSessionDialog: React.FC<AddSessionDialogProps> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add Session</DialogTitle>
      </DialogHeader>

      {/* Remounted per open so the form starts blank each time. */}
      {open && <SessionForm key="add-session" onCreated={onClose} onCancel={onClose} />}
    </DialogContent>
  </Dialog>
);
