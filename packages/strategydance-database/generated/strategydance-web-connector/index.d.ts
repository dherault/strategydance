import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum AuthenticationProvider {
  PASSWORD = "PASSWORD",
  GOOGLE = "GOOGLE",
};



export interface CreateCurrentUserData {
  user_insert: User_Key;
}

export interface CreateCurrentUserVariables {
  email: string;
  displayName?: string | null;
  imageUrl?: string | null;
  locale: string;
  timezone?: string | null;
  authenticationProviders: AuthenticationProvider[];
}

export interface GetCurrentUserData {
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    imageUrl?: string | null;
    locale: string;
    timezone?: string | null;
    authenticationProviders: AuthenticationProvider[];
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & User_Key;
}

export interface UpdateCurrentUserData {
  user_update?: User_Key | null;
}

export interface UpdateCurrentUserVariables {
  email: string;
  displayName?: string | null;
  imageUrl?: string | null;
  timezone?: string | null;
  authenticationProviders: AuthenticationProvider[];
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

interface CreateCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCurrentUserVariables): MutationRef<CreateCurrentUserData, CreateCurrentUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCurrentUserVariables): MutationRef<CreateCurrentUserData, CreateCurrentUserVariables>;
  operationName: string;
}
export const createCurrentUserRef: CreateCurrentUserRef;

export function createCurrentUser(vars: CreateCurrentUserVariables): MutationPromise<CreateCurrentUserData, CreateCurrentUserVariables>;
export function createCurrentUser(dc: DataConnect, vars: CreateCurrentUserVariables): MutationPromise<CreateCurrentUserData, CreateCurrentUserVariables>;

interface UpdateCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCurrentUserVariables): MutationRef<UpdateCurrentUserData, UpdateCurrentUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCurrentUserVariables): MutationRef<UpdateCurrentUserData, UpdateCurrentUserVariables>;
  operationName: string;
}
export const updateCurrentUserRef: UpdateCurrentUserRef;

export function updateCurrentUser(vars: UpdateCurrentUserVariables): MutationPromise<UpdateCurrentUserData, UpdateCurrentUserVariables>;
export function updateCurrentUser(dc: DataConnect, vars: UpdateCurrentUserVariables): MutationPromise<UpdateCurrentUserData, UpdateCurrentUserVariables>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

