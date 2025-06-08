@echo off
set PGPASSWORD=Th1s1s4Work
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5433 -U postgres -d alexandria -c "SELECT username, roles FROM users;"