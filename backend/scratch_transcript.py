import json
import os

transcript_path = r"C:\Users\John Gargoles\.gemini\antigravity-ide\brain\bee988fa-b9f6-41e4-96ae-934ca306c345\.system_generated\logs\transcript.jsonl"

for line in open(transcript_path, 'r', encoding='utf-8'):
    try:
        data = json.loads(line)
        if 'tool_calls' in data and data['tool_calls']:
            call = data['tool_calls'][0]
            if call['name'] == 'multi_replace_file_content':
                args = call['args']
                if 'default_data.py' in args.get('TargetFile', ''):
                    chunks = args.get('ReplacementChunks', '[]')
                    if isinstance(chunks, str):
                        chunks = json.loads(chunks)
                    for chunk in chunks:
                        print("==== TARGET CONTENT ====")
                        print(chunk.get('TargetContent', ''))
                        print("========================")
    except Exception as e:
        pass
