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
      sessionName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
    }
  }
`);

const SessionQuery = graphql(`
  query Session($id: ID!) {
    session(id: $id) {
      id
      name
      address
      sessionName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
    }
  }
`);

const CreateSessionMutation = graphql(`
  mutation CreateSession($name: String!, $address: String!) {
    createSession(input: { name: $name, address: $address }) {
      id
      name
      address
      sessionName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
    }
  }
`);

const UpdateSessionMutation = graphql(`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      id
      name
      address
      sessionName
      isPaused
      createdAt
      connectionState
      stage
      offlineReason
    }
  }
`);

const DeleteSessionMutation = graphql(`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`);

const ValidateSessionMutation = graphql(`
  mutation ValidateSession($id: ID!) {
    validateSession(id: $id) {
      sessionName
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

const PreviewSessionQuery = graphql(`
  query PreviewSession($address: String!) {
    previewSession(address: $address) {
      sessionName
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

const ClientIPQuery = graphql(`
  query ClientIp {
    clientIp
  }
`);

type GqlSession = {
  id: string;
  name: string;
  address: string;
  sessionName: string;
  isPaused: boolean;
  createdAt: string;
  connectionState: string;
  stage: string;
  offlineReason: string;
};

function toSessionDTO(s: GqlSession): SessionDTO {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    sessionName: s.sessionName,
    connectionState: connectionStateFromEnum(s.connectionState),
    isPaused: s.isPaused,
    offlineReason: connectivityReasonFromEnum(s.offlineReason),
    createdAt: s.createdAt,
    stage: s.stage === 'READY' ? 'ready' : 'init',
  };
}

export interface SessionPreviewResult {
  sessionInfo: SessionInfo;
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
    if (res.error) throw new Error(res.error.message);
    return (res.data?.sessions ?? []).map(toSessionDTO);
  },

  get: async (id: string): Promise<SessionDTO> => {
    const res = await client
      .query(SessionQuery, { id }, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data?.session) throw new Error('Failed to fetch session');
    return toSessionDTO(res.data.session);
  },

  create: async (name: string, address: string): Promise<SessionDTO> => {
    const res = await client.mutation(CreateSessionMutation, { name, address }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to create session');
    return toSessionDTO(res.data.createSession);
  },

  delete: async (id: string): Promise<void> => {
    const res = await client.mutation(DeleteSessionMutation, { id }).toPromise();
    if (res.error) throw new Error(res.error.message);
  },

  update: async (
    id: string,
    updates: { name?: string; isPaused?: boolean; address?: string }
  ): Promise<SessionDTO> => {
    const res = await client.mutation(UpdateSessionMutation, { id, input: updates }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to update session');
    return toSessionDTO(res.data.updateSession);
  },

  validate: async (id: string): Promise<SessionInfo> => {
    const res = await client.mutation(ValidateSessionMutation, { id }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to validate session');
    return res.data.validateSession as SessionInfo;
  },

  preview: async (address: string): Promise<SessionPreviewResult> => {
    const res = await client
      .query(PreviewSessionQuery, { address }, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to connect to server');
    return { sessionInfo: res.data.previewSession as SessionInfo };
  },

  getClientIP: async (): Promise<string> => {
    const res = await client
      .query(ClientIPQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    return res.data?.clientIp ?? '';
  },
};
