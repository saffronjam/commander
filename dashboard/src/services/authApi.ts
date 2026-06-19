import { graphql } from 'src/gql';
import { client } from 'src/gql/client';

const LoginMutation = graphql(`
  mutation Login($password: String!) {
    login(input: { password: $password }) {
      success
      usedDefaultPassword
    }
  }
`);

const AuthStatusQuery = graphql(`
  query AuthStatus {
    authStatus {
      authenticated
      usedDefaultPassword
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

  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await client
      .mutation(ChangePasswordMutation, { currentPassword, newPassword })
      .toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to change password');
    return res.data.changePassword;
  },

  logout: async () => {
    const res = await client.mutation(LogoutMutation, {}).toPromise();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error('Failed to logout');
    return res.data.logout;
  },
};
