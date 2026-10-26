-- What people use WorkBot for: chats, requests, documents, by month.
select date_trunc('month', day) as month, kind, count(*) as uses
from activity group by all order by month, kind
