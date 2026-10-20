# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { listServices, listStaff, createAppointment, updateAppointmentStatus, deleteAppointment, upsertService, upsertUser, listCustomers, getCustomerDetails, createCustomer } from '@dataconnect/generated';


// Operation ListServices:  For variables, look at type ListServicesVars in ../index.d.ts
const { data } = await ListServices(dataConnect, listServicesVars);

// Operation ListStaff:  For variables, look at type ListStaffVars in ../index.d.ts
const { data } = await ListStaff(dataConnect, listStaffVars);

// Operation CreateAppointment:  For variables, look at type CreateAppointmentVars in ../index.d.ts
const { data } = await CreateAppointment(dataConnect, createAppointmentVars);

// Operation UpdateAppointmentStatus:  For variables, look at type UpdateAppointmentStatusVars in ../index.d.ts
const { data } = await UpdateAppointmentStatus(dataConnect, updateAppointmentStatusVars);

// Operation DeleteAppointment:  For variables, look at type DeleteAppointmentVars in ../index.d.ts
const { data } = await DeleteAppointment(dataConnect, deleteAppointmentVars);

// Operation UpsertService:  For variables, look at type UpsertServiceVars in ../index.d.ts
const { data } = await UpsertService(dataConnect, upsertServiceVars);

// Operation UpsertUser:  For variables, look at type UpsertUserVars in ../index.d.ts
const { data } = await UpsertUser(dataConnect, upsertUserVars);

// Operation ListCustomers:  For variables, look at type ListCustomersVars in ../index.d.ts
const { data } = await ListCustomers(dataConnect, listCustomersVars);

// Operation GetCustomerDetails:  For variables, look at type GetCustomerDetailsVars in ../index.d.ts
const { data } = await GetCustomerDetails(dataConnect, getCustomerDetailsVars);

// Operation CreateCustomer:  For variables, look at type CreateCustomerVars in ../index.d.ts
const { data } = await CreateCustomer(dataConnect, createCustomerVars);


```