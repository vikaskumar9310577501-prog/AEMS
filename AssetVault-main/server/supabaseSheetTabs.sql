-- Google Sheet jaisi tabs (Table Editor me dikhengi)

create or replace view asset_sheet as
select
  id as "Asset ID",
  asset_code as "Asset Code",
  account_asset_code as "Account Asset",
  asset_name as "Asset Name",
  main_category as "Main Category",
  sub_category as "Sub Category",
  asset_type as "Asset Type",
  brand as "Brand",
  model as "Model",
  serial_number as "Serial Number",
  quantity as "Quantity",
  plant_code as "Plant Name",
  location as "Location",
  department as "Department",
  assigned_to as "Assigned To",
  employee_id as "Employee ID",
  assigned_date as "Assigned Date",
  purchase_date as "Purchase Date",
  purchase_cost as "Purchase Cost",
  vendor_name as "Vendor Name",
  invoice_number as "Invoice Number",
  warranty_start as "Warranty Start Date",
  warranty_end as "Warranty Expiry Date",
  condition as "Condition",
  status as "Status",
  ram as "RAM",
  ssd as "SSD",
  cpu as "CPU",
  windows_version as "Windows Version",
  mac_address as "MAC Address",
  ip_address as "IP Address",
  host_name as "Host Name",
  contact_email as "Contact Email",
  contact_mobile as "Contact Number",
  photo_url as "Photo URL / Photo Upload",
  document_url as "Document URL / Attached Documents"
from assets;

create or replace view "IT Assets" as
select * from asset_sheet
where coalesce("Main Category", 'IT Assets') = 'IT Assets';

create or replace view "Office Assets" as
select * from asset_sheet where "Main Category" = 'Office Assets';

create or replace view "Electrical Assets" as
select * from asset_sheet where "Main Category" = 'Electrical Assets';

create or replace view "Production Assets" as
select * from asset_sheet where "Main Category" = 'Production Assets';

create or replace view "Safety Assets" as
select * from asset_sheet where "Main Category" = 'Safety Assets';

create or replace view "Vehicle Assets" as
select * from asset_sheet where "Main Category" = 'Vehicle Assets';

create or replace view "Furniture Assets" as
select * from asset_sheet where "Main Category" = 'Furniture Assets';

create or replace view "Software License Assets" as
select * from asset_sheet
where "Main Category" in ('Software License Assets', 'Software / License Assets');

create or replace view "Admin Facility Assets" as
select * from asset_sheet
where "Main Category" in ('Admin Facility Assets', 'Admin / Facility Assets');

create or replace view "Maintenance Assets" as
select * from asset_sheet where "Main Category" = 'Maintenance Assets';

create or replace view "2040" as
select * from asset_sheet where "Plant Name" = '2040';

create or replace view "4020" as
select * from asset_sheet where "Plant Name" = '4020';

create or replace view "BHIWADI" as
select * from asset_sheet where "Location" ilike 'BHIWADI';

create or replace view "Users" as
select email as "Email", role as "Role", locations as "Locations", plants as "Plants", categories as "Categories"
from users;

create or replace view "OTP_Log" as
select email as "Email", otp as "OTP", expiry as "Expiry", attempts as "Attempts", status as "Status"
from otp_log;

create or replace view "Employees" as
select
  employee_id as "Employee ID",
  name as "Name",
  email as "Email",
  phone as "Phone",
  department as "Department",
  designation as "Designation",
  location as "Location",
  plant as "Plant",
  status as "Status"
from employees;

grant select on asset_sheet to postgres, service_role;
grant select on "IT Assets" to postgres, service_role;
grant select on "Office Assets" to postgres, service_role;
grant select on "Electrical Assets" to postgres, service_role;
grant select on "Production Assets" to postgres, service_role;
grant select on "Safety Assets" to postgres, service_role;
grant select on "Vehicle Assets" to postgres, service_role;
grant select on "Furniture Assets" to postgres, service_role;
grant select on "Software License Assets" to postgres, service_role;
grant select on "Admin Facility Assets" to postgres, service_role;
grant select on "Maintenance Assets" to postgres, service_role;
grant select on "2040" to postgres, service_role;
grant select on "4020" to postgres, service_role;
grant select on "BHIWADI" to postgres, service_role;
grant select on "Users" to postgres, service_role;
grant select on "OTP_Log" to postgres, service_role;
grant select on "Employees" to postgres, service_role;

notify pgrst, 'reload schema';
