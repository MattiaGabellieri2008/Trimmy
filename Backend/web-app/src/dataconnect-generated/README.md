# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `gestionale`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListServices*](#listservices)
  - [*ListStaff*](#liststaff)
  - [*ListCustomers*](#listcustomers)
  - [*GetCustomerDetails*](#getcustomerdetails)
  - [*GetDailyAppointments*](#getdailyappointments)
- [**Mutations**](#mutations)
  - [*CreateAppointment*](#createappointment)
  - [*UpdateAppointmentStatus*](#updateappointmentstatus)
  - [*DeleteAppointment*](#deleteappointment)
  - [*UpsertService*](#upsertservice)
  - [*UpsertUser*](#upsertuser)
  - [*CreateCustomer*](#createcustomer)
  - [*UpdateCustomer*](#updatecustomer)
  - [*InserisciDatiDiProva*](#inseriscidatidiprova)
  - [*UpsertTenant*](#upserttenant)
  - [*UpdateTenantOnboarding*](#updatetenantonboarding)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `gestionale`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `gestionale` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListServices
You can execute the `ListServices` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listServices(vars: ListServicesVariables, options?: ExecuteQueryOptions): QueryPromise<ListServicesData, ListServicesVariables>;

interface ListServicesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListServicesVariables): QueryRef<ListServicesData, ListServicesVariables>;
}
export const listServicesRef: ListServicesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listServices(dc: DataConnect, vars: ListServicesVariables, options?: ExecuteQueryOptions): QueryPromise<ListServicesData, ListServicesVariables>;

interface ListServicesRef {
  ...
  (dc: DataConnect, vars: ListServicesVariables): QueryRef<ListServicesData, ListServicesVariables>;
}
export const listServicesRef: ListServicesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listServicesRef:
```typescript
const name = listServicesRef.operationName;
console.log(name);
```

### Variables
The `ListServices` query requires an argument of type `ListServicesVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListServicesVariables {
  tenantId: UUIDString;
}
```
### Return Type
Recall that executing the `ListServices` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListServicesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListServicesData {
  services: ({
    id: UUIDString;
    name: string;
    durationMinutes: number;
    price: number;
  } & Service_Key)[];
}
```
### Using `ListServices`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listServices, ListServicesVariables } from '@dataconnect/generated';

// The `ListServices` query requires an argument of type `ListServicesVariables`:
const listServicesVars: ListServicesVariables = {
  tenantId: ..., 
};

// Call the `listServices()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listServices(listServicesVars);
// Variables can be defined inline as well.
const { data } = await listServices({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listServices(dataConnect, listServicesVars);

console.log(data.services);

// Or, you can use the `Promise` API.
listServices(listServicesVars).then((response) => {
  const data = response.data;
  console.log(data.services);
});
```

### Using `ListServices`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listServicesRef, ListServicesVariables } from '@dataconnect/generated';

// The `ListServices` query requires an argument of type `ListServicesVariables`:
const listServicesVars: ListServicesVariables = {
  tenantId: ..., 
};

// Call the `listServicesRef()` function to get a reference to the query.
const ref = listServicesRef(listServicesVars);
// Variables can be defined inline as well.
const ref = listServicesRef({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listServicesRef(dataConnect, listServicesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.services);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.services);
});
```

## ListStaff
You can execute the `ListStaff` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listStaff(vars: ListStaffVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffData, ListStaffVariables>;

interface ListStaffRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListStaffVariables): QueryRef<ListStaffData, ListStaffVariables>;
}
export const listStaffRef: ListStaffRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listStaff(dc: DataConnect, vars: ListStaffVariables, options?: ExecuteQueryOptions): QueryPromise<ListStaffData, ListStaffVariables>;

interface ListStaffRef {
  ...
  (dc: DataConnect, vars: ListStaffVariables): QueryRef<ListStaffData, ListStaffVariables>;
}
export const listStaffRef: ListStaffRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listStaffRef:
```typescript
const name = listStaffRef.operationName;
console.log(name);
```

### Variables
The `ListStaff` query requires an argument of type `ListStaffVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListStaffVariables {
  tenantId: UUIDString;
}
```
### Return Type
Recall that executing the `ListStaff` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListStaffData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListStaffData {
  users: ({
    id: string;
    fullName: string;
    role: string;
    phone?: string | null;
  } & User_Key)[];
}
```
### Using `ListStaff`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listStaff, ListStaffVariables } from '@dataconnect/generated';

// The `ListStaff` query requires an argument of type `ListStaffVariables`:
const listStaffVars: ListStaffVariables = {
  tenantId: ..., 
};

// Call the `listStaff()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listStaff(listStaffVars);
// Variables can be defined inline as well.
const { data } = await listStaff({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listStaff(dataConnect, listStaffVars);

console.log(data.users);

// Or, you can use the `Promise` API.
listStaff(listStaffVars).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListStaff`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listStaffRef, ListStaffVariables } from '@dataconnect/generated';

// The `ListStaff` query requires an argument of type `ListStaffVariables`:
const listStaffVars: ListStaffVariables = {
  tenantId: ..., 
};

// Call the `listStaffRef()` function to get a reference to the query.
const ref = listStaffRef(listStaffVars);
// Variables can be defined inline as well.
const ref = listStaffRef({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listStaffRef(dataConnect, listStaffVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListCustomers
You can execute the `ListCustomers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listCustomers(vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;

interface ListCustomersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
}
export const listCustomersRef: ListCustomersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listCustomers(dc: DataConnect, vars: ListCustomersVariables, options?: ExecuteQueryOptions): QueryPromise<ListCustomersData, ListCustomersVariables>;

interface ListCustomersRef {
  ...
  (dc: DataConnect, vars: ListCustomersVariables): QueryRef<ListCustomersData, ListCustomersVariables>;
}
export const listCustomersRef: ListCustomersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listCustomersRef:
```typescript
const name = listCustomersRef.operationName;
console.log(name);
```

### Variables
The `ListCustomers` query requires an argument of type `ListCustomersVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListCustomersVariables {
  tenantId: UUIDString;
}
```
### Return Type
Recall that executing the `ListCustomers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListCustomersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListCustomers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listCustomers, ListCustomersVariables } from '@dataconnect/generated';

// The `ListCustomers` query requires an argument of type `ListCustomersVariables`:
const listCustomersVars: ListCustomersVariables = {
  tenantId: ..., 
};

// Call the `listCustomers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listCustomers(listCustomersVars);
// Variables can be defined inline as well.
const { data } = await listCustomers({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listCustomers(dataConnect, listCustomersVars);

console.log(data.customers);

// Or, you can use the `Promise` API.
listCustomers(listCustomersVars).then((response) => {
  const data = response.data;
  console.log(data.customers);
});
```

### Using `ListCustomers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listCustomersRef, ListCustomersVariables } from '@dataconnect/generated';

// The `ListCustomers` query requires an argument of type `ListCustomersVariables`:
const listCustomersVars: ListCustomersVariables = {
  tenantId: ..., 
};

// Call the `listCustomersRef()` function to get a reference to the query.
const ref = listCustomersRef(listCustomersVars);
// Variables can be defined inline as well.
const ref = listCustomersRef({ tenantId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listCustomersRef(dataConnect, listCustomersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.customers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.customers);
});
```

## GetCustomerDetails
You can execute the `GetCustomerDetails` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCustomerDetails(vars: GetCustomerDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCustomerDetailsData, GetCustomerDetailsVariables>;

interface GetCustomerDetailsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCustomerDetailsVariables): QueryRef<GetCustomerDetailsData, GetCustomerDetailsVariables>;
}
export const getCustomerDetailsRef: GetCustomerDetailsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCustomerDetails(dc: DataConnect, vars: GetCustomerDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCustomerDetailsData, GetCustomerDetailsVariables>;

interface GetCustomerDetailsRef {
  ...
  (dc: DataConnect, vars: GetCustomerDetailsVariables): QueryRef<GetCustomerDetailsData, GetCustomerDetailsVariables>;
}
export const getCustomerDetailsRef: GetCustomerDetailsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCustomerDetailsRef:
```typescript
const name = getCustomerDetailsRef.operationName;
console.log(name);
```

### Variables
The `GetCustomerDetails` query requires an argument of type `GetCustomerDetailsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetCustomerDetailsVariables {
  customerId: UUIDString;
}
```
### Return Type
Recall that executing the `GetCustomerDetails` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCustomerDetailsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetCustomerDetails`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCustomerDetails, GetCustomerDetailsVariables } from '@dataconnect/generated';

// The `GetCustomerDetails` query requires an argument of type `GetCustomerDetailsVariables`:
const getCustomerDetailsVars: GetCustomerDetailsVariables = {
  customerId: ..., 
};

// Call the `getCustomerDetails()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCustomerDetails(getCustomerDetailsVars);
// Variables can be defined inline as well.
const { data } = await getCustomerDetails({ customerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCustomerDetails(dataConnect, getCustomerDetailsVars);

console.log(data.customer);

// Or, you can use the `Promise` API.
getCustomerDetails(getCustomerDetailsVars).then((response) => {
  const data = response.data;
  console.log(data.customer);
});
```

### Using `GetCustomerDetails`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCustomerDetailsRef, GetCustomerDetailsVariables } from '@dataconnect/generated';

// The `GetCustomerDetails` query requires an argument of type `GetCustomerDetailsVariables`:
const getCustomerDetailsVars: GetCustomerDetailsVariables = {
  customerId: ..., 
};

// Call the `getCustomerDetailsRef()` function to get a reference to the query.
const ref = getCustomerDetailsRef(getCustomerDetailsVars);
// Variables can be defined inline as well.
const ref = getCustomerDetailsRef({ customerId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCustomerDetailsRef(dataConnect, getCustomerDetailsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.customer);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.customer);
});
```

## GetDailyAppointments
You can execute the `GetDailyAppointments` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getDailyAppointments(vars: GetDailyAppointmentsVariables, options?: ExecuteQueryOptions): QueryPromise<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;

interface GetDailyAppointmentsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetDailyAppointmentsVariables): QueryRef<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;
}
export const getDailyAppointmentsRef: GetDailyAppointmentsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getDailyAppointments(dc: DataConnect, vars: GetDailyAppointmentsVariables, options?: ExecuteQueryOptions): QueryPromise<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;

interface GetDailyAppointmentsRef {
  ...
  (dc: DataConnect, vars: GetDailyAppointmentsVariables): QueryRef<GetDailyAppointmentsData, GetDailyAppointmentsVariables>;
}
export const getDailyAppointmentsRef: GetDailyAppointmentsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getDailyAppointmentsRef:
```typescript
const name = getDailyAppointmentsRef.operationName;
console.log(name);
```

### Variables
The `GetDailyAppointments` query requires an argument of type `GetDailyAppointmentsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetDailyAppointmentsVariables {
  tenantId: UUIDString;
  todayStart: TimestampString;
  todayEnd: TimestampString;
}
```
### Return Type
Recall that executing the `GetDailyAppointments` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetDailyAppointmentsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetDailyAppointments`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getDailyAppointments, GetDailyAppointmentsVariables } from '@dataconnect/generated';

// The `GetDailyAppointments` query requires an argument of type `GetDailyAppointmentsVariables`:
const getDailyAppointmentsVars: GetDailyAppointmentsVariables = {
  tenantId: ..., 
  todayStart: ..., 
  todayEnd: ..., 
};

// Call the `getDailyAppointments()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getDailyAppointments(getDailyAppointmentsVars);
// Variables can be defined inline as well.
const { data } = await getDailyAppointments({ tenantId: ..., todayStart: ..., todayEnd: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getDailyAppointments(dataConnect, getDailyAppointmentsVars);

console.log(data.appointments);

// Or, you can use the `Promise` API.
getDailyAppointments(getDailyAppointmentsVars).then((response) => {
  const data = response.data;
  console.log(data.appointments);
});
```

### Using `GetDailyAppointments`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getDailyAppointmentsRef, GetDailyAppointmentsVariables } from '@dataconnect/generated';

// The `GetDailyAppointments` query requires an argument of type `GetDailyAppointmentsVariables`:
const getDailyAppointmentsVars: GetDailyAppointmentsVariables = {
  tenantId: ..., 
  todayStart: ..., 
  todayEnd: ..., 
};

// Call the `getDailyAppointmentsRef()` function to get a reference to the query.
const ref = getDailyAppointmentsRef(getDailyAppointmentsVars);
// Variables can be defined inline as well.
const ref = getDailyAppointmentsRef({ tenantId: ..., todayStart: ..., todayEnd: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getDailyAppointmentsRef(dataConnect, getDailyAppointmentsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.appointments);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.appointments);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `gestionale` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateAppointment
You can execute the `CreateAppointment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createAppointment(vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;

interface CreateAppointmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
}
export const createAppointmentRef: CreateAppointmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createAppointment(dc: DataConnect, vars: CreateAppointmentVariables): MutationPromise<CreateAppointmentData, CreateAppointmentVariables>;

interface CreateAppointmentRef {
  ...
  (dc: DataConnect, vars: CreateAppointmentVariables): MutationRef<CreateAppointmentData, CreateAppointmentVariables>;
}
export const createAppointmentRef: CreateAppointmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createAppointmentRef:
```typescript
const name = createAppointmentRef.operationName;
console.log(name);
```

### Variables
The `CreateAppointment` mutation requires an argument of type `CreateAppointmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateAppointmentVariables {
  tenantId: UUIDString;
  customerId: UUIDString;
  staffId: string;
  serviceId: UUIDString;
  startTime: TimestampString;
  endTime: TimestampString;
  status?: string | null;
}
```
### Return Type
Recall that executing the `CreateAppointment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateAppointmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateAppointmentData {
  appointment_insert: Appointment_Key;
}
```
### Using `CreateAppointment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAppointment, CreateAppointmentVariables } from '@dataconnect/generated';

// The `CreateAppointment` mutation requires an argument of type `CreateAppointmentVariables`:
const createAppointmentVars: CreateAppointmentVariables = {
  tenantId: ..., 
  customerId: ..., 
  staffId: ..., 
  serviceId: ..., 
  startTime: ..., 
  endTime: ..., 
  status: ..., // optional
};

// Call the `createAppointment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createAppointment(createAppointmentVars);
// Variables can be defined inline as well.
const { data } = await createAppointment({ tenantId: ..., customerId: ..., staffId: ..., serviceId: ..., startTime: ..., endTime: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createAppointment(dataConnect, createAppointmentVars);

console.log(data.appointment_insert);

// Or, you can use the `Promise` API.
createAppointment(createAppointmentVars).then((response) => {
  const data = response.data;
  console.log(data.appointment_insert);
});
```

### Using `CreateAppointment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createAppointmentRef, CreateAppointmentVariables } from '@dataconnect/generated';

// The `CreateAppointment` mutation requires an argument of type `CreateAppointmentVariables`:
const createAppointmentVars: CreateAppointmentVariables = {
  tenantId: ..., 
  customerId: ..., 
  staffId: ..., 
  serviceId: ..., 
  startTime: ..., 
  endTime: ..., 
  status: ..., // optional
};

// Call the `createAppointmentRef()` function to get a reference to the mutation.
const ref = createAppointmentRef(createAppointmentVars);
// Variables can be defined inline as well.
const ref = createAppointmentRef({ tenantId: ..., customerId: ..., staffId: ..., serviceId: ..., startTime: ..., endTime: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createAppointmentRef(dataConnect, createAppointmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appointment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appointment_insert);
});
```

## UpdateAppointmentStatus
You can execute the `UpdateAppointmentStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAppointmentStatus(vars: UpdateAppointmentStatusVariables): MutationPromise<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;

interface UpdateAppointmentStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAppointmentStatusVariables): MutationRef<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;
}
export const updateAppointmentStatusRef: UpdateAppointmentStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAppointmentStatus(dc: DataConnect, vars: UpdateAppointmentStatusVariables): MutationPromise<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;

interface UpdateAppointmentStatusRef {
  ...
  (dc: DataConnect, vars: UpdateAppointmentStatusVariables): MutationRef<UpdateAppointmentStatusData, UpdateAppointmentStatusVariables>;
}
export const updateAppointmentStatusRef: UpdateAppointmentStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAppointmentStatusRef:
```typescript
const name = updateAppointmentStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateAppointmentStatus` mutation requires an argument of type `UpdateAppointmentStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAppointmentStatusVariables {
  id: UUIDString;
  status: string;
}
```
### Return Type
Recall that executing the `UpdateAppointmentStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAppointmentStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAppointmentStatusData {
  appointment_update?: Appointment_Key | null;
}
```
### Using `UpdateAppointmentStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAppointmentStatus, UpdateAppointmentStatusVariables } from '@dataconnect/generated';

// The `UpdateAppointmentStatus` mutation requires an argument of type `UpdateAppointmentStatusVariables`:
const updateAppointmentStatusVars: UpdateAppointmentStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateAppointmentStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAppointmentStatus(updateAppointmentStatusVars);
// Variables can be defined inline as well.
const { data } = await updateAppointmentStatus({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAppointmentStatus(dataConnect, updateAppointmentStatusVars);

console.log(data.appointment_update);

// Or, you can use the `Promise` API.
updateAppointmentStatus(updateAppointmentStatusVars).then((response) => {
  const data = response.data;
  console.log(data.appointment_update);
});
```

### Using `UpdateAppointmentStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAppointmentStatusRef, UpdateAppointmentStatusVariables } from '@dataconnect/generated';

// The `UpdateAppointmentStatus` mutation requires an argument of type `UpdateAppointmentStatusVariables`:
const updateAppointmentStatusVars: UpdateAppointmentStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateAppointmentStatusRef()` function to get a reference to the mutation.
const ref = updateAppointmentStatusRef(updateAppointmentStatusVars);
// Variables can be defined inline as well.
const ref = updateAppointmentStatusRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAppointmentStatusRef(dataConnect, updateAppointmentStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appointment_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appointment_update);
});
```

## DeleteAppointment
You can execute the `DeleteAppointment` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteAppointment(vars: DeleteAppointmentVariables): MutationPromise<DeleteAppointmentData, DeleteAppointmentVariables>;

interface DeleteAppointmentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteAppointmentVariables): MutationRef<DeleteAppointmentData, DeleteAppointmentVariables>;
}
export const deleteAppointmentRef: DeleteAppointmentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteAppointment(dc: DataConnect, vars: DeleteAppointmentVariables): MutationPromise<DeleteAppointmentData, DeleteAppointmentVariables>;

interface DeleteAppointmentRef {
  ...
  (dc: DataConnect, vars: DeleteAppointmentVariables): MutationRef<DeleteAppointmentData, DeleteAppointmentVariables>;
}
export const deleteAppointmentRef: DeleteAppointmentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteAppointmentRef:
```typescript
const name = deleteAppointmentRef.operationName;
console.log(name);
```

### Variables
The `DeleteAppointment` mutation requires an argument of type `DeleteAppointmentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteAppointmentVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteAppointment` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteAppointmentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteAppointmentData {
  appointment_delete?: Appointment_Key | null;
}
```
### Using `DeleteAppointment`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteAppointment, DeleteAppointmentVariables } from '@dataconnect/generated';

// The `DeleteAppointment` mutation requires an argument of type `DeleteAppointmentVariables`:
const deleteAppointmentVars: DeleteAppointmentVariables = {
  id: ..., 
};

// Call the `deleteAppointment()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteAppointment(deleteAppointmentVars);
// Variables can be defined inline as well.
const { data } = await deleteAppointment({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteAppointment(dataConnect, deleteAppointmentVars);

console.log(data.appointment_delete);

// Or, you can use the `Promise` API.
deleteAppointment(deleteAppointmentVars).then((response) => {
  const data = response.data;
  console.log(data.appointment_delete);
});
```

### Using `DeleteAppointment`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteAppointmentRef, DeleteAppointmentVariables } from '@dataconnect/generated';

// The `DeleteAppointment` mutation requires an argument of type `DeleteAppointmentVariables`:
const deleteAppointmentVars: DeleteAppointmentVariables = {
  id: ..., 
};

// Call the `deleteAppointmentRef()` function to get a reference to the mutation.
const ref = deleteAppointmentRef(deleteAppointmentVars);
// Variables can be defined inline as well.
const ref = deleteAppointmentRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteAppointmentRef(dataConnect, deleteAppointmentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.appointment_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.appointment_delete);
});
```

## UpsertService
You can execute the `UpsertService` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertService(vars: UpsertServiceVariables): MutationPromise<UpsertServiceData, UpsertServiceVariables>;

interface UpsertServiceRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertServiceVariables): MutationRef<UpsertServiceData, UpsertServiceVariables>;
}
export const upsertServiceRef: UpsertServiceRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertService(dc: DataConnect, vars: UpsertServiceVariables): MutationPromise<UpsertServiceData, UpsertServiceVariables>;

interface UpsertServiceRef {
  ...
  (dc: DataConnect, vars: UpsertServiceVariables): MutationRef<UpsertServiceData, UpsertServiceVariables>;
}
export const upsertServiceRef: UpsertServiceRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertServiceRef:
```typescript
const name = upsertServiceRef.operationName;
console.log(name);
```

### Variables
The `UpsertService` mutation requires an argument of type `UpsertServiceVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertServiceVariables {
  id: UUIDString;
  tenantId: UUIDString;
  name: string;
  durationMinutes: number;
  price: number;
}
```
### Return Type
Recall that executing the `UpsertService` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertServiceData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertServiceData {
  service_upsert: Service_Key;
}
```
### Using `UpsertService`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertService, UpsertServiceVariables } from '@dataconnect/generated';

// The `UpsertService` mutation requires an argument of type `UpsertServiceVariables`:
const upsertServiceVars: UpsertServiceVariables = {
  id: ..., 
  tenantId: ..., 
  name: ..., 
  durationMinutes: ..., 
  price: ..., 
};

// Call the `upsertService()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertService(upsertServiceVars);
// Variables can be defined inline as well.
const { data } = await upsertService({ id: ..., tenantId: ..., name: ..., durationMinutes: ..., price: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertService(dataConnect, upsertServiceVars);

console.log(data.service_upsert);

// Or, you can use the `Promise` API.
upsertService(upsertServiceVars).then((response) => {
  const data = response.data;
  console.log(data.service_upsert);
});
```

### Using `UpsertService`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertServiceRef, UpsertServiceVariables } from '@dataconnect/generated';

// The `UpsertService` mutation requires an argument of type `UpsertServiceVariables`:
const upsertServiceVars: UpsertServiceVariables = {
  id: ..., 
  tenantId: ..., 
  name: ..., 
  durationMinutes: ..., 
  price: ..., 
};

// Call the `upsertServiceRef()` function to get a reference to the mutation.
const ref = upsertServiceRef(upsertServiceVars);
// Variables can be defined inline as well.
const ref = upsertServiceRef({ id: ..., tenantId: ..., name: ..., durationMinutes: ..., price: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertServiceRef(dataConnect, upsertServiceVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.service_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.service_upsert);
});
```

## UpsertUser
You can execute the `UpsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertUserRef:
```typescript
const name = upsertUserRef.operationName;
console.log(name);
```

### Variables
The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertUserVariables {
  id: string;
  tenantId: UUIDString;
  role: string;
  fullName: string;
  phone?: string | null;
}
```
### Return Type
Recall that executing the `UpsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertUserData {
  user_upsert: User_Key;
}
```
### Using `UpsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertUser, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  id: ..., 
  tenantId: ..., 
  role: ..., 
  fullName: ..., 
  phone: ..., // optional
};

// Call the `upsertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUser(upsertUserVars);
// Variables can be defined inline as well.
const { data } = await upsertUser({ id: ..., tenantId: ..., role: ..., fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertUser(dataConnect, upsertUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
upsertUser(upsertUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertUserRef, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  id: ..., 
  tenantId: ..., 
  role: ..., 
  fullName: ..., 
  phone: ..., // optional
};

// Call the `upsertUserRef()` function to get a reference to the mutation.
const ref = upsertUserRef(upsertUserVars);
// Variables can be defined inline as well.
const ref = upsertUserRef({ id: ..., tenantId: ..., role: ..., fullName: ..., phone: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertUserRef(dataConnect, upsertUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## CreateCustomer
You can execute the `CreateCustomer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createCustomer(vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface CreateCustomerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
}
export const createCustomerRef: CreateCustomerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createCustomer(dc: DataConnect, vars: CreateCustomerVariables): MutationPromise<CreateCustomerData, CreateCustomerVariables>;

interface CreateCustomerRef {
  ...
  (dc: DataConnect, vars: CreateCustomerVariables): MutationRef<CreateCustomerData, CreateCustomerVariables>;
}
export const createCustomerRef: CreateCustomerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createCustomerRef:
```typescript
const name = createCustomerRef.operationName;
console.log(name);
```

### Variables
The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateCustomerVariables {
  tenantId: UUIDString;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  birthday?: string | null;
  technicalNotes?: string | null;
}
```
### Return Type
Recall that executing the `CreateCustomer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateCustomerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateCustomerData {
  customer_insert: Customer_Key;
}
```
### Using `CreateCustomer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCustomer, CreateCustomerVariables } from '@dataconnect/generated';

// The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`:
const createCustomerVars: CreateCustomerVariables = {
  tenantId: ..., 
  firstName: ..., 
  lastName: ..., 
  phone: ..., 
  email: ..., // optional
  birthday: ..., // optional
  technicalNotes: ..., // optional
};

// Call the `createCustomer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCustomer(createCustomerVars);
// Variables can be defined inline as well.
const { data } = await createCustomer({ tenantId: ..., firstName: ..., lastName: ..., phone: ..., email: ..., birthday: ..., technicalNotes: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createCustomer(dataConnect, createCustomerVars);

console.log(data.customer_insert);

// Or, you can use the `Promise` API.
createCustomer(createCustomerVars).then((response) => {
  const data = response.data;
  console.log(data.customer_insert);
});
```

### Using `CreateCustomer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createCustomerRef, CreateCustomerVariables } from '@dataconnect/generated';

// The `CreateCustomer` mutation requires an argument of type `CreateCustomerVariables`:
const createCustomerVars: CreateCustomerVariables = {
  tenantId: ..., 
  firstName: ..., 
  lastName: ..., 
  phone: ..., 
  email: ..., // optional
  birthday: ..., // optional
  technicalNotes: ..., // optional
};

// Call the `createCustomerRef()` function to get a reference to the mutation.
const ref = createCustomerRef(createCustomerVars);
// Variables can be defined inline as well.
const ref = createCustomerRef({ tenantId: ..., firstName: ..., lastName: ..., phone: ..., email: ..., birthday: ..., technicalNotes: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createCustomerRef(dataConnect, createCustomerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.customer_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.customer_insert);
});
```

## UpdateCustomer
You can execute the `UpdateCustomer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateCustomer(vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface UpdateCustomerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
}
export const updateCustomerRef: UpdateCustomerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateCustomer(dc: DataConnect, vars: UpdateCustomerVariables): MutationPromise<UpdateCustomerData, UpdateCustomerVariables>;

interface UpdateCustomerRef {
  ...
  (dc: DataConnect, vars: UpdateCustomerVariables): MutationRef<UpdateCustomerData, UpdateCustomerVariables>;
}
export const updateCustomerRef: UpdateCustomerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateCustomerRef:
```typescript
const name = updateCustomerRef.operationName;
console.log(name);
```

### Variables
The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateCustomerVariables {
  id: UUIDString;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  technicalNotes?: string | null;
}
```
### Return Type
Recall that executing the `UpdateCustomer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateCustomerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateCustomerData {
  customer_update?: Customer_Key | null;
}
```
### Using `UpdateCustomer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateCustomer, UpdateCustomerVariables } from '@dataconnect/generated';

// The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`:
const updateCustomerVars: UpdateCustomerVariables = {
  id: ..., 
  firstName: ..., // optional
  lastName: ..., // optional
  phone: ..., // optional
  email: ..., // optional
  birthday: ..., // optional
  technicalNotes: ..., // optional
};

// Call the `updateCustomer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateCustomer(updateCustomerVars);
// Variables can be defined inline as well.
const { data } = await updateCustomer({ id: ..., firstName: ..., lastName: ..., phone: ..., email: ..., birthday: ..., technicalNotes: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateCustomer(dataConnect, updateCustomerVars);

console.log(data.customer_update);

// Or, you can use the `Promise` API.
updateCustomer(updateCustomerVars).then((response) => {
  const data = response.data;
  console.log(data.customer_update);
});
```

### Using `UpdateCustomer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateCustomerRef, UpdateCustomerVariables } from '@dataconnect/generated';

// The `UpdateCustomer` mutation requires an argument of type `UpdateCustomerVariables`:
const updateCustomerVars: UpdateCustomerVariables = {
  id: ..., 
  firstName: ..., // optional
  lastName: ..., // optional
  phone: ..., // optional
  email: ..., // optional
  birthday: ..., // optional
  technicalNotes: ..., // optional
};

// Call the `updateCustomerRef()` function to get a reference to the mutation.
const ref = updateCustomerRef(updateCustomerVars);
// Variables can be defined inline as well.
const ref = updateCustomerRef({ id: ..., firstName: ..., lastName: ..., phone: ..., email: ..., birthday: ..., technicalNotes: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateCustomerRef(dataConnect, updateCustomerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.customer_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.customer_update);
});
```

## InserisciDatiDiProva
You can execute the `InserisciDatiDiProva` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
inserisciDatiDiProva(): MutationPromise<InserisciDatiDiProvaData, undefined>;

interface InserisciDatiDiProvaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<InserisciDatiDiProvaData, undefined>;
}
export const inserisciDatiDiProvaRef: InserisciDatiDiProvaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
inserisciDatiDiProva(dc: DataConnect): MutationPromise<InserisciDatiDiProvaData, undefined>;

interface InserisciDatiDiProvaRef {
  ...
  (dc: DataConnect): MutationRef<InserisciDatiDiProvaData, undefined>;
}
export const inserisciDatiDiProvaRef: InserisciDatiDiProvaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the inserisciDatiDiProvaRef:
```typescript
const name = inserisciDatiDiProvaRef.operationName;
console.log(name);
```

### Variables
The `InserisciDatiDiProva` mutation has no variables.
### Return Type
Recall that executing the `InserisciDatiDiProva` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InserisciDatiDiProvaData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InserisciDatiDiProvaData {
  tenant_upsert: Tenant_Key;
  customer_upsert: Customer_Key;
  user_upsert: User_Key;
  service_upsert: Service_Key;
  appointment_insert: Appointment_Key;
}
```
### Using `InserisciDatiDiProva`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, inserisciDatiDiProva } from '@dataconnect/generated';


// Call the `inserisciDatiDiProva()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await inserisciDatiDiProva();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await inserisciDatiDiProva(dataConnect);

console.log(data.tenant_upsert);
console.log(data.customer_upsert);
console.log(data.user_upsert);
console.log(data.service_upsert);
console.log(data.appointment_insert);

// Or, you can use the `Promise` API.
inserisciDatiDiProva().then((response) => {
  const data = response.data;
  console.log(data.tenant_upsert);
  console.log(data.customer_upsert);
  console.log(data.user_upsert);
  console.log(data.service_upsert);
  console.log(data.appointment_insert);
});
```

### Using `InserisciDatiDiProva`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, inserisciDatiDiProvaRef } from '@dataconnect/generated';


// Call the `inserisciDatiDiProvaRef()` function to get a reference to the mutation.
const ref = inserisciDatiDiProvaRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = inserisciDatiDiProvaRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.tenant_upsert);
console.log(data.customer_upsert);
console.log(data.user_upsert);
console.log(data.service_upsert);
console.log(data.appointment_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.tenant_upsert);
  console.log(data.customer_upsert);
  console.log(data.user_upsert);
  console.log(data.service_upsert);
  console.log(data.appointment_insert);
});
```

## UpsertTenant
You can execute the `UpsertTenant` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertTenant(vars: UpsertTenantVariables): MutationPromise<UpsertTenantData, UpsertTenantVariables>;

interface UpsertTenantRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertTenantVariables): MutationRef<UpsertTenantData, UpsertTenantVariables>;
}
export const upsertTenantRef: UpsertTenantRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertTenant(dc: DataConnect, vars: UpsertTenantVariables): MutationPromise<UpsertTenantData, UpsertTenantVariables>;

interface UpsertTenantRef {
  ...
  (dc: DataConnect, vars: UpsertTenantVariables): MutationRef<UpsertTenantData, UpsertTenantVariables>;
}
export const upsertTenantRef: UpsertTenantRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertTenantRef:
```typescript
const name = upsertTenantRef.operationName;
console.log(name);
```

### Variables
The `UpsertTenant` mutation requires an argument of type `UpsertTenantVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertTenantVariables {
  id: UUIDString;
  name: string;
  planType: string;
  businessCategory: string;
}
```
### Return Type
Recall that executing the `UpsertTenant` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertTenantData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertTenantData {
  tenant_upsert: Tenant_Key;
}
```
### Using `UpsertTenant`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertTenant, UpsertTenantVariables } from '@dataconnect/generated';

// The `UpsertTenant` mutation requires an argument of type `UpsertTenantVariables`:
const upsertTenantVars: UpsertTenantVariables = {
  id: ..., 
  name: ..., 
  planType: ..., 
  businessCategory: ..., 
};

// Call the `upsertTenant()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertTenant(upsertTenantVars);
// Variables can be defined inline as well.
const { data } = await upsertTenant({ id: ..., name: ..., planType: ..., businessCategory: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertTenant(dataConnect, upsertTenantVars);

console.log(data.tenant_upsert);

// Or, you can use the `Promise` API.
upsertTenant(upsertTenantVars).then((response) => {
  const data = response.data;
  console.log(data.tenant_upsert);
});
```

### Using `UpsertTenant`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertTenantRef, UpsertTenantVariables } from '@dataconnect/generated';

// The `UpsertTenant` mutation requires an argument of type `UpsertTenantVariables`:
const upsertTenantVars: UpsertTenantVariables = {
  id: ..., 
  name: ..., 
  planType: ..., 
  businessCategory: ..., 
};

// Call the `upsertTenantRef()` function to get a reference to the mutation.
const ref = upsertTenantRef(upsertTenantVars);
// Variables can be defined inline as well.
const ref = upsertTenantRef({ id: ..., name: ..., planType: ..., businessCategory: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertTenantRef(dataConnect, upsertTenantVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.tenant_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.tenant_upsert);
});
```

## UpdateTenantOnboarding
You can execute the `UpdateTenantOnboarding` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateTenantOnboarding(vars: UpdateTenantOnboardingVariables): MutationPromise<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;

interface UpdateTenantOnboardingRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateTenantOnboardingVariables): MutationRef<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;
}
export const updateTenantOnboardingRef: UpdateTenantOnboardingRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateTenantOnboarding(dc: DataConnect, vars: UpdateTenantOnboardingVariables): MutationPromise<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;

interface UpdateTenantOnboardingRef {
  ...
  (dc: DataConnect, vars: UpdateTenantOnboardingVariables): MutationRef<UpdateTenantOnboardingData, UpdateTenantOnboardingVariables>;
}
export const updateTenantOnboardingRef: UpdateTenantOnboardingRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateTenantOnboardingRef:
```typescript
const name = updateTenantOnboardingRef.operationName;
console.log(name);
```

### Variables
The `UpdateTenantOnboarding` mutation requires an argument of type `UpdateTenantOnboardingVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateTenantOnboardingVariables {
  id: UUIDString;
  businessCategory: string;
}
```
### Return Type
Recall that executing the `UpdateTenantOnboarding` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateTenantOnboardingData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateTenantOnboardingData {
  tenant_update?: Tenant_Key | null;
}
```
### Using `UpdateTenantOnboarding`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateTenantOnboarding, UpdateTenantOnboardingVariables } from '@dataconnect/generated';

// The `UpdateTenantOnboarding` mutation requires an argument of type `UpdateTenantOnboardingVariables`:
const updateTenantOnboardingVars: UpdateTenantOnboardingVariables = {
  id: ..., 
  businessCategory: ..., 
};

// Call the `updateTenantOnboarding()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateTenantOnboarding(updateTenantOnboardingVars);
// Variables can be defined inline as well.
const { data } = await updateTenantOnboarding({ id: ..., businessCategory: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateTenantOnboarding(dataConnect, updateTenantOnboardingVars);

console.log(data.tenant_update);

// Or, you can use the `Promise` API.
updateTenantOnboarding(updateTenantOnboardingVars).then((response) => {
  const data = response.data;
  console.log(data.tenant_update);
});
```

### Using `UpdateTenantOnboarding`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateTenantOnboardingRef, UpdateTenantOnboardingVariables } from '@dataconnect/generated';

// The `UpdateTenantOnboarding` mutation requires an argument of type `UpdateTenantOnboardingVariables`:
const updateTenantOnboardingVars: UpdateTenantOnboardingVariables = {
  id: ..., 
  businessCategory: ..., 
};

// Call the `updateTenantOnboardingRef()` function to get a reference to the mutation.
const ref = updateTenantOnboardingRef(updateTenantOnboardingVars);
// Variables can be defined inline as well.
const ref = updateTenantOnboardingRef({ id: ..., businessCategory: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateTenantOnboardingRef(dataConnect, updateTenantOnboardingVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.tenant_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.tenant_update);
});
```

