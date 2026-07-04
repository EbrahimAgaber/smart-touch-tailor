import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = os.path.expandvars(r'%APPDATA%\البصمة الذكية\zatca_debug.log')
print("Reading log from:", log_path)

if not os.path.exists(log_path):
    print("Log file does not exist!")
    exit(1)

with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
    print("--- LAST 50 LINES ---")
    for line in lines[-50:]:
        print(line.strip())
