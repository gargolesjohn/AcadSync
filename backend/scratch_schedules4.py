import re

with open(r"C:\Users\John Gargoles\.gemini\antigravity-ide\brain\bee988fa-b9f6-41e4-96ae-934ca306c345\.system_generated\logs\transcript.jsonl", 'r', encoding='utf-8') as f:
    text = f.read()

# Search for the function definition in the JSON string
m = re.search(r'def get_default_schedules\(\):\\n\s*\\\"\\\"\\\"Return default schedule records\.\\\"\\\"\\\"\\n\s*return\s*\[(.*?)\]\\n', text, re.DOTALL)
if m:
    res = m.group(0).replace('\\n', '\n').replace('\\"', '"').replace('\\t', '\t')
    print("=== FOUND ===")
    print(res)
else:
    print("Not found.")
