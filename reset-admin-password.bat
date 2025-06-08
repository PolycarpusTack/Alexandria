@echo off
set PGPASSWORD=Th1s1s4Work
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5433 -U postgres -d alexandria -c "UPDATE users SET hashed_password = '$2b$10$3euPr3YY7yZ6LkbK/nvVo.1oU5u0CExSijHFu1zVPGNFx.zgkV.CS' WHERE username = 'admin';"