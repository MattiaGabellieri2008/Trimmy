import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Appointment_Key {
  id: UUIDString;
  __typename?: 'Appointment_Key';
}

export interface CreateAppointmentData {
  appointment_insert: Appointment_Key;
}

export interface CreateAppointmentVariables {
  tenantId: UUIDString;
  customerId: UUIDString;
  staffId: string;
  serviceId: UUIDString;
  startTime: TimestampString;
  endTime: TimestampString;
  status?: string | null;
}

export interface CreateCustomerData {
  customer_insert: Customer_Key;
}

export interface CreateCustomerVariables {
  tenantId: UUIDString;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  birthday?: string | null;
  technicalNotes?: string | null;
}

export interface Customer_Key {
  id: UUIDString;
  __typename?: 'Customer_Key';
}

export interface DeleteAppointmentData {
  appointment_delete?: Appointment_Key | null;
}

export interface DeleteAppointmentVariables {
  id: UUIDString;
}

export interface GetCustomerDetailsData {
  customer?: {
    id: UUIDString;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    birthday?: string | null;
    technicalNotes?: string | null;
    tenantId: UUIDString;
    pastAppointments: ({
      id: UUIDString;
      startTime: TimestampString;
      endTime: TimestampString;
      status: string;
      service: {
        id: UUIDString;
        name: string;
        price: number;
      } & Service_Key;
    } & Appointment_Key)[];
  } & Customer_Key;
}

export interface GetCustomerDetailsVariables {
  customerId: UUIDString;
}

export interface GetDailyAppointmentsData {
  appointments: ({
    id: UUIDString;
    startTime: TimestampString;
    endTime: TimestampString;
    status: string;
    customer: {
      id: UUIDString;
      firstName: string;
      lastName: string;
      phone: string;
    } & Customer_Key;
    staff: {
      id: string;
      fullName: string;
    } & User_Key;
    service: {
      id: UUIDString;
      name: string;
      durationMinutes: number;
      price: number;
    } & Service_Key;
  } & Appointment_Key)[];
}

export interface GetDailyAppointmentsVariables {
  tenantId: UUIDString;
  todayStart: TimestampString;
  todayEnd: TimestampString;
}

export interface InserisciDatiDiProvaData {
  tenant_upsert: Tenant_Key;
  customer_upsert: Customer_Key;
  user_upsert: User_Key;
  service_upsert: Service_Key;
  appointment_insert: Appointment_Key;
}

export interface ListCustomersData {
  customers: ({
    id: UUIDString;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    birthday?: string | null;
    technicalNotes?: string | null;
  } & Customer_Key)[];
}

export interface ListCustomersVariables {
  tenantId: UUIDString;
}

export interface ListServicesData {
  services: ({
    id: UUIDString;
    name: string;
    durationMinutes: number;
    price: number;
  } & Service_Key)[];
}

export interface ListServicesVariables {
  tenantId: UUIDString;
}

export interface ListStaffData {
  users: ({
    id: string;
    fullName: string;
    role: string;
    phone?: string | null;
  } & User_Key)[];
}

export interface ListStaffVariables {
  tenantId: UUIDString;
}

export interface Service_Key {
  id: UUIDString;
  __typename?: 'Service_Key';
}

export interface Tenant_Key {
  id: UUIDString;
  __typename?: 'Tenant_Key';
}

export interface UpdateAppointmentStatusData {
  appointment_update?: Appointment_Key | null;
}

export interface UpdateAppointmentStatusVariables {
  id: UUIDString;
  status: string;
}

export interface UpdateCustomerData {
  customer_update?: Customer_Key | null;
}

export interface UpdateCustomerVariables {
  id: UUIDString;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  technicalNotes?: string | null;
}

export interface UpdateTenantOnboardingData {
  tenant_update?: Tenant_Key | null;
}

export interface UpdateTenantOnboardingVariables {
  id: UUIDString;
  businessCategory: string;
}

export interface UpsertServiceData {
  service_upsert: Service_Key;
}

export interface UpsertServiceVariables {
  id: UUIDString;
  tenantId: UUIDString;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface UpsertTenantData {
  tenant_upsert: Tenant_Key;
}

export interface UpsertTenantVariables {
  id: UUIDString;
  name: string;
  planType: string;
  businessCategory: string;
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  id: string;
  tenantId: UUIDString;
  role: string;
  fullName: string;
  phone?: string | null;
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

interface ListServicesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListServicesVariables): QueryRef<ListServicesData, ListServicesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListServicesVariables): QueryRef<ListServicesData, ListServicesVariables>;
  operationName: string;
}
export const listServicesRef: ListServicesRef;

export function listServices(vars: ListServicesVariables, options?: ExecuteQueryOptions): QueryPromise<ListServicesData, ListServicesVariables>;
export function listServices(dc: DataConnect, vars: ListServicesVariables, options?: ExecuteQueryOptions): QueryPromise<ListServicesData, ListServicesVariables>;

interface ListStaffRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffVariables): QueryRef<ListStaffData, ListStaffVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListStaffVariables): QueryRef<ListStaffData, ListStaffVariables>;
  operationName: string;
}
export const listStaffRef: ListStaffRef;

export function listStaff(vars: ListStaffVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffData, ListStaffVariables>;
export function listStaff(dc: DataConnect, vars: ListStaffVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffData, ListStaffVariables>;

interface CreateAppointmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
  operationName: string;
}
export const createAppointmentRef: CreateAppointmentRef;

export function createAppointment(vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;
export function createAppointment(dc: DataConnect, vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;

interface UpdateAppointmentStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAppointmentStatusVariables): MutationRef<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAppointmentStatusVariables): MutationRef<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;
  operationName: string;
}
export const updateAppointmentStatusRef: UpdateAppointmentStatusRef;

export function updateAppointmentStatus(vars: UpdateAppointmentStatusVariables): MutationPromise<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;
export function updateAppointmentStatus(dc: DataConnect, vars: UpdateAppointmentStatusVariables): MutationPromise<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;

interface DeleteAppointmentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAppointmentVariables): MutationRef<DeleteAppointmentData, DeleteAppointmentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteAppointmentVariables): MutationRef<DeleteAppointmentData, DeleteAppointmentVariables>;
  operationName: string;
}
export const deleteAppointmentRef: DeleteAppointmentRef;

export function deleteAppointment(vars: DeleteAppointmentVariables): MutationPromise<DeleteAppointmentData, DeleteAppointmentVariables>;
export function deleteAppointment(dc: DataConnect, vars: DeleteAppointmentVariables): MutationPromise<DeleteAppointmentData, DeleteAppointmentVariables>;

interface UpsertServiceRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertServiceVariables): MutationRef<UpsertServiceData, UpsertServiceVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertServiceVariables): MutationRef<UpsertServiceData, UpsertServiceVariables>;
  operationName: string;
}
export const upsertServiceRef: UpsertServiceRef;

export function upsertService(vars: UpsertServiceVariables): MutationPromise<UpsertServiceData, UpsertServiceVariables>;
export function upsertService(dc: DataConnect, vars: UpsertServiceVariables): MutationPromise<UpsertServiceData, UpsertServiceVariables>;

interface UpsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  operationName: string;
}
export const upsertUserRef: UpsertUserRef;

export function upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface ListCustomersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
  operationName: string;
}
export const listCustomersRef: ListCustomersRef;

export function listCustomers(vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;
export function listCustomers(dc: DataConnect, vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;

interface GetCustomerDetailsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCustomerDetailsVariables): QueryRef<GetCustomerDetailsData, GetCustomerDetailsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCustomerDetailsVariables): QueryRef<GetCustomerDetailsData, GetCustomerDetailsVariables>;
  operationName: string;
}
export const getCustomerDetailsRef: GetCustomerDetailsRef;

export function getCustomerDetails(vars: GetCustomerDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCustomerDetailsData, GetCustomerDetailsVariables>;
export function getCustomerDetails(dc: DataConnect, vars: GetCustomerDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCustomerDetailsData, GetCustomerDetailsVariables>;

interface CreateCustomerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
  operationName: string;
}
export const createCustomerRef: CreateCustomerRef;

export function createCustomer(vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;
export function createCustomer(dc: DataConnect, vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface UpdateCustomerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
  operationName: string;
}
export const updateCustomerRef: UpdateCustomerRef;

export function updateCustomer(vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;
export function updateCustomer(dc: DataConnect, vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface InserisciDatiDiProvaRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<InserisciDatiDiProvaData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<InserisciDatiDiProvaData, undefined>;
  operationName: string;
}
export const inserisciDatiDiProvaRef: InserisciDatiDiProvaRef;

export function inserisciDatiDiProva(): MutationPromise<InserisciDatiDiProvaData, undefined>;
export function inserisciDatiDiProva(dc: DataConnect): MutationPromise<InserisciDatiDiProvaData, undefined>;

interface UpsertTenantRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertTenantVariables): MutationRef<UpsertTenantData, UpsertTenantVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertTenantVariables): MutationRef<UpsertTenantData, UpsertTenantVariables>;
  operationName: string;
}
export const upsertTenantRef: UpsertTenantRef;

export function upsertTenant(vars: UpsertTenantVariables): MutationPromise<UpsertTenantData, UpsertTenantVariables>;
export function upsertTenant(dc: DataConnect, vars: UpsertTenantVariables): MutationPromise<UpsertTenantData, UpsertTenantVariables>;

interface UpdateTenantOnboardingRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTenantOnboardingVariables): MutationRef<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateTenantOnboardingVariables): MutationRef<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;
  operationName: string;
}
export const updateTenantOnboardingRef: UpdateTenantOnboardingRef;

export function updateTenantOnboarding(vars: UpdateTenantOnboardingVariables): MutationPromise<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;
export function updateTenantOnboarding(dc: DataConnect, vars: UpdateTenantOnboardingVariables): MutationPromise<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;

interface GetDailyAppointmentsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDailyAppointmentsVariables): QueryRef<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetDailyAppointmentsVariables): QueryRef<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;
  operationName: string;
}
export const getDailyAppointmentsRef: GetDailyAppointmentsRef;

export function getDailyAppointments(vars: GetDailyAppointmentsVariables, options?: ExecuteQueryOptions): QueryPromise<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;
export function getDailyAppointments(dc: DataConnect, vars: GetDailyAppointmentsVariables, options?: ExecuteQueryOptions): QueryPromise<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;

