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
    {/*
      Radix focuses the first tabbable element on open, which lands the ring on
      the secondary "or enter an address" link rather than on anything the user
      is likely to want.
    */}
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Add Session</DialogTitle>
      </DialogHeader>

      {/*
        Deliberately not gated on `open`. Radix keeps the content mounted for the
        200ms close animation, so dropping the form the moment `open` flipped left
        an empty titled dialog animating out. It still starts blank on the next
        open because Radix unmounts the whole subtree once that animation ends.
      */}
      <SessionForm onCreated={onClose} onCancel={onClose} />
    </DialogContent>
  </Dialog>
);
