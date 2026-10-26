-- People active at least once in a week, by tenant.
select tenant, date_trunc('week', day) as week, count(distinct person) as people
from activity group by all order by week, tenant
