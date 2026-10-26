-- Ninety days of product use for two tenants, synthetic and reproducible: each
-- person's day is decided by a hash of the two, so every run makes the same rows.
-- People are ids, never names.
create table people as
select 'p' || lpad(i::text, 3, '0') as person,
       case when i % 4 = 0 then 'harbor-dental' else 'fieldstone' end as tenant,
       date '2026-07-27' + (i % 60)::int as joined
from range(1, 301) t(i);

create table activity as
select person, tenant, joined + d::int as day,
       case hash(person, d, 'kind') % 10 when 0 then 'document' when 1 then 'request' when 2 then 'request' else 'chat' end as kind,
       round(0.0004 + (hash(person, d, 'cost') % 1000) / 1000.0 * 0.0012, 5) as dollars
from people, range(0, 90) r(d)
where joined + d::int <= date '2026-10-25'
  and (hash(person, d) % 1000) / 1000.0 < 0.3 * pow(0.95, d);
