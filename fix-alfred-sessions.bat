@echo off
echo Running Alfred Session Management Patch...

:: Create the sessions table in PostgreSQL
set PGPASSWORD=Th1s1s4Work
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 5433 -U postgres -d alexandria -c "CREATE TABLE IF NOT EXISTS alfred_sessions (id VARCHAR(64) PRIMARY KEY, project_path TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, messages JSONB NOT NULL DEFAULT '[]'::jsonb, metadata JSONB NOT NULL DEFAULT '{}'::jsonb);"

echo Session table created or verified.
echo.
echo Please restart Alexandria to apply the patch.
