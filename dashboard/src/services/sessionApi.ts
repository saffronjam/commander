import type { SessionDTO, SessionInfo } from 'src/apiTypes';
import { connectionStateFromEnum, connectivityReasonFromEnum } from 'src/utils/session-offline';
import { graphql } from 'src/gql';
import { client } from 'src/gql/client';

const SessionsQuery = graphql(`
  query Sessions {
    sessions {
      id
      name
      address
      saveName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
      mismatchedSaveName
    }
  }
`);

const SessionQuery = graphql(`
  query Session($id: ID!) {
    session(id: $id) {
      id
      name
      address
      saveName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
      mismatchedSaveName
    }
  }
`);

const CreateSessionMutation = graphql(`
  mutation CreateSession($name: String!, $address: String!, $expectedSaveName: String!) {
    createSession(
      input: { name: $name, address: $address, expectedSaveName: $expectedSaveName }
    ) {
      id
      name
      address
      saveName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
      mismatchedSaveName
    }
  }
`);

const UpdateSessionMutation = graphql(`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      id
      name
      address
      saveName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
      mismatchedSaveName
    }
  }
`);

const DeleteSessionMutation = graphql(`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`);

const PreviewSessionQuery = graphql(`
  query PreviewSession($address: String!) {
    previewSession(address: $address) {
      saveName
      isPaused
      dayLength
      nightLength
      passedDays
      numberOfDaysSinceLastDeath
      hours
      minutes
      seconds
      isDay
      totalPlayDuration
      totalPlayDurationText
    }
  }
`);

const DiscoverSessionsQuery = graphql(`
  query DiscoverSessions {
    discoverSessions {
      address
      alreadyAdded
      info {
        saveName
        isPaused
        dayLength
        nightLength
        passedDays
        numberOfDaysSinceLastDeath
        hours
        minutes
        seconds
        isDay
        totalPlayDuration
        totalPlayDurationText
      }
    }
  }
`);

const ClientIPQuery = graphql(`
  query ClientIp {
    clientIp
  }
`);

type GqlSession = {
  id: string;
  name: string;
  address: string;
  saveName: string;
  isPaused: boolean;
  createdAt: string;
  connectionState: string;
  stage: string;
  offlineReason: string;
  mismatchedSaveName?: string | null;
};

function toSessionDTO(s: GqlSession): SessionDTO {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    saveName: s.saveName,
    connectionState: connectionStateFromEnum(s.connectionState),
    mismatchedSaveName: s.mismatchedSaveName ?? '',
    isPaused: s.isPaused,
    offlineReason: connectivityReasonFromEnum(s.offlineReason),
    createdAt: s.createdAt,
    stage: s.stage === 'READY' ? 'ready' : 'init',
  };
}

export interface SessionPreviewResult {
  sessionInfo: SessionInfo;
}

/** One FRM server found by sweeping the network. */
export interface DiscoveredSession {
  address: string;
  info: SessionInfo;
  /** True when a session already exists for this server. */
  alreadyAdded: boolean;
}

/**
 * Session CRUD + probe API, backed by GraphQL. Results are mapped to the
 * existing SessionDTO/SessionInfo shapes so consumers stay unchanged.
 */
export const sessionApi = {
  list: async (): Promise<SessionDTO[]> => {
    const res = await client
      .query(SessionsQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw res.error;
    return (res.data?.sessions ?? []).map(toSessionDTO);
  },

  get: async (id: string): Promise<SessionDTO> => {
    const res = await client
      .query(SessionQuery, { id }, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw res.error;
    if (!res.data?.session) throw new Error('Failed to fetch session');
    return toSessionDTO(res.data.session);
  },

  create: async (name: string, address: string, expectedSaveName: string): Promise<SessionDTO> => {
    const res = await client
      .mutation(CreateSessionMutation, { name, address, expectedSaveName })
      .toPromise();
    if (res.error) throw res.error;
    if (!res.data) throw new Error('Failed to create session');
    return toSessionDTO(res.data.createSession);
  },

  delete: async (id: string): Promise<void> => {
    const res = await client.mutation(DeleteSessionMutation, { id }).toPromise();
    if (res.error) throw res.error;
  },

  update: async (
    id: string,
    updates: { name?: string; isPaused?: boolean; address?: string }
  ): Promise<SessionDTO> => {
    const res = await client.mutation(UpdateSessionMutation, { id, input: updates }).toPromise();
    if (res.error) throw res.error;
    if (!res.data) throw new Error('Failed to update session');
    return toSessionDTO(res.data.updateSession);
  },

  discover: async (): Promise<DiscoveredSession[]> => {
    const res = await client
      .query(DiscoverSessionsQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw res.error;
    return (res.data?.discoverSessions ?? []).map((d) => ({
      address: d.address,
      alreadyAdded: d.alreadyAdded,
      info: d.info as SessionInfo,
    }));
  },

  preview: async (address: string): Promise<SessionPreviewResult> => {
    const res = await client
      .query(PreviewSessionQuery, { address }, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw res.error;
    if (!res.data) throw new Error('Failed to connect to server');
    return { sessionInfo: res.data.previewSession as SessionInfo };
  },

  getClientIP: async (): Promise<string> => {
    const res = await client
      .query(ClientIPQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw res.error;
    return res.data?.clientIp ?? '';
  },
};
