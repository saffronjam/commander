import { graphql } from 'src/gql';
import { client } from 'src/gql/client';

const LoginMutation = graphql(`
  mutation Login($password: String!) {
    login(input: { password: $password }) {
      success
      message
    }
  }
`);

const AuthStatusQuery = graphql(`
  query AuthStatus {
    authStatus {
      initialized
      authRequired
      authenticated
    }
  }
`);

const CompleteSetupMutation = graphql(`
  mutation CompleteSetup($setupToken: String!, $password: String) {
    completeSetup(input: { setupToken: $setupToken, password: $password }) {
      success
      message
    }
  }
`);

const ChangePasswordMutation = graphql(`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(input: { currentPassword: $currentPassword, newPassword: $newPassword }) {
      success
      message
    }
  }
`);

const EnableAuthMutation = graphql(`
  mutation EnableAuth($password: String!) {
    enableAuth(input: { password: $password }) {
      success
      message
    }
  }
`);

const DisableAuthMutation = graphql(`
  mutation DisableAuth($currentPassword: String!) {
    disableAuth(input: { currentPassword: $currentPassword }) {
      success
      message
    }
  }
`);

const LogoutMutation = graphql(`
  mutation Logout {
    logout {
      success
    }
  }
`);

/**
 * Authentication API service backed by GraphQL. The access token rides a
 * same-origin HTTP-only cookie the server sets on login.
 */
export const authApi = {
  login: async (password: string) => {
    const res = await client.mutation(LoginMutation, { password }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Authentication failed');
    return res.data.login;
  },

  getStatus: async () => {
    const res = await client
      .query(AuthStatusQuery, {}, { requestPolicy: 'network-only' })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to get authentication status');
    return res.data.authStatus;
  },

  /** Claims an instance that has not been set up. A null password leaves it open. */
  completeSetup: async (setupToken: string, password: string | null) => {
    const res = await client.mutation(CompleteSetupMutation, { setupToken, password }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Setup failed');
    return res.data.completeSetup;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await client
      .mutation(ChangePasswordMutation, { currentPassword, newPassword })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to change access key');
    return res.data.changePassword;
  },

  enableAuth: async (password: string) => {
    const res = await client.mutation(EnableAuthMutation, { password }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to set the access key');
    return res.data.enableAuth;
  },

  disableAuth: async (currentPassword: string) => {
    const res = await client.mutation(DisableAuthMutation, { currentPassword }).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to remove the access key');
    return res.data.disableAuth;
  },

  logout: async () => {
    const res = await client.mutation(LogoutMutation, {}).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to logout');
    return res.data.logout;
  },
};
