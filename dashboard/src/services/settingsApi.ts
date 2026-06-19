import type { Settings } from 'src/apiTypes';
import { graphql } from 'src/gql';
import type { LogLevel } from 'src/gql/graphql';
import { client } from 'src/gql/client';

const SettingsQuery = graphql(`
  query Settings {
    settings {
      logLevel
    }
  }
`);

const UpdateSettingsMutation = graphql(`
  mutation UpdateSettings($logLevel: LogLevel!) {
    updateSettings(input: { logLevel: $logLevel }) {
      logLevel
    }
  }
`);

// GraphQL enums are SCREAMING_SNAKE (e.g. INFO); the app uses TitleCase (Info).
function toApiLevel(l: string): string {
  return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
}

function toGqlLevel(l: string): LogLevel {
  return l.toUpperCase() as LogLevel;
}

/**
 * Settings API service backed by GraphQL.
 */
export const settingsApi = {
  get: async (): Promise<Settings> => {
    const res = await client
      .query(SettingsQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    return { logLevel: toApiLevel(res.data?.settings.logLevel ?? 'INFO') };
  },

  update: async (settings: Settings): Promise<Settings> => {
    const res = await client
      .mutation(UpdateSettingsMutation, { logLevel: toGqlLevel(settings.logLevel) })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    return { logLevel: toApiLevel(res.data?.updateSettings.logLevel ?? settings.logLevel) };
  },
};
