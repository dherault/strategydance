const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const AuthenticationProvider = {
  PASSWORD: "PASSWORD",
  GOOGLE: "GOOGLE",
}
exports.AuthenticationProvider = AuthenticationProvider;

const connectorConfig = {
  connector: 'strategydance-web-connector',
  service: 'strategydance',
  location: 'europe-north1'
};
exports.connectorConfig = connectorConfig;

const getCurrentUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCurrentUser');
}
getCurrentUserRef.operationName = 'GetCurrentUser';
exports.getCurrentUserRef = getCurrentUserRef;

exports.getCurrentUser = function getCurrentUser(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getCurrentUserRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getAuthenticationProvidersByEmailRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAuthenticationProvidersByEmail', inputVars);
}
getAuthenticationProvidersByEmailRef.operationName = 'GetAuthenticationProvidersByEmail';
exports.getAuthenticationProvidersByEmailRef = getAuthenticationProvidersByEmailRef;

exports.getAuthenticationProvidersByEmail = function getAuthenticationProvidersByEmail(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getAuthenticationProvidersByEmailRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createCurrentUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCurrentUser', inputVars);
}
createCurrentUserRef.operationName = 'CreateCurrentUser';
exports.createCurrentUserRef = createCurrentUserRef;

exports.createCurrentUser = function createCurrentUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createCurrentUserRef(dcInstance, inputVars));
}
;

const updateCurrentUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCurrentUser', inputVars);
}
updateCurrentUserRef.operationName = 'UpdateCurrentUser';
exports.updateCurrentUserRef = updateCurrentUserRef;

exports.updateCurrentUser = function updateCurrentUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateCurrentUserRef(dcInstance, inputVars));
}
;
