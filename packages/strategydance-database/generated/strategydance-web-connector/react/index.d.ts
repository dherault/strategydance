import { CreateCurrentUserData, CreateCurrentUserVariables, UpdateCurrentUserData, UpdateCurrentUserVariables, GetCurrentUserData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateCurrentUser(options?: useDataConnectMutationOptions<CreateCurrentUserData, FirebaseError, CreateCurrentUserVariables>): UseDataConnectMutationResult<CreateCurrentUserData, CreateCurrentUserVariables>;
export function useCreateCurrentUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateCurrentUserData, FirebaseError, CreateCurrentUserVariables>): UseDataConnectMutationResult<CreateCurrentUserData, CreateCurrentUserVariables>;

export function useUpdateCurrentUser(options?: useDataConnectMutationOptions<UpdateCurrentUserData, FirebaseError, UpdateCurrentUserVariables>): UseDataConnectMutationResult<UpdateCurrentUserData, UpdateCurrentUserVariables>;
export function useUpdateCurrentUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateCurrentUserData, FirebaseError, UpdateCurrentUserVariables>): UseDataConnectMutationResult<UpdateCurrentUserData, UpdateCurrentUserVariables>;

export function useGetCurrentUser(options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;
export function useGetCurrentUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;
