-- Model spend per active person per month, by tenant.
select tenant, date_trunc('month', day) as month,
       round(sum(dollars) / count(distinct person), 4) as dollars_per_person
from activity group by all order by month, tenant
