const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'gestionale',
  service: 'gestionale-saloni-service',
  location: 'europe-west8'
};
exports.connectorConfig = connectorConfig;

const listServicesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListServices', inputVars);
}
listServicesRef.operationName = 'ListServices';
exports.listServicesRef = listServicesRef;

exports.listServices = function listServices(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listServicesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listStaffRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListStaff', inputVars);
}
listStaffRef.operationName = 'ListStaff';
exports.listStaffRef = listStaffRef;

exports.listStaff = function listStaff(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listStaffRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createAppointmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateAppointment', inputVars);
}
createAppointmentRef.operationName = 'CreateAppointment';
exports.createAppointmentRef = createAppointmentRef;

exports.createAppointment = function createAppointment(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createAppointmentRef(dcInstance, inputVars));
}
;

const updateAppointmentStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateAppointmentStatus', inputVars);
}
updateAppointmentStatusRef.operationName = 'UpdateAppointmentStatus';
exports.updateAppointmentStatusRef = updateAppointmentStatusRef;

exports.updateAppointmentStatus = function updateAppointmentStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateAppointmentStatusRef(dcInstance, inputVars));
}
;

const deleteAppointmentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteAppointment', inputVars);
}
deleteAppointmentRef.operationName = 'DeleteAppointment';
exports.deleteAppointmentRef = deleteAppointmentRef;

exports.deleteAppointment = function deleteAppointment(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteAppointmentRef(dcInstance, inputVars));
}
;

const upsertServiceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertService', inputVars);
}
upsertServiceRef.operationName = 'UpsertService';
exports.upsertServiceRef = upsertServiceRef;

exports.upsertService = function upsertService(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertServiceRef(dcInstance, inputVars));
}
;

const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';
exports.upsertUserRef = upsertUserRef;

exports.upsertUser = function upsertUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertUserRef(dcInstance, inputVars));
}
;

const listCustomersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCustomers', inputVars);
}
listCustomersRef.operationName = 'ListCustomers';
exports.listCustomersRef = listCustomersRef;

exports.listCustomers = function listCustomers(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listCustomersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getCustomerDetailsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCustomerDetails', inputVars);
}
getCustomerDetailsRef.operationName = 'GetCustomerDetails';
exports.getCustomerDetailsRef = getCustomerDetailsRef;

exports.getCustomerDetails = function getCustomerDetails(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getCustomerDetailsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const createCustomerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCustomer', inputVars);
}
createCustomerRef.operationName = 'CreateCustomer';
exports.createCustomerRef = createCustomerRef;

exports.createCustomer = function createCustomer(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createCustomerRef(dcInstance, inputVars));
}
;

const updateCustomerRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCustomer', inputVars);
}
updateCustomerRef.operationName = 'UpdateCustomer';
exports.updateCustomerRef = updateCustomerRef;

exports.updateCustomer = function updateCustomer(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateCustomerRef(dcInstance, inputVars));
}
;

const inserisciDatiDiProvaRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'InserisciDatiDiProva');
}
inserisciDatiDiProvaRef.operationName = 'InserisciDatiDiProva';
exports.inserisciDatiDiProvaRef = inserisciDatiDiProvaRef;

exports.inserisciDatiDiProva = function inserisciDatiDiProva(dc) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dc, undefined);
  return executeMutation(inserisciDatiDiProvaRef(dcInstance, inputVars));
}
;

const upsertTenantRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertTenant', inputVars);
}
upsertTenantRef.operationName = 'UpsertTenant';
exports.upsertTenantRef = upsertTenantRef;

exports.upsertTenant = function upsertTenant(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertTenantRef(dcInstance, inputVars));
}
;

const updateTenantOnboardingRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTenantOnboarding', inputVars);
}
updateTenantOnboardingRef.operationName = 'UpdateTenantOnboarding';
exports.updateTenantOnboardingRef = updateTenantOnboardingRef;

exports.updateTenantOnboarding = function updateTenantOnboarding(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateTenantOnboardingRef(dcInstance, inputVars));
}
;

const getDailyAppointmentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDailyAppointments', inputVars);
}
getDailyAppointmentsRef.operationName = 'GetDailyAppointments';
exports.getDailyAppointmentsRef = getDailyAppointmentsRef;

exports.getDailyAppointments = function getDailyAppointments(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getDailyAppointmentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
