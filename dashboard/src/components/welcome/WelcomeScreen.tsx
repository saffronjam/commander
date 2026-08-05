import { Icon } from '@iconify/react';
import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { SessionForm } from '@/components/session-dialog';

/**
 * Shown when the instance has no sessions yet. The add-session form is embedded
 * directly, since adding one is the only thing to do here. The layout decides
 * when this applies, so this component makes no loading judgement.
 */
const WelcomeScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-background p-3">
    <Card className="w-full max-w-md">
      <CardContent className="px-8">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Icon icon="material-symbols:factory" className="size-10 text-primary" />
        </div>

        <h1 className="text-center text-2xl font-bold">Connect your first session</h1>
        <p className="mb-8 mt-2 text-center text-xs text-muted-foreground">
          Sessions are shared across all users
        </p>

        <SessionForm autoFocus />
      </CardContent>
    </Card>
  </div>
);

export default WelcomeScreen;
