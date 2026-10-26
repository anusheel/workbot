-- Fails with rows when anyone was active before joining.
select a.* from activity a join people p using (person) where a.day < p.joined
